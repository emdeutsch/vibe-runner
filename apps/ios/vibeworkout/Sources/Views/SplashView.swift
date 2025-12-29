import SwiftUI

struct SplashView: View {
    @Binding var isActive: Bool

    // Animation states
    @State private var logoScale: CGFloat = 0.7
    @State private var logoOpacity: Double = 0
    @State private var textOpacity: Double = 0
    @State private var contentOpacity: Double = 1

    var body: some View {
        ZStack {
            // Pure white background
            Color.backgroundPrimary
                .ignoresSafeArea()

            VStack(spacing: Spacing.lg) {
                // Animated logo
                Image(.vwLogo)
                    .renderingMode(.template)
                    .resizable()
                    .scaledToFit()
                    .frame(width: 70, height: 40)
                    .foregroundStyle(Color.textPrimary)
                    .scaleEffect(logoScale)
                    .opacity(logoOpacity)

                // App name
                Text("vibeworkout")
                    .font(.system(size: 28, weight: .semibold, design: .rounded))
                    .foregroundStyle(Color.textPrimary)
                    .opacity(textOpacity)
            }
        }
        .opacity(contentOpacity)
        .onAppear {
            animateSplash()
        }
    }

    private func animateSplash() {
        // Phase 1: Logo appears with scale animation
        withAnimation(.spring(response: 0.6, dampingFraction: 0.8)) {
            logoScale = 1.0
            logoOpacity = 1.0
        }

        // Phase 2: Text fades in
        withAnimation(.easeOut(duration: 0.4).delay(0.3)) {
            textOpacity = 1.0
        }

        // Phase 3: Hold, then fade out entire splash
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
            withAnimation(.easeInOut(duration: 0.3)) {
                contentOpacity = 0
            }

            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                isActive = false
            }
        }
    }
}

#Preview {
    SplashView(isActive: .constant(true))
}
