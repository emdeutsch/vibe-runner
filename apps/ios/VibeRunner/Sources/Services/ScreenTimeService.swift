import Foundation
import FamilyControls
import ManagedSettings
import DeviceActivity

/// Service for managing Screen Time shields on the Claude app
@MainActor
class ScreenTimeService: ObservableObject {
    private let center = AuthorizationCenter.shared
    private let store = ManagedSettingsStore()

    @Published var isAuthorized = false
    @Published var claudeAppSelection: FamilyActivitySelection = FamilyActivitySelection()
    @Published var isClaudeBlocked = false

    init() {
        checkAuthorization()
    }

    /// Check current authorization status
    func checkAuthorization() {
        isAuthorized = center.authorizationStatus == .approved
    }

    /// Request Screen Time authorization
    func requestAuthorization() async throws {
        try await center.requestAuthorization(for: .individual)
        checkAuthorization()
    }

    /// Save the selected Claude app
    func saveClaudeSelection(_ selection: FamilyActivitySelection) {
        claudeAppSelection = selection
        // Persist the selection
        if let encoded = try? JSONEncoder().encode(selection) {
            UserDefaults.standard.set(encoded, forKey: "claudeAppSelection")
        }
        UserDefaults.standard.set(true, forKey: "claudeAppSelected")
    }

    /// Load saved Claude app selection
    func loadClaudeSelection() {
        if let data = UserDefaults.standard.data(forKey: "claudeAppSelection"),
           let selection = try? JSONDecoder().decode(FamilyActivitySelection.self, from: data) {
            claudeAppSelection = selection
        }
    }

    /// Block the Claude app using Screen Time shield
    func blockClaude() async {
        guard isAuthorized && !claudeAppSelection.applicationTokens.isEmpty else { return }

        // Apply shield to selected apps
        store.shield.applications = claudeAppSelection.applicationTokens
        store.shield.applicationCategories = .specific(claudeAppSelection.categoryTokens)

        isClaudeBlocked = true
    }

    /// Remove the shield from Claude app
    func unblockClaude() async {
        store.shield.applications = nil
        store.shield.applicationCategories = nil

        isClaudeBlocked = false
    }

    /// Check if Claude is currently blocked
    var claudeIsBlocked: Bool {
        store.shield.applications != nil
    }
}

// MARK: - FamilyActivitySelection Codable Extension

extension FamilyActivitySelection: Codable {
    enum CodingKeys: String, CodingKey {
        case applicationTokens
        case categoryTokens
        case webDomainTokens
    }

    public init(from decoder: Decoder) throws {
        self.init()
        let container = try decoder.container(keyedBy: CodingKeys.self)

        // Decode tokens - note: actual token decoding requires proper setup
        // This is a simplified version for demonstration
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        // Encode tokens
        try container.encode(applicationTokens.count, forKey: .applicationTokens)
        try container.encode(categoryTokens.count, forKey: .categoryTokens)
        try container.encode(webDomainTokens.count, forKey: .webDomainTokens)
    }
}
