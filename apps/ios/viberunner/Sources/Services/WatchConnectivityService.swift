import Foundation
import WatchConnectivity

@MainActor
class WatchConnectivityService: NSObject, ObservableObject {
    static let shared = WatchConnectivityService()

    @Published var isReachable = false
    @Published var isWatchAppInstalled = false
    @Published var lastReceivedBPM: Int?

    private var session: WCSession?

    override private init() {
        super.init()
        setupSession()
    }

    private func setupSession() {
        guard WCSession.isSupported() else {
            print("WatchConnectivity not supported")
            return
        }

        session = WCSession.default
        session?.delegate = self
        session?.activate()
    }

    // MARK: - Send Commands to Watch

    func sendStartWorkout() {
        guard let session = session, session.isReachable else {
            print("Watch not reachable")
            return
        }

        session.sendMessage(["command": "startWorkout"], replyHandler: nil) { error in
            print("Failed to send startWorkout: \(error)")
        }
    }

    func sendStopWorkout() {
        guard let session = session, session.isReachable else {
            print("Watch not reachable")
            return
        }

        session.sendMessage(["command": "stopWorkout"], replyHandler: nil) { error in
            print("Failed to send stopWorkout: \(error)")
        }
    }

    func sendThresholdUpdate(_ threshold: Int) {
        guard let session = session, session.isReachable else {
            print("Watch not reachable")
            return
        }

        session.sendMessage(["command": "updateThreshold", "threshold": threshold], replyHandler: nil) { error in
            print("Failed to send threshold update: \(error)")
        }
    }
}

// MARK: - WCSessionDelegate

extension WatchConnectivityService: WCSessionDelegate {
    nonisolated func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        Task { @MainActor in
            self.isWatchAppInstalled = session.isWatchAppInstalled
            self.isReachable = session.isReachable
        }

        if let error = error {
            print("WCSession activation error: \(error)")
        }
    }

    nonisolated func sessionDidBecomeInactive(_ session: WCSession) {
        Task { @MainActor in
            self.isReachable = false
        }
    }

    nonisolated func sessionDidDeactivate(_ session: WCSession) {
        Task { @MainActor in
            self.isReachable = false
        }
        // Reactivate for switching watches
        session.activate()
    }

    nonisolated func sessionReachabilityDidChange(_ session: WCSession) {
        Task { @MainActor in
            self.isReachable = session.isReachable
        }
    }

    // Receive messages from watch
    nonisolated func session(_ session: WCSession, didReceiveMessage message: [String : Any]) {
        Task { @MainActor in
            if let bpm = message["heartRate"] as? Int {
                self.lastReceivedBPM = bpm

                // Forward to workout service
                await WorkoutService.shared.ingestHeartRate(bpm)
            }
        }
    }

    // Receive messages with reply handler
    nonisolated func session(_ session: WCSession, didReceiveMessage message: [String : Any], replyHandler: @escaping ([String : Any]) -> Void) {
        Task { @MainActor in
            if let bpm = message["heartRate"] as? Int {
                self.lastReceivedBPM = bpm
                await WorkoutService.shared.ingestHeartRate(bpm)
                replyHandler(["received": true])
            } else {
                replyHandler(["received": false])
            }
        }
    }
}
