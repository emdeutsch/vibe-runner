import Foundation

// MARK: - Auth

struct RegisterRequest: Codable {
    let email: String
    let deviceName: String
}

struct RegisterResponse: Codable {
    let user: UserInfo
    let device: DeviceInfo
    let token: String
}

struct UserInfo: Codable {
    let id: String
    let email: String
    let githubUsername: String?
    let githubConnected: Bool
}

struct DeviceInfo: Codable {
    let id: String
    let name: String
}

// MARK: - GitHub

struct GitHubAuthResponse: Codable {
    let url: String
}

// MARK: - Repositories

struct RepositoryListResponse: Codable {
    let repositories: [Repository]
}

struct Repository: Codable, Identifiable {
    let id: String
    let githubRepoId: Int
    let owner: String
    let name: String
    let fullName: String
    let rulesetId: Int?
    let gatingEnabled: Bool
}

struct AvailableRepository: Codable, Identifiable {
    let id: Int
    let name: String
    let fullName: String
    let owner: String
    let `private`: Bool
    let defaultBranch: String
    let isGated: Bool
}

struct AvailableRepositoryListResponse: Codable {
    let repositories: [AvailableRepository]
}

struct AddRepositoryRequest: Codable {
    let githubRepoId: Int
    let owner: String
    let name: String
    let fullName: String
}

// MARK: - Heartbeat

struct HeartbeatRequest: Codable {
    let runState: String
    let currentPace: Double?
    let location: LocationData?
}

struct LocationData: Codable {
    let latitude: Double
    let longitude: Double
}

struct HeartbeatResponse: Codable {
    let success: Bool
    let serverTime: Int
    let stateAcknowledged: String
    let githubWritesEnabled: Bool
}

// MARK: - Session

struct SessionResponse: Codable {
    let session: SessionInfo
}

struct SessionInfo: Codable {
    let id: String
    let startedAt: Int
    let currentState: String?
    let averagePace: Double?
    let endedAt: Int?
    let duration: Int?
}

struct SessionStatusResponse: Codable {
    let device: DeviceStatus?
    let session: SessionStatusInfo?
    let githubWritesEnabled: Bool
}

struct DeviceStatus: Codable {
    let id: String
    let lastHeartbeat: Int?
    let lastRunState: String?
}

struct SessionStatusInfo: Codable {
    let id: String
    let startedAt: Int
    let currentState: String
    let averagePace: Double?
}
