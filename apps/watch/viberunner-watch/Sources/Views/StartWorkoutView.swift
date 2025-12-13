import SwiftUI

struct StartWorkoutView: View {
    @EnvironmentObject var workoutManager: WorkoutManager
    @EnvironmentObject var phoneConnectivity: PhoneConnectivityService

    var body: some View {
        VStack(spacing: 20) {
            // App icon
            Image(systemName: "heart.circle.fill")
                .font(.system(size: 50))
                .foregroundStyle(.red)

            Text("viberunner")
                .font(.headline)

            // Phone connection status
            HStack(spacing: 4) {
                Circle()
                    .fill(phoneConnectivity.isReachable ? .green : .orange)
                    .frame(width: 8, height: 8)

                Text(phoneConnectivity.isReachable ? "Phone Connected" : "Phone Not Reachable")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            // Start button
            Button {
                workoutManager.startWorkout()
            } label: {
                HStack {
                    Image(systemName: "play.fill")
                    Text("Start")
                }
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .tint(.green)

            // Threshold info
            if let threshold = phoneConnectivity.currentThreshold {
                Text("Threshold: \(threshold) BPM")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
        .padding()
        .navigationTitle("viberunner")
        .navigationBarTitleDisplayMode(.inline)
    }
}

#Preview {
    StartWorkoutView()
        .environmentObject(WorkoutManager.shared)
        .environmentObject(PhoneConnectivityService.shared)
}
