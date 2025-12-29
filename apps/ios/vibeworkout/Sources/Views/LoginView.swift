import SwiftUI
import os.log

private let logger = Logger(subsystem: "com.vibeworkout.app", category: "LoginView")

struct LoginView: View {
    @EnvironmentObject var authService: AuthService

    @State private var email = ""
    @State private var password = ""
    @State private var isSignUp = false

    // Animation states
    @State private var contentAppeared = false

    var body: some View {
        GeometryReader { geometry in
            ScrollView(showsIndicators: false) {
                VStack(spacing: 0) {
                    // Top spacing - generous whitespace
                    Spacer()
                        .frame(height: geometry.size.height * 0.12)

                    // Logo section
                    logoSection
                        .opacity(contentAppeared ? 1 : 0)
                        .offset(y: contentAppeared ? 0 : -10)

                    Spacer()
                        .frame(height: Spacing.xxl)

                    // Auth section
                    authSection
                        .opacity(contentAppeared ? 1 : 0)
                        .offset(y: contentAppeared ? 0 : 10)

                    // Error message
                    if let error = authService.error {
                        errorView(error)
                            .padding(.top, Spacing.md)
                            .transition(.opacity.combined(with: .scale(scale: 0.95)))
                    }

                    Spacer()
                        .frame(minHeight: Spacing.xxl)

                    // Footer
                    footerSection
                        .opacity(contentAppeared ? 1 : 0)
                        .padding(.bottom, geometry.safeAreaInsets.bottom + Spacing.md)
                }
                .padding(.horizontal, Spacing.lg)
                .frame(minHeight: geometry.size.height)
            }
            .background(Color.backgroundPrimary)
        }
        .ignoresSafeArea(.container, edges: .bottom)
        .overlay {
            if authService.isLoading {
                loadingOverlay
            }
        }
        .onAppear {
            withAnimation(.easeOut(duration: 0.5)) {
                contentAppeared = true
            }
        }
    }

    // MARK: - Logo Section

    private var logoSection: some View {
        VStack(spacing: Spacing.lg) {
            // Logo - clean, no effects
            Image(.vwLogo)
                .renderingMode(.template)
                .resizable()
                .scaledToFit()
                .frame(width: 70, height: 40)
                .foregroundStyle(Color.textPrimary)

            // App name - bold, centered
            Text("vibeworkout")
                .font(.system(size: 36, weight: .bold, design: .rounded))
                .foregroundStyle(Color.textPrimary)

            // Tagline - subtle
            Text("HR-gated Claude Code tools")
                .font(.subheadline)
                .foregroundStyle(Color.textSecondary)
        }
    }

    // MARK: - Auth Section

    private var authSection: some View {
        VStack(spacing: Spacing.md) {
            // GitHub Sign In (primary action)
            Button {
                Task {
                    logger.info("GitHub sign in button tapped")
                    do {
                        try await authService.signInWithGitHub()
                    } catch {
                        logger.error("GitHub sign in error: \(error.localizedDescription)")
                    }
                }
            } label: {
                HStack(spacing: Spacing.sm) {
                    GitHubMark()
                        .frame(width: 18, height: 18)
                    Text("Continue with GitHub")
                        .font(.system(size: 15, weight: .semibold))
                }
                .frame(maxWidth: .infinity)
                .frame(height: 48)
                .foregroundStyle(.white)
                .background(Color.textPrimary)
                .clipShape(RoundedRectangle(cornerRadius: Radius.sm))
            }
            .buttonStyle(.plain)

            // Divider
            dividerView
                .padding(.vertical, Spacing.sm)

            // Email/Password form
            emailPasswordForm
        }
    }

    // MARK: - Divider

