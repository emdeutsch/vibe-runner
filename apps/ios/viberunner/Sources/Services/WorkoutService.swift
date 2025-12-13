import Foundation

@MainActor
class WorkoutService: ObservableObject {
    static let shared = WorkoutService()

    @Published var isActive = false
    @Published var currentSessionId: String?
    @Published var currentBPM: Int = 0
    @Published var toolsUnlocked = false
    @Published var error: String?

    private var statusTimer: Timer?

    private init() {}

    // MARK: - Workout Control

    func startWorkout() async throws {
        let session = try await APIService.shared.startWorkout()
        currentSessionId = session.sessionId
        isActive = true
        error = nil

        // Start polling HR status
        startStatusPolling()
    }

    func stopWorkout() async throws {
        try await APIService.shared.stopWorkout()
        currentSessionId = nil
        isActive = false
        currentBPM = 0
        toolsUnlocked = false

        // Stop polling
        stopStatusPolling()
    }

    // MARK: - HR Sample Ingestion

    func ingestHeartRate(_ bpm: Int) async {
        guard let sessionId = currentSessionId else { return }

        do {
            let status = try await APIService.shared.ingestHRSample(
                sessionId: sessionId,
                bpm: bpm
            )
            currentBPM = bpm
            toolsUnlocked = status.toolsUnlocked
        } catch {
            self.error = error.localizedDescription
        }
    }

    // MARK: - Status Polling

    private func startStatusPolling() {
        statusTimer = Timer.scheduledTimer(withTimeInterval: Config.hrStatusPollInterval, repeats: true) { [weak self] _ in
            Task { @MainActor [weak self] in
                await self?.pollStatus()
            }
        }
    }

    private func stopStatusPolling() {
        statusTimer?.invalidate()
        statusTimer = nil
    }

    private func pollStatus() async {
        do {
            let status = try await APIService.shared.fetchHRStatus()
            toolsUnlocked = status.toolsUnlocked
            if !isActive {
                currentBPM = 0
            }
        } catch {
            // Ignore polling errors
        }
    }

    // MARK: - Check Active Session on Launch

    func checkActiveSession() async {
        do {
            let active = try await APIService.shared.getActiveWorkout()
            if active.active, let sessionId = active.sessionId {
                currentSessionId = sessionId
                isActive = true
                startStatusPolling()
            }
        } catch {
            // Ignore errors
        }
    }
}
