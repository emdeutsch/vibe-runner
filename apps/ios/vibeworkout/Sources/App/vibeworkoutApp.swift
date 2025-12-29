import SwiftUI

@main
struct vibeworkoutApp: App {
    @StateObject private var authService = AuthService.shared
    @StateObject private var apiService = APIService.shared
    @StateObject private var workoutService = WorkoutService.shared
    @StateObject private var watchConnectivity = WatchConnectivityService.shared

    @State private var showSplash = true

    var body: some Scene {
        WindowGroup {
            ZStack {
                ContentView()
                    .environmentObject(authService)
                    .environmentObject(apiService)
                    .environmentObject(workoutService)
                    .environmentObject(watchConnectivity)
                    .onAppear {
                        // Request HealthKit authorization for workout session mirroring
                        watchConnectivity.requestHealthKitAuthorization()
                        // Attempt to wake watch app for HR monitoring
                        watchConnectivity.requestWatchAppLaunch()
                    }

                if showSplash {
                    SplashView(isActive: $showSplash)
                        .transition(.opacity)
                        .zIndex(1)
                }
            }
        }
    }
}
