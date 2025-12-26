import SwiftUI

/// Main HR monitoring view - shows current heart rate and sync status
/// Uses ScrollView + VStack for proper watchOS layout that adapts to all screen sizes
struct HRMonitorView: View {
    @EnvironmentObject var workoutManager: WorkoutManager
    @EnvironmentObject var phoneConnectivity: PhoneConnectivityService

    // Animation state for pulsing heart
    @State private var isPulsing = false
    // Track if we've shown the first reading (for animation)
    @State private var hasShownFirstReading = false

    /// Whether we're waiting for the first HR reading
    private var isWaitingForReading: Bool {
        workoutManager.isMonitoring && workoutManager.currentHeartRate == 0
    }

    /// Whether we have a valid HR reading to display
    private var hasValidReading: Bool {
        workoutManager.isMonitoring && workoutManager.currentHeartRate > 0
    }

    var body: some View {
        // ScrollView ensures content is accessible on all watch sizes (40mm-49mm)
        ScrollView {
            VStack(spacing: 8) {
                // Phone workout indicator (when phone has active workout)
                if workoutManager.isPhoneWorkoutActive {
                    HStack(spacing: 4) {
                        Image(systemName: "figure.run")
                            .font(.caption2)
                        Text("Workout Active")
                            .font(.caption2)
                            .fontWeight(.medium)
                    }
                    .foregroundStyle(.green)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 2)
                    .background(
                        Capsule()
                            .fill(.green.opacity(0.2))
                    )
                }

                Spacer()
                    .frame(minHeight: 4, maxHeight: 20)

                // HR display - centered content
                VStack(spacing: 4) {
                    if hasValidReading {
                        // Heart rate with BPM - uses dynamic sizing
                        HStack(alignment: .firstTextBaseline, spacing: 2) {
                            Text("\(workoutManager.currentHeartRate)")
                                .font(.system(size: 56, weight: .bold, design: .rounded))
                                .foregroundStyle(heartRateColor)
                                .contentTransition(.numericText())
                                .minimumScaleFactor(0.6)
                                .lineLimit(1)

                            Text("BPM")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        .transition(.scale.combined(with: .opacity))

                        // Status indicator (only show when phone workout is active)
                        if workoutManager.isPhoneWorkoutActive {
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
                    } else if isWaitingForReading {
                        // Monitoring started but waiting for first reading
                        pulsingHeartView
                            .transition(.opacity)

                        Text("Reading...")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    } else {
                        // Not monitoring yet - show connecting state
                        pulsingHeartView
                            .transition(.opacity)

                        Text("Connecting...")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                .animation(.easeInOut(duration: 0.3), value: hasValidReading)
                .animation(.easeInOut(duration: 0.3), value: isWaitingForReading)

                Spacer()
                    .frame(minHeight: 4, maxHeight: 20)

                // Phone sync status
                phoneSyncStatusView
            }
            .frame(maxWidth: .infinity)
        }
        .onAppear {
            startPulsingAnimation()
        }
        .onChange(of: workoutManager.currentHeartRate) { _, newValue in
            if newValue > 0 && !hasShownFirstReading {
                hasShownFirstReading = true
            }
        }
    }

    /// Pulsing heart animation view - sized to match HR display
    private var pulsingHeartView: some View {
        Image(systemName: "heart.fill")
            .font(.system(size: 48))
            .foregroundStyle(.red)
            .scaleEffect(isPulsing ? 1.1 : 1.0)
            .opacity(isPulsing ? 1.0 : 0.7)
            .animation(
                .easeInOut(duration: 0.8)
                .repeatForever(autoreverses: true),
                value: isPulsing
            )
    }

    private func startPulsingAnimation() {
        isPulsing = true
    }

    private var isAboveThreshold: Bool {
        let threshold = phoneConnectivity.currentThreshold ?? workoutManager.threshold
        return workoutManager.currentHeartRate >= threshold
    }

    private var heartRateColor: Color {
        if workoutManager.currentHeartRate == 0 {
            return .secondary
        }
        // Only show red/green based on threshold when phone workout is active
        if workoutManager.isPhoneWorkoutActive {
            return isAboveThreshold ? .green : .red
        }
        // Otherwise just show red (heart color) for passive monitoring
        return .red
    }

    /// Connected = mirroring active (best) OR reachable OR monitoring
    private var isConnectedToPhone: Bool {
        // Mirroring is the most reliable - works even when screen dims
        workoutManager.isMirroringActive || phoneConnectivity.isReachable || workoutManager.isMonitoring
    }

    /// Phone sync status view - show connected when data is flowing
    private var phoneSyncStatusView: some View {
        HStack(spacing: 4) {
            Image(systemName: isConnectedToPhone ? "iphone.radiowaves.left.and.right" : "iphone.slash")
                .font(.caption2)
            Text(isConnectedToPhone ? "Connected" : "Not Connected")
                .font(.caption2)
        }
        .foregroundStyle(isConnectedToPhone ? .green : .secondary)
    }
}

#Preview {
    HRMonitorView()
        .environmentObject(WorkoutManager.shared)
        .environmentObject(PhoneConnectivityService.shared)
}