    private var dividerView: some View {
        HStack(spacing: Spacing.md) {
            Rectangle()
                .fill(Color.borderLight)
                .frame(height: 1)

            Text("OR")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Color.textSecondary)

            Rectangle()
                .fill(Color.borderLight)
                .frame(height: 1)
        }
    }

    // MARK: - Email/Password Form

    private var emailPasswordForm: some View {
        VStack(spacing: Spacing.sm) {
            // Email field
            TextField("Email", text: $email)
                .textFieldStyle(CleanTextFieldStyle())
                .textContentType(.emailAddress)
                .autocapitalization(.none)
                .keyboardType(.emailAddress)

            // Password field
            SecureField("Password", text: $password)
                .textFieldStyle(CleanTextFieldStyle())
                .textContentType(isSignUp ? .newPassword : .password)

            // Submit button
            Button {
                Task {
                    if isSignUp {
                        try? await authService.signUp(email: email, password: password)
                    } else {
                        try? await authService.signIn(email: email, password: password)
                    }
                }
            } label: {
                Text(isSignUp ? "Sign Up" : "Log In")
                    .font(.system(size: 15, weight: .semibold))
                    .frame(maxWidth: .infinity)
                    .frame(height: 48)
                    .foregroundStyle(.white)
                    .background(
                        (email.isEmpty || password.isEmpty)
                            ? Color.buttonPrimaryDisabled
                            : Color.buttonPrimary
                    )
                    .clipShape(RoundedRectangle(cornerRadius: Radius.sm))
            }
            .buttonStyle(.plain)
            .disabled(email.isEmpty || password.isEmpty)
            .padding(.top, Spacing.xs)
        }
    }

    // MARK: - Footer Section

    private var footerSection: some View {
        VStack(spacing: Spacing.md) {
            Rectangle()
                .fill(Color.borderLight)
                .frame(height: 1)

            // Toggle sign up/in
            Button {
                withAnimation(.easeInOut(duration: 0.2)) {
                    isSignUp.toggle()
                }
            } label: {
                HStack(spacing: 4) {
                    Text(isSignUp ? "Have an account?" : "Don't have an account?")
                        .foregroundStyle(Color.textSecondary)
                    Text(isSignUp ? "Log In" : "Sign Up")
                        .foregroundStyle(Color.buttonPrimary)
                        .fontWeight(.semibold)
                }
                .font(.system(size: 14))
            }
        }
    }

    // MARK: - Error View

    private func errorView(_ message: String) -> some View {
        HStack(spacing: Spacing.sm) {
            Image(systemName: "exclamationmark.circle.fill")
                .foregroundStyle(Color.statusError)

            Text(message)
                .font(.system(size: 13))
                .foregroundStyle(Color.statusError)
        }
        .padding(Spacing.md)
        .frame(maxWidth: .infinity)
        .background(
            RoundedRectangle(cornerRadius: Radius.sm)
                .fill(Color.statusError.opacity(0.08))
                .overlay(
                    RoundedRectangle(cornerRadius: Radius.sm)
                        .stroke(Color.statusError.opacity(0.2), lineWidth: 1)
                )
        )
    }

    // MARK: - Loading Overlay

    private var loadingOverlay: some View {
        ZStack {
            Color.backgroundPrimary.opacity(0.9)
                .ignoresSafeArea()

            VStack(spacing: Spacing.md) {
                ProgressView()
                    .scaleEffect(1.1)
                    .tint(Color.textPrimary)

                Text("Signing in...")
                    .font(.system(size: 14))
                    .foregroundStyle(Color.textSecondary)
            }
        }
        .transition(.opacity)
    }
}

// MARK: - Clean TextField Style

struct CleanTextFieldStyle: TextFieldStyle {
    func _body(configuration: TextField<Self._Label>) -> some View {
        configuration
            .font(.system(size: 14))
            .padding(.horizontal, Spacing.md)
            .padding(.vertical, 14)
            .background(
                RoundedRectangle(cornerRadius: Radius.sm)
                    .fill(Color.backgroundSecondary)
            )
            .overlay(
                RoundedRectangle(cornerRadius: Radius.sm)
                    .stroke(Color.borderLight, lineWidth: 1)
            )
    }
}

// MARK: - GitHub Mark (Octocat)

