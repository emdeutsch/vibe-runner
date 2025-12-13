import Foundation

// MARK: - Profile

struct Profile: Codable {
    let userId: String
    let hrThresholdBpm: Int
    let githubConnected: Bool
    let githubUsername: String?

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case hrThresholdBpm = "hr_threshold_bpm"
        case githubConnected = "github_connected"
        case githubUsername = "github_username"
    }
}

// MARK: - HR Status

struct HRStatus: Codable {
    let bpm: Int
    let thresholdBpm: Int
    let hrOk: Bool
    let expiresAt: String
    let toolsUnlocked: Bool

    enum CodingKeys: String, CodingKey {
        case bpm
        case thresholdBpm = "threshold_bpm"
        case hrOk = "hr_ok"
        case expiresAt = "expires_at"
        case toolsUnlocked = "tools_unlocked"
    }
}

// MARK: - Workout Session

struct WorkoutSession: Codable {
    let sessionId: String
    let startedAt: String

    enum CodingKeys: String, CodingKey {
        case sessionId = "session_id"
        case startedAt = "started_at"
    }
}

struct ActiveWorkout: Codable {
    let active: Bool
    let sessionId: String?
    let startedAt: String?
    let source: String?

    enum CodingKeys: String, CodingKey {
        case active
        case sessionId = "session_id"
        case startedAt = "started_at"
        case source
    }
}

// MARK: - Gate Repo

struct GateRepo: Codable, Identifiable {
    let id: String
    let owner: String
    let name: String
    let userKey: String
    let signalRef: String
    let active: Bool
    let githubAppInstalled: Bool
    let createdAt: String

    enum CodingKeys: String, CodingKey {
        case id, owner, name, active
        case userKey = "user_key"
        case signalRef = "signal_ref"
        case githubAppInstalled = "github_app_installed"
        case createdAt = "created_at"
    }

    var fullName: String {
        "\(owner)/\(name)"
    }
}

struct CreateGateRepoResponse: Codable {
    let id: String
    let owner: String
    let name: String
    let userKey: String
    let signalRef: String
    let htmlUrl: String
    let needsAppInstall: Bool

    enum CodingKeys: String, CodingKey {
        case id, owner, name
        case userKey = "user_key"
        case signalRef = "signal_ref"
        case htmlUrl = "html_url"
        case needsAppInstall = "needs_app_install"
    }
}

struct GateReposResponse: Codable {
    let repos: [GateRepo]
}

// MARK: - GitHub

struct GitHubOAuthStart: Codable {
    let authorizationUrl: String
    let state: String

    enum CodingKeys: String, CodingKey {
        case authorizationUrl = "authorization_url"
        case state
    }
}

struct GitHubStatus: Codable {
    let connected: Bool
    let username: String?
    let scopes: [String]?
    let updatedAt: String?

    enum CodingKeys: String, CodingKey {
        case connected, username, scopes
        case updatedAt = "updated_at"
    }
}

struct GitHubRepo: Codable, Identifiable {
    let id: Int
    let fullName: String
    let name: String
    let owner: String
    let isPrivate: Bool
    let htmlUrl: String
    let description: String?
    let updatedAt: String?

    enum CodingKeys: String, CodingKey {
        case id, name, owner, description
        case fullName = "full_name"
        case isPrivate = "private"
        case htmlUrl = "html_url"
        case updatedAt = "updated_at"
    }
}

// MARK: - API Responses

struct ErrorResponse: Codable {
    let error: String
}

struct ThresholdUpdateResponse: Codable {
    let hrThresholdBpm: Int
    let updatedAt: String

    enum CodingKeys: String, CodingKey {
        case hrThresholdBpm = "hr_threshold_bpm"
        case updatedAt = "updated_at"
    }
}

struct InstallUrlResponse: Codable {
    let installUrl: String
    let owner: String
    let name: String

    enum CodingKeys: String, CodingKey {
        case installUrl = "install_url"
        case owner, name
    }
}
