import SwiftUI
import FamilyControls

struct OnboardingView: View {
    @EnvironmentObject var appState: AppState
    @State private var currentStep = 0
    @State private var email = ""
    @State private var isLoading = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            VStack {
                TabView(selection: $currentStep) {
                    // Step 1: Welcome
                    WelcomeStep()
                        .tag(0)

                    // Step 2: Create Account
                    AccountStep(
                        email: $email,
                        isLoading: $isLoading,
                        errorMessage: $errorMessage,
                        onContinue: createAccount
                    )
                    .tag(1)

                    // Step 3: Select Claude App
                    ClaudeSelectionStep()
                        .tag(2)

                    // Step 4: Connect GitHub
                    GitHubStep()
                        .tag(3)

                    // Step 5: Done
                    CompletionStep(onComplete: completeOnboarding)
                        .tag(4)
                }
                .tabViewStyle(.page(indexDisplayMode: .never))

                // Progress dots
                HStack(spacing: 8) {
                    ForEach(0..<5) { index in
                        Circle()
                            .fill(index <= currentStep ? Color.blue : Color.gray.opacity(0.3))
                            .frame(width: 8, height: 8)
                    }
                }
                .padding(.bottom, 20)
            }
        }
    }

    private func createAccount() {
        isLoading = true
        errorMessage = nil

        Task {
            do {
                try await appState.register(email: email, deviceName: UIDevice.current.name)
                currentStep = 2
            } catch {
                errorMessage = error.localizedDescription
            }
            isLoading = false
        }
    }

    private func completeOnboarding() {
        appState.completeOnboarding()
    }
}

// MARK: - Step Views

struct WelcomeStep: View {
    var body: some View {
        VStack(spacing: 24) {
            Spacer()

            Image(systemName: "figure.run.circle.fill")
                .font(.system(size: 100))
                .foregroundStyle(.blue)

            Text("VibeRunner")
                .font(.largeTitle.bold())

            Text("Earn your code by running fast.\nBlock Claude and GitHub writes until you hit your pace.")
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
                .padding(.horizontal)

            Spacer()

            Text("Swipe to get started")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .padding()
    }
}

struct AccountStep: View {
    @Binding var email: String
    @Binding var isLoading: Bool
    @Binding var errorMessage: String?
    let onContinue: () -> Void

    var body: some View {
        VStack(spacing: 24) {
            Spacer()

            Image(systemName: "person.circle.fill")
                .font(.system(size: 80))
                .foregroundStyle(.blue)

            Text("Create Account")
                .font(.title.bold())

            Text("Enter your email to get started")
                .foregroundStyle(.secondary)

            TextField("Email", text: $email)
                .textFieldStyle(.roundedBorder)
                .textContentType(.emailAddress)
                .keyboardType(.emailAddress)
                .autocapitalization(.none)
                .padding(.horizontal, 40)

            if let error = errorMessage {
                Text(error)
                    .foregroundStyle(.red)
                    .font(.caption)
            }

            Button(action: onContinue) {
                if isLoading {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: .white))
                } else {
                    Text("Continue")
                }
            }
            .buttonStyle(.borderedProminent)
            .disabled(email.isEmpty || isLoading)

            Spacer()
        }
        .padding()
    }
}

struct ClaudeSelectionStep: View {
    @EnvironmentObject var appState: AppState
    @State private var isPickerPresented = false
    @State private var selection = FamilyActivitySelection()

    var body: some View {
        VStack(spacing: 24) {
            Spacer()

            Image(systemName: "lock.shield.fill")
                .font(.system(size: 80))
                .foregroundStyle(.orange)

            Text("Select Claude App")
                .font(.title.bold())

            Text("Choose the Claude app to block when you're running too slow")
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
                .padding(.horizontal)

            Button("Select Claude App") {
                isPickerPresented = true
            }
            .buttonStyle(.borderedProminent)

            if !selection.applicationTokens.isEmpty {
                HStack {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(.green)
                    Text("Claude app selected")
                }
            }

            Spacer()

            Text("Swipe to continue")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .padding()
        .familyActivityPicker(isPresented: $isPickerPresented, selection: $selection)
        .onChange(of: selection) { _, newValue in
            appState.screenTimeService.saveClaudeSelection(newValue)
            appState.claudeAppSelected = true
        }
        .task {
            do {
                try await appState.screenTimeService.requestAuthorization()
            } catch {
                print("Screen Time authorization failed: \(error)")
            }
        }
    }
}

struct GitHubStep: View {
    @EnvironmentObject var appState: AppState
    @State private var isLoading = false

    var body: some View {
        VStack(spacing: 24) {
            Spacer()

            Image(systemName: "network")
                .font(.system(size: 80))
                .foregroundStyle(.purple)

            Text("Connect GitHub")
                .font(.title.bold())

            Text("Connect your GitHub account to enable write gating on your repositories")
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
                .padding(.horizontal)

            Button(action: connectGitHub) {
                if isLoading {
                    ProgressView()
                } else {
                    Label("Connect GitHub", systemImage: "link")
                }
            }
            .buttonStyle(.borderedProminent)
            .disabled(isLoading)

            if appState.githubConnected {
                HStack {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(.green)
                    Text("GitHub connected")
                }
            }

            Button("Skip for now") {
                // Allow skipping GitHub connection
            }
            .foregroundStyle(.secondary)

            Spacer()

            Text("Swipe to continue")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .padding()
    }

    private func connectGitHub() {
        isLoading = true
        Task {
            do {
                let url = try await appState.apiService.getGitHubAuthURL()
                if let authURL = URL(string: url) {
                    await UIApplication.shared.open(authURL)
                }
            } catch {
                print("Failed to get GitHub auth URL: \(error)")
            }
            isLoading = false
        }
    }
}

struct CompletionStep: View {
    let onComplete: () -> Void

    var body: some View {
        VStack(spacing: 24) {
            Spacer()

            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 100))
                .foregroundStyle(.green)

            Text("You're All Set!")
                .font(.largeTitle.bold())

            Text("Start a run to unlock Claude and GitHub write access. Run faster than 10:00/mi to stay unlocked!")
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
                .padding(.horizontal)

            Spacer()

            Button("Get Started", action: onComplete)
                .buttonStyle(.borderedProminent)
                .controlSize(.large)

            Spacer()
        }
        .padding()
    }
}

#Preview {
    OnboardingView()
        .environmentObject(AppState())
}
