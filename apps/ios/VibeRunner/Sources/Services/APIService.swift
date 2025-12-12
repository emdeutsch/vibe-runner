import Foundation

/// Service for communicating with the VibeRunner backend
class APIService {
    private let baseURL: String
    private var authToken: String?

    init(baseURL: String = "http://localhost:3000") {
        self.baseURL = baseURL
    }

    func setAuthToken(_ token: String) {
        self.authToken = token
    }

    // MARK: - Auth

    func register(email: String, deviceName: String) async throws -> RegisterResponse {
        let request = RegisterRequest(email: email, deviceName: deviceName)
        return try await post("/auth/register", body: request)
    }

    func getCurrentUser() async throws -> UserInfo {
        return try await get("/auth/me")
    }

    func getGitHubAuthURL() async throws -> String {
        let response: GitHubAuthResponse = try await get("/auth/github")
        return response.url
    }

    // MARK: - Repositories

    func getAvailableRepos() async throws -> [AvailableRepository] {
        let response: AvailableRepositoryListResponse = try await get("/repos/available")
        return response.repositories
    }

    func getGatedRepos() async throws -> [Repository] {
        let response: RepositoryListResponse = try await get("/repos")
        return response.repositories
    }

    func addRepo(_ repo: AvailableRepository) async throws -> Repository {
        let request = AddRepositoryRequest(
            githubRepoId: repo.id,
            owner: repo.owner,
            name: repo.name,
            fullName: repo.fullName
        )
        let response: RepositoryResponse = try await post("/repos", body: request)
        return response.repository
    }

    func removeRepo(id: String) async throws {
        try await delete("/repos/\(id)")
    }

    // MARK: - Heartbeat

    func sendHeartbeat(runState: RunState, pace: Double?, location: LocationSample?) async throws -> HeartbeatResponse {
        let request = HeartbeatRequest(
            runState: runState.rawValue,
            currentPace: pace,
            location: location.map { LocationData(latitude: $0.latitude, longitude: $0.longitude) }
        )
        return try await post("/heartbeat", body: request)
    }

    func startRun() async throws -> SessionInfo {
        let response: SessionResponse = try await post("/heartbeat/start", body: EmptyBody())
        return response.session
    }

    func endRun() async throws -> SessionInfo {
        let response: SessionResponse = try await post("/heartbeat/end", body: EmptyBody())
        return response.session
    }

    func getSessionStatus() async throws -> SessionStatusResponse {
        return try await get("/heartbeat/status")
    }

    // MARK: - HTTP Methods

    private func get<T: Decodable>(_ path: String) async throws -> T {
        let url = URL(string: baseURL + path)!
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        addAuthHeader(&request)
        return try await execute(request)
    }

    private func post<T: Decodable, B: Encodable>(_ path: String, body: B) async throws -> T {
        let url = URL(string: baseURL + path)!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(body)
        addAuthHeader(&request)
        return try await execute(request)
    }

    private func delete(_ path: String) async throws {
        let url = URL(string: baseURL + path)!
        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        addAuthHeader(&request)
        let _: EmptyResponse = try await execute(request)
    }

    private func addAuthHeader(_ request: inout URLRequest) {
        if let token = authToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
    }

    private func execute<T: Decodable>(_ request: URLRequest) async throws -> T {
        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            if let errorResponse = try? JSONDecoder().decode(ErrorResponse.self, from: data) {
                throw APIError.serverError(errorResponse.error)
            }
            throw APIError.httpError(httpResponse.statusCode)
        }

        return try JSONDecoder().decode(T.self, from: data)
    }
}

// MARK: - Supporting Types

struct EmptyBody: Encodable {}
struct EmptyResponse: Decodable {}
struct ErrorResponse: Decodable {
    let error: String
}

struct RepositoryResponse: Decodable {
    let repository: Repository
}

enum APIError: Error, LocalizedError {
    case invalidResponse
    case httpError(Int)
    case serverError(String)

    var errorDescription: String? {
        switch self {
        case .invalidResponse:
            return "Invalid response from server"
        case .httpError(let code):
            return "HTTP error: \(code)"
        case .serverError(let message):
            return message
        }
    }
}
