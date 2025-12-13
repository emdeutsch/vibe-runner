import SwiftUI

struct ActiveWorkoutView: View {
    @EnvironmentObject var workoutManager: WorkoutManager
    @EnvironmentObject var phoneConnectivity: PhoneConnectivityService

    var body: some View {
        VStack(spacing: 16) {
            // HR display
            VStack(spacing: 4) {
                HStack(alignment: .firstTextBaseline, spacing: 2) {
                    Text("\(workoutManager.currentHeartRate)")
                        .font(.system(size: 60, weight: .bold, design: .rounded))
                        .foregroundStyle(isAboveThreshold ? .green : .red)

                    Text("BPM")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                // Status indicator
                HStack(spacing: 4) {
                    Circle()
                        .fill(isAboveThreshold ? .green : .red)
                        .frame(width: 8, height: 8)

                    Text(isAboveThreshold ? "Unlocked" : "Locked")
                        .font(.caption2)
                        .fontWeight(.semibold)
                        .foregroundStyle(isAboveThreshold ? .green : .red)
                }
            }

            // Workout duration
            Text(workoutManager.elapsedTimeString)
                .font(.caption)
                .foregroundStyle(.secondary)

            Spacer()

            // Stop button
            Button(role: .destructive) {
                workoutManager.stopWorkout()
            } label: {
                HStack {
                    Image(systemName: "stop.fill")
                    Text("Stop")
                }
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .tint(.red)

            // Phone sync status
            HStack(spacing: 4) {
                Image(systemName: phoneConnectivity.isReachable ? "iphone.radiowaves.left.and.right" : "iphone.slash")
                    .font(.caption2)

                Text(phoneConnectivity.isReachable ? "Syncing" : "Not Synced")
                    .font(.caption2)
            }
            .foregroundStyle(.secondary)
        }
        .padding()
        .navigationTitle("Workout")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var isAboveThreshold: Bool {
        let threshold = phoneConnectivity.currentThreshold ?? 100
        return workoutManager.currentHeartRate >= threshold
    }
}

#Preview {
    ActiveWorkoutView()
        .environmentObject(WorkoutManager.shared)
        .environmentObject(PhoneConnectivityService.shared)
}
