import SwiftUI

struct ContentView: View {
    @EnvironmentObject var workoutManager: WorkoutManager
    @EnvironmentObject var phoneConnectivity: PhoneConnectivityService

    var body: some View {
        HRMonitorView()
            .onAppear {
                // Request authorization and start monitoring when view appears
                workoutManager.requestAuthorizationIfNeeded()
            }
    }
}

#Preview {
    ContentView()
        .environmentObject(WorkoutManager.shared)
        .environmentObject(PhoneConnectivityService.shared)
}
