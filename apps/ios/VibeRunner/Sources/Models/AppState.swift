import Foundation
import SwiftUI
import Combine
import CoreLocation

/// Main application state
@MainActor
class AppState: ObservableObject {
    // MARK: - Published Properties

    @Published var isOnboarded: Bool = false
    @Published var isAuthenticated: Bool = false
    @Published var claudeAppSelected: Bool = false
    @Published var githubConnected: Bool = false
    @Published var hasGatedRepos: Bool = false

    @Published var runState: RunState = .notRunning
    @Published var currentPace: Double? = nil // seconds per mile
    @Published var totalDistance: Double = 0 // meters
    @Published var runDuration: TimeInterval = 0

    /// Route coordinates for map display
    @Published var routeCoordinates: [CLLocationCoordinate2D] = []
    /// Current user location for map centering
    @Published var currentLocation: CLLocationCoordinate2D?

    @Published var error: AppError? = nil

    // MARK: - Services

    let locationService = LocationService()
    let screenTimeService = ScreenTimeService()
    let apiService = APIService()
    let paceCalculator = PaceCalculator()

    // MARK: - Private

    private var cancellables = Set<AnyCancellable>()
    private var runTimer: Timer?
    private var heartbeatTimer: Timer?
    private var runStartTime: Date?

    // MARK: - Initialization

    func initialize() async {
        // Load persisted state
        loadPersistedState()

        // Set up location updates
        setupLocationUpdates()

        // Check authentication
        if let token = UserDefaults.standard.string(forKey: "authToken") {
            apiService.setAuthToken(token)
            isAuthenticated = true
            await refreshUserState()
        }
    }

    // MARK: - Onboarding

    func completeOnboarding() {
        isOnboarded = true
        UserDefaults.standard.set(true, forKey: "isOnboarded")
    }

    // MARK: - Authentication

    func register(email: String, deviceName: String) async throws {
        let response = try await apiService.register(email: email, deviceName: deviceName)
        UserDefaults.standard.set(response.token, forKey: "authToken")
        apiService.setAuthToken(response.token)
        isAuthenticated = true
    }

    func refreshUserState() async {
        do {
            let user = try await apiService.getCurrentUser()
            githubConnected = user.githubConnected
            let repos = try await apiService.getGatedRepos()
            hasGatedRepos = !repos.isEmpty
        } catch {
            print("Failed to refresh user state: \(error)")
        }
    }

    // MARK: - Run Session

    func startRun() async {
        guard runState == .notRunning else { return }

        // Request location permission if needed
        await locationService.requestPermission()

        // Start location tracking
        locationService.startTracking()

        // Reset state
        paceCalculator.reset()
        totalDistance = 0
        runDuration = 0
        currentPace = nil
        routeCoordinates = []
        runStartTime = Date()

        // Initial state is locked (must prove pace)
        runState = .runningLocked

        // Block Claude immediately
        await screenTimeService.blockClaude()

        // Notify backend
        do {
            try await apiService.startRun()
        } catch {
            print("Failed to notify backend of run start: \(error)")
        }

        // Start timers
        startRunTimer()
        startHeartbeatTimer()
    }

    func endRun() async {
        guard runState != .notRunning else { return }

        // Stop tracking
        locationService.stopTracking()
        stopRunTimer()
        stopHeartbeatTimer()

        // Unblock Claude
        await screenTimeService.unblockClaude()

        runState = .notRunning

        // Notify backend
        do {
            try await apiService.endRun()
        } catch {
            print("Failed to notify backend of run end: \(error)")
        }
    }

    // MARK: - Private Methods

    private func loadPersistedState() {
        isOnboarded = UserDefaults.standard.bool(forKey: "isOnboarded")
        claudeAppSelected = UserDefaults.standard.bool(forKey: "claudeAppSelected")
    }

    private func setupLocationUpdates() {
        locationService.onLocationUpdate = { [weak self] location in
            Task { @MainActor in
                await self?.handleLocationUpdate(location)
            }
        }
    }

    private func handleLocationUpdate(_ location: LocationSample) async {
        // Always update current location for map centering
        let coordinate = CLLocationCoordinate2D(
            latitude: location.latitude,
            longitude: location.longitude
        )
        currentLocation = coordinate

        guard runState != .notRunning else { return }

        // Add to route for map display
        routeCoordinates.append(coordinate)

        // Calculate pace
        if let pace = paceCalculator.addSample(location) {
            currentPace = pace
            totalDistance = paceCalculator.totalDistance

            // Update run state based on pace
            await updateRunState(pace: pace)
        }
    }

    private func updateRunState(pace: Double) async {
        let threshold: Double = 600 // 10:00/mi in seconds
        let hysteresis: Double = 15 // 15 second buffer

        let previousState = runState

        // Hysteresis logic
        if runState == .runningLocked && pace < (threshold - hysteresis) {
            runState = .runningUnlocked
        } else if runState == .runningUnlocked && pace > (threshold + hysteresis) {
            runState = .runningLocked
        }

        // Handle state change
        if runState != previousState {
            if runState == .runningUnlocked {
                await screenTimeService.unblockClaude()
            } else if runState == .runningLocked {
                await screenTimeService.blockClaude()
            }
        }
    }

    private func startRunTimer() {
        runTimer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            Task { @MainActor in
                if let startTime = self?.runStartTime {
                    self?.runDuration = Date().timeIntervalSince(startTime)
                }
            }
        }
    }

    private func stopRunTimer() {
        runTimer?.invalidate()
        runTimer = nil
    }

    private func startHeartbeatTimer() {
        heartbeatTimer = Timer.scheduledTimer(withTimeInterval: 5.0, repeats: true) { [weak self] _ in
            Task { @MainActor in
                await self?.sendHeartbeat()
            }
        }
    }

    private func stopHeartbeatTimer() {
        heartbeatTimer?.invalidate()
        heartbeatTimer = nil
    }

    private func sendHeartbeat() async {
        guard runState != .notRunning else { return }

        do {
            _ = try await apiService.sendHeartbeat(
                runState: runState,
                pace: currentPace,
                location: locationService.lastLocation
            )
        } catch {
            print("Heartbeat failed: \(error)")
        }
    }
}

// MARK: - Types

enum RunState: String, Codable {
    case notRunning = "NOT_RUNNING"
    case runningUnlocked = "RUNNING_UNLOCKED"
    case runningLocked = "RUNNING_LOCKED"
}

enum AppError: Error, Identifiable {
    case network(String)
    case auth(String)
    case screenTime(String)
    case location(String)

    var id: String {
        switch self {
        case .network(let msg): return "network-\(msg)"
        case .auth(let msg): return "auth-\(msg)"
        case .screenTime(let msg): return "screenTime-\(msg)"
        case .location(let msg): return "location-\(msg)"
        }
    }

    var message: String {
        switch self {
        case .network(let msg): return msg
        case .auth(let msg): return msg
        case .screenTime(let msg): return msg
        case .location(let msg): return msg
        }
    }
}
