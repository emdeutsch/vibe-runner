import Foundation
import WatchConnectivity

@MainActor
class PhoneConnectivityService: NSObject, ObservableObject {
    static let shared = PhoneConnectivityService()

    @Published var isReachable = false
    @Published var currentThreshold: Int?

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

    // MARK: - Send Heart Rate to Phone

    func sendHeartRate(_ bpm: Int) {
        guard let session = session, session.isReachable else {
            // Try to send via application context as fallback
            try? session?.updateApplicationContext(["heartRate": bpm, "timestamp": Date().timeIntervalSince1970])
            return
        }

        session.sendMessage(["heartRate": bpm], replyHandler: { response in
            // Message sent successfully
        }) { error in
            print("Failed to send heart rate: \(error)")
        }
    }
}

// MARK: - WCSessionDelegate

extension PhoneConnectivityService: WCSessionDelegate {
    nonisolated func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        Task { @MainActor in
            self.isReachable = session.isReachable
        }

        if let error = error {
            print("WCSession activation error: \(error)")
        }
    }

    nonisolated func sessionReachabilityDidChange(_ session: WCSession) {
        Task { @MainActor in
            self.isReachable = session.isReachable
        }
    }

    // Receive messages from phone
    nonisolated func session(_ session: WCSession, didReceiveMessage message: [String : Any]) {
        Task { @MainActor in
            handleMessage(message)
        }
    }

    nonisolated func session(_ session: WCSession, didReceiveMessage message: [String : Any], replyHandler: @escaping ([String : Any]) -> Void) {
        Task { @MainActor in
            handleMessage(message)
            replyHandler(["received": true])
        }
    }

    @MainActor
    private func handleMessage(_ message: [String: Any]) {
        if let command = message["command"] as? String {
            switch command {
            case "startWorkout":
                WorkoutManager.shared.startWorkout()

            case "stopWorkout":
                WorkoutManager.shared.stopWorkout()

            case "updateThreshold":
                if let threshold = message["threshold"] as? Int {
                    currentThreshold = threshold
                }

            default:
                break
            }
        }
    }
}
