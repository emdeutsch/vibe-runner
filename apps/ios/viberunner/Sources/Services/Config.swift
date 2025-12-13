import Foundation

enum Config {
    // MARK: - API Configuration

    /// Base URL for the viberunner API
    static var apiBaseURL: String {
        // In development, use localhost or ngrok URL
        // In production, use the deployed API URL
        ProcessInfo.processInfo.environment["VIBERUNNER_API_URL"] ?? "http://localhost:3000"
    }

    // MARK: - Supabase Configuration

    /// Supabase project URL
    static var supabaseURL: String {
        ProcessInfo.processInfo.environment["SUPABASE_URL"] ?? ""
    }

    /// Supabase anonymous key
    static var supabaseAnonKey: String {
        ProcessInfo.processInfo.environment["SUPABASE_ANON_KEY"] ?? ""
    }

    // MARK: - GitHub OAuth

    /// GitHub OAuth callback scheme (for deep linking)
    static let githubOAuthScheme = "viberunner"

    /// GitHub OAuth callback host
    static let githubOAuthHost = "github-callback"

    /// Full callback URL for GitHub OAuth
    static var githubOAuthCallbackURL: String {
        "\(githubOAuthScheme)://\(githubOAuthHost)"
    }

    // MARK: - HR Configuration

    /// Default HR threshold in BPM
    static let defaultHRThreshold = 100

    /// Minimum allowed HR threshold
    static let minHRThreshold = 50

    /// Maximum allowed HR threshold
    static let maxHRThreshold = 220

    /// HR status poll interval in seconds
    static let hrStatusPollInterval: TimeInterval = 5.0
}
