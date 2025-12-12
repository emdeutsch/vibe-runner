import SwiftUI
import FamilyControls

struct SettingsView: View {
    @EnvironmentObject var appState: AppState
    @State private var isClaudePickerPresented = false
    @State private var claudeSelection = FamilyActivitySelection()

    var body: some View {
        NavigationStack {
            List {
                // Account Section
                Section("Account") {
                    if appState.isAuthenticated {
                        LabeledContent("Email", value: "Connected")
                    } else {
                        Text("Not signed in")
                            .foregroundStyle(.secondary)
                    }
                }

                // Claude App Section
                Section("Claude App") {
                    Button(action: { isClaudePickerPresented = true }) {
                        HStack {
                            Label("Select Claude App", systemImage: "app.badge")
                            Spacer()
                            if appState.claudeAppSelected {
                                Image(systemName: "checkmark")
                                    .foregroundStyle(.green)
                            }
                        }
                    }

                    HStack {
                        Text("Status")
                        Spacer()
                        Text(appState.screenTimeService.isClaudeBlocked ? "Blocked" : "Allowed")
                            .foregroundStyle(appState.screenTimeService.isClaudeBlocked ? .red : .green)
                    }
                }

                // GitHub Section
                Section("GitHub") {
                    if appState.githubConnected {
                        HStack {
                            Label("Connected", systemImage: "checkmark.circle.fill")
                                .foregroundStyle(.green)
                            Spacer()
                            Button("Disconnect") {
                                // TODO: Disconnect GitHub
                            }
                            .foregroundStyle(.red)
                        }

                        NavigationLink {
                            RepositoriesView()
                        } label: {
                            Label("Manage Repositories", systemImage: "folder")
                        }
                    } else {
                        Button(action: connectGitHub) {
                            Label("Connect GitHub", systemImage: "link")
                        }
                    }
                }

                // Pace Settings Section
                Section("Pace Settings") {
                    HStack {
                        Text("Threshold")
                        Spacer()
                        Text("10:00 /mi")
                            .foregroundStyle(.secondary)
                    }

                    HStack {
                        Text("Hysteresis")
                        Spacer()
                        Text("± 15 sec")
                            .foregroundStyle(.secondary)
                    }
                }

                // About Section
                Section("About") {
                    LabeledContent("Version", value: "0.1.0")

                    Link(destination: URL(string: "https://github.com/your-org/viberunner")!) {
                        Label("View on GitHub", systemImage: "link")
                    }
                }
            }
            .navigationTitle("Settings")
            .familyActivityPicker(isPresented: $isClaudePickerPresented, selection: $claudeSelection)
            .onChange(of: claudeSelection) { _, newValue in
                appState.screenTimeService.saveClaudeSelection(newValue)
                appState.claudeAppSelected = true
            }
        }
    }

    private func connectGitHub() {
        Task {
            do {
                let url = try await appState.apiService.getGitHubAuthURL()
                if let authURL = URL(string: url) {
                    await UIApplication.shared.open(authURL)
                }
            } catch {
                print("Failed to get GitHub auth URL: \(error)")
            }
        }
    }
}

// MARK: - Repositories View

struct RepositoriesView: View {
    @EnvironmentObject var appState: AppState
    @State private var availableRepos: [AvailableRepository] = []
    @State private var gatedRepos: [Repository] = []
    @State private var isLoading = false

    var body: some View {
        List {
            Section("Gated Repositories") {
                if gatedRepos.isEmpty {
                    Text("No repositories configured")
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(gatedRepos) { repo in
                        HStack {
                            VStack(alignment: .leading) {
                                Text(repo.fullName)
                                    .fontWeight(.medium)
                                Text("Write gating enabled")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            Image(systemName: "lock.fill")
                                .foregroundStyle(.orange)
                        }
                    }
                    .onDelete(perform: removeRepo)
                }
            }

            Section("Add Repository") {
                if isLoading {
                    ProgressView()
                } else if availableRepos.isEmpty {
                    Text("No repositories available")
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(availableRepos.filter { !$0.isGated }) { repo in
                        Button(action: { addRepo(repo) }) {
                            HStack {
                                VStack(alignment: .leading) {
                                    Text(repo.fullName)
                                        .fontWeight(.medium)
                                    Text(repo.private ? "Private" : "Public")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                                Spacer()
                                Image(systemName: "plus.circle")
                                    .foregroundStyle(.blue)
                            }
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
        .navigationTitle("Repositories")
        .task {
            await loadRepos()
        }
        .refreshable {
            await loadRepos()
        }
    }

    private func loadRepos() async {
        isLoading = true
        do {
            async let available = appState.apiService.getAvailableRepos()
            async let gated = appState.apiService.getGatedRepos()
            availableRepos = try await available
            gatedRepos = try await gated
        } catch {
            print("Failed to load repos: \(error)")
        }
        isLoading = false
    }

    private func addRepo(_ repo: AvailableRepository) {
        Task {
            do {
                let added = try await appState.apiService.addRepo(repo)
                gatedRepos.append(added)
                // Mark as gated in available list
                if let index = availableRepos.firstIndex(where: { $0.id == repo.id }) {
                    availableRepos[index] = AvailableRepository(
                        id: repo.id,
                        name: repo.name,
                        fullName: repo.fullName,
                        owner: repo.owner,
                        private: repo.private,
                        defaultBranch: repo.defaultBranch,
                        isGated: true
                    )
                }
            } catch {
                print("Failed to add repo: \(error)")
            }
        }
    }

    private func removeRepo(at offsets: IndexSet) {
        for index in offsets {
            let repo = gatedRepos[index]
            Task {
                do {
                    try await appState.apiService.removeRepo(id: repo.id)
                    await MainActor.run {
                        gatedRepos.remove(at: index)
                    }
                } catch {
                    print("Failed to remove repo: \(error)")
                }
            }
        }
    }
}

#Preview {
    SettingsView()
        .environmentObject(AppState())
}
