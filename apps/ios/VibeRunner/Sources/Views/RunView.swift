import SwiftUI

struct RunView: View {
    @EnvironmentObject var appState: AppState

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Status Banner
                StatusBanner(runState: appState.runState)

                // Main Content
                VStack(spacing: 32) {
                    Spacer()

                    // Pace Display
                    PaceDisplay(
                        pace: appState.currentPace,
                        runState: appState.runState
                    )

                    // Stats Row
                    if appState.runState != .notRunning {
                        StatsRow(
                            distance: appState.totalDistance,
                            duration: appState.runDuration
                        )
                    }

                    Spacer()

                    // Action Button
                    ActionButton(
                        runState: appState.runState,
                        onStart: { Task { await appState.startRun() } },
                        onStop: { Task { await appState.endRun() } }
                    )

                    // Open Claude Button
                    if appState.runState == .runningUnlocked {
                        Button(action: openClaude) {
                            Label("Open Claude", systemImage: "message.fill")
                        }
                        .buttonStyle(.bordered)
                    }

                    Spacer()
                }
                .padding()
            }
            .navigationTitle("VibeRunner")
            .navigationBarTitleDisplayMode(.inline)
        }
    }

    private func openClaude() {
        // Try to open Claude app
        if let url = URL(string: "anthropic://") {
            UIApplication.shared.open(url)
        }
    }
}

// MARK: - Components

struct StatusBanner: View {
    let runState: RunState

    var body: some View {
        HStack {
            Image(systemName: iconName)
            Text(statusText)
                .fontWeight(.medium)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .background(backgroundColor)
        .foregroundStyle(foregroundColor)
    }

    private var iconName: String {
        switch runState {
        case .notRunning: return "pause.circle.fill"
        case .runningUnlocked: return "checkmark.circle.fill"
        case .runningLocked: return "lock.fill"
        }
    }

    private var statusText: String {
        switch runState {
        case .notRunning: return "Not Running — GitHub Writes Blocked"
        case .runningUnlocked: return "Running Fast — All Access Granted"
        case .runningLocked: return "Too Slow — Claude Blocked"
        }
    }

    private var backgroundColor: Color {
        switch runState {
        case .notRunning: return .gray.opacity(0.2)
        case .runningUnlocked: return .green.opacity(0.2)
        case .runningLocked: return .red.opacity(0.2)
        }
    }

    private var foregroundColor: Color {
        switch runState {
        case .notRunning: return .secondary
        case .runningUnlocked: return .green
        case .runningLocked: return .red
        }
    }
}

struct PaceDisplay: View {
    let pace: Double?
    let runState: RunState

    var body: some View {
        VStack(spacing: 8) {
            Text("Current Pace")
                .font(.subheadline)
                .foregroundStyle(.secondary)

            Text(paceText)
                .font(.system(size: 72, weight: .bold, design: .rounded))
                .monospacedDigit()
                .foregroundStyle(paceColor)

            Text("/mi")
                .font(.title3)
                .foregroundStyle(.secondary)

            // Threshold indicator
            if runState != .notRunning {
                HStack(spacing: 4) {
                    Text("Target: < 10:00")
                        .font(.caption)
                        .foregroundStyle(.secondary)

                    if let pace = pace {
                        Image(systemName: pace < 600 ? "arrow.down" : "arrow.up")
                            .font(.caption)
                            .foregroundStyle(pace < 600 ? .green : .red)
                    }
                }
            }
        }
    }

    private var paceText: String {
        pace?.paceString ?? "--:--"
    }

    private var paceColor: Color {
        guard runState != .notRunning, let pace = pace else { return .primary }
        return pace < 600 ? .green : .red
    }
}

struct StatsRow: View {
    let distance: Double
    let duration: TimeInterval

    var body: some View {
        HStack(spacing: 40) {
            StatItem(title: "Distance", value: distanceText)
            StatItem(title: "Duration", value: durationText)
        }
    }

    private var distanceText: String {
        let miles = distance / 1609.344
        return String(format: "%.2f mi", miles)
    }

    private var durationText: String {
        let minutes = Int(duration) / 60
        let seconds = Int(duration) % 60
        return String(format: "%d:%02d", minutes, seconds)
    }
}

struct StatItem: View {
    let title: String
    let value: String

    var body: some View {
        VStack(spacing: 4) {
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.title2.bold())
                .monospacedDigit()
        }
    }
}

struct ActionButton: View {
    let runState: RunState
    let onStart: () -> Void
    let onStop: () -> Void

    var body: some View {
        Button(action: runState == .notRunning ? onStart : onStop) {
            HStack {
                Image(systemName: runState == .notRunning ? "play.fill" : "stop.fill")
                Text(runState == .notRunning ? "Start Run" : "End Run")
            }
            .font(.title2.bold())
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
        }
        .buttonStyle(.borderedProminent)
        .tint(runState == .notRunning ? .blue : .red)
    }
}

#Preview {
    RunView()
        .environmentObject(AppState())
}