struct GitHubMark: View {
    var body: some View {
        GeometryReader { geo in
            let s = min(geo.size.width, geo.size.height) / 16

            Path { p in
                // GitHub Octocat mark - simplified path
                p.move(to: CGPoint(x: 8 * s, y: 0))
                p.addCurve(
                    to: CGPoint(x: 0, y: 8 * s),
                    control1: CGPoint(x: 3.58 * s, y: 0),
                    control2: CGPoint(x: 0, y: 3.58 * s)
                )
                p.addCurve(
                    to: CGPoint(x: 5.83 * s, y: 15.54 * s),
                    control1: CGPoint(x: 0, y: 11.54 * s),
                    control2: CGPoint(x: 2.43 * s, y: 14.58 * s)
                )
                p.addCurve(
                    to: CGPoint(x: 6.08 * s, y: 14.1 * s),
                    control1: CGPoint(x: 6.44 * s, y: 15.63 * s),
                    control2: CGPoint(x: 6.08 * s, y: 14.86 * s)
                )
                p.addLine(to: CGPoint(x: 6.08 * s, y: 11.88 * s))
                p.addCurve(
                    to: CGPoint(x: 3.6 * s, y: 7.69 * s),
                    control1: CGPoint(x: 3.75 * s, y: 10.8 * s),
                    control2: CGPoint(x: 2.17 * s, y: 9.45 * s)
                )
                p.addCurve(
                    to: CGPoint(x: 4.72 * s, y: 4.57 * s),
                    control1: CGPoint(x: 4.36 * s, y: 6.81 * s),
                    control2: CGPoint(x: 4.21 * s, y: 5.19 * s)
                )
                p.addCurve(
                    to: CGPoint(x: 4.87 * s, y: 1.61 * s),
                    control1: CGPoint(x: 4.51 * s, y: 3.54 * s),
                    control2: CGPoint(x: 4.51 * s, y: 2.39 * s)
                )
                p.addCurve(
                    to: CGPoint(x: 6.89 * s, y: 2.8 * s),
                    control1: CGPoint(x: 5.79 * s, y: 1.77 * s),
                    control2: CGPoint(x: 6.74 * s, y: 2.34 * s)
                )
                p.addCurve(
                    to: CGPoint(x: 9.11 * s, y: 2.8 * s),
                    control1: CGPoint(x: 7.34 * s, y: 2.65 * s),
                    control2: CGPoint(x: 8.66 * s, y: 2.65 * s)
                )
                p.addCurve(
                    to: CGPoint(x: 11.13 * s, y: 1.61 * s),
                    control1: CGPoint(x: 9.26 * s, y: 2.34 * s),
                    control2: CGPoint(x: 10.21 * s, y: 1.77 * s)
                )
                p.addCurve(
                    to: CGPoint(x: 11.28 * s, y: 4.57 * s),
                    control1: CGPoint(x: 11.49 * s, y: 2.39 * s),
                    control2: CGPoint(x: 11.49 * s, y: 3.54 * s)
                )
                p.addCurve(
                    to: CGPoint(x: 12.4 * s, y: 7.69 * s),
                    control1: CGPoint(x: 11.79 * s, y: 5.19 * s),
                    control2: CGPoint(x: 11.64 * s, y: 6.81 * s)
                )
                p.addCurve(
                    to: CGPoint(x: 9.92 * s, y: 11.11 * s),
                    control1: CGPoint(x: 13.83 * s, y: 9.45 * s),
                    control2: CGPoint(x: 12.25 * s, y: 10.8 * s)
                )
                p.addCurve(
                    to: CGPoint(x: 9.92 * s, y: 14.1 * s),
                    control1: CGPoint(x: 10.08 * s, y: 11.43 * s),
                    control2: CGPoint(x: 9.92 * s, y: 12.56 * s)
                )
                p.addCurve(
                    to: CGPoint(x: 10.17 * s, y: 15.54 * s),
                    control1: CGPoint(x: 9.92 * s, y: 14.86 * s),
                    control2: CGPoint(x: 9.56 * s, y: 15.63 * s)
                )
                p.addCurve(
                    to: CGPoint(x: 16 * s, y: 8 * s),
                    control1: CGPoint(x: 13.57 * s, y: 14.58 * s),
                    control2: CGPoint(x: 16 * s, y: 11.54 * s)
                )
                p.addCurve(
                    to: CGPoint(x: 8 * s, y: 0),
                    control1: CGPoint(x: 16 * s, y: 3.58 * s),
                    control2: CGPoint(x: 12.42 * s, y: 0)
                )
                p.closeSubpath()
            }
            .fill(.white)
        }
    }
}

#Preview {
    LoginView()
        .environmentObject(AuthService.shared)
}
