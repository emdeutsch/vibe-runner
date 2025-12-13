import Foundation
import Supabase

@MainActor
class AuthService: ObservableObject {
    static let shared = AuthService()

    @Published var isAuthenticated = false
    @Published var currentUser: User?
    @Published var isLoading = false
    @Published var error: String?

    private var supabase: SupabaseClient?

    private init() {
        setupSupabase()
        Task {
            await checkSession()
        }
    }

    private func setupSupabase() {
        guard !Config.supabaseURL.isEmpty, !Config.supabaseAnonKey.isEmpty else {
            print("Warning: Supabase configuration missing")
            return
        }

        supabase = SupabaseClient(
            supabaseURL: URL(string: Config.supabaseURL)!,
            supabaseKey: Config.supabaseAnonKey
        )
    }

    // MARK: - Session Management

    func checkSession() async {
        guard let supabase = supabase else { return }

        do {
            let session = try await supabase.auth.session
            currentUser = session.user
            isAuthenticated = true
        } catch {
            currentUser = nil
            isAuthenticated = false
        }
    }

    var accessToken: String? {
        get async {
            guard let supabase = supabase else { return nil }
            do {
                let session = try await supabase.auth.session
                return session.accessToken
            } catch {
                return nil
            }
        }
    }

    // MARK: - GitHub Sign In

    func signInWithGitHub() async throws {
        guard let supabase = supabase else {
            throw AuthError.notConfigured
        }

        isLoading = true
        error = nil

        do {
            let url = try await supabase.auth.getOAuthSignInURL(
                provider: .github,
                redirectTo: URL(string: Config.githubOAuthCallbackURL)
            )

            // Open the URL in Safari
            await MainActor.run {
                UIApplication.shared.open(url)
            }
        } catch {
            self.error = error.localizedDescription
            isLoading = false
            throw error
        }
    }

    func handleOAuthCallback(url: URL) async throws {
        guard let supabase = supabase else {
            throw AuthError.notConfigured
        }

        isLoading = true
        error = nil

        do {
            let session = try await supabase.auth.session(from: url)
            currentUser = session.user
            isAuthenticated = true
            isLoading = false
        } catch {
            self.error = error.localizedDescription
            isLoading = false
            throw error
        }
    }

    // MARK: - Email/Password Auth

    func signIn(email: String, password: String) async throws {
        guard let supabase = supabase else {
            throw AuthError.notConfigured
        }

        isLoading = true
        error = nil

        do {
            let session = try await supabase.auth.signIn(email: email, password: password)
            currentUser = session.user
            isAuthenticated = true
            isLoading = false
        } catch {
            self.error = error.localizedDescription
            isLoading = false
            throw error
        }
    }

    func signUp(email: String, password: String) async throws {
        guard let supabase = supabase else {
            throw AuthError.notConfigured
        }

        isLoading = true
        error = nil

        do {
            let result = try await supabase.auth.signUp(email: email, password: password)
            if let session = result.session {
                currentUser = session.user
                isAuthenticated = true
            }
            isLoading = false
        } catch {
            self.error = error.localizedDescription
            isLoading = false
            throw error
        }
    }

    // MARK: - Sign Out

    func signOut() async throws {
        guard let supabase = supabase else {
            throw AuthError.notConfigured
        }

        do {
            try await supabase.auth.signOut()
            currentUser = nil
            isAuthenticated = false
        } catch {
            self.error = error.localizedDescription
            throw error
        }
    }
}

// MARK: - Auth Errors

enum AuthError: LocalizedError {
    case notConfigured
    case invalidCredentials
    case unknown(Error)

    var errorDescription: String? {
        switch self {
        case .notConfigured:
            return "Authentication is not configured"
        case .invalidCredentials:
            return "Invalid email or password"
        case .unknown(let error):
            return error.localizedDescription
        }
    }
}
