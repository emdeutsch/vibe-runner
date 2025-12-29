import SwiftUI

// MARK: - Spacing Scale

enum Spacing {
    static let xs: CGFloat = 4
    static let sm: CGFloat = 8
    static let md: CGFloat = 16
    static let lg: CGFloat = 24
    static let xl: CGFloat = 32
    static let xxl: CGFloat = 48
}

// MARK: - Corner Radius Scale

enum Radius {
    static let sm: CGFloat = 8
    static let md: CGFloat = 12
    static let lg: CGFloat = 16
    static let xl: CGFloat = 24
}

// MARK: - Semantic Colors

extension Color {
    // Status colors
    static let statusSuccess = Color.green
    static let statusError = Color.red
    static let statusWarning = Color.orange

    // Heart rate specific
    static let hrAboveThreshold = Color.green
    static let hrBelowThreshold = Color.red
    static let hrNeutral = Color.secondary

    // Brand - Orange/Amber scheme (used in authenticated experience)
    static let brandPrimary = Color(red: 1.0, green: 0.45, blue: 0.0) // Vibrant orange
    static let brandAccent = Color(red: 1.0, green: 0.6, blue: 0.0)   // Amber/gold
    static let brandDark = Color(red: 0.85, green: 0.35, blue: 0.0)   // Darker orange for contrast

    // MARK: - Light Theme (Instagram-style)

    // Backgrounds
    static let backgroundPrimary = Color.white
    static let backgroundSecondary = Color(red: 0.98, green: 0.98, blue: 0.98) // #FAFAFA

    // Text
    static let textPrimary = Color(red: 0.15, green: 0.15, blue: 0.15) // #262626
    static let textSecondary = Color(red: 0.55, green: 0.55, blue: 0.55) // #8E8E8E
    static let textTertiary = Color(red: 0.73, green: 0.73, blue: 0.73) // #BABABA

    // Borders & Dividers
    static let borderLight = Color(red: 0.86, green: 0.86, blue: 0.86) // #DBDBDB

    // Interactive
    static let buttonPrimary = Color(red: 0.01, green: 0.60, blue: 0.95) // #0095F6 (Instagram blue)
    static let buttonPrimaryDisabled = Color(red: 0.01, green: 0.60, blue: 0.95).opacity(0.4)
}

// MARK: - Gradients

extension LinearGradient {
    static let brandGradient = LinearGradient(
        colors: [
            Color.brandPrimary.opacity(0.9),
            Color.brandAccent.opacity(0.7)
        ],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )

    static let subtleBackground = LinearGradient(
        colors: [
            Color.brandPrimary.opacity(0.08),
            Color.clear,
            Color.brandPrimary.opacity(0.03)
        ],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )
}

// MARK: - Bundle Extensions

extension Bundle {
    var appVersion: String {
        infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0"
    }

    var buildNumber: String {
        infoDictionary?["CFBundleVersion"] as? String ?? "1"
    }
}
