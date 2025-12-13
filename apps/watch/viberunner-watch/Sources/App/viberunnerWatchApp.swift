import SwiftUI

@main
struct viberunnerWatchApp: App {
    @StateObject private var workoutManager = WorkoutManager.shared
    @StateObject private var phoneConnectivity = PhoneConnectivityService.shared

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(workoutManager)
                .environmentObject(phoneConnectivity)
        }
    }
}
