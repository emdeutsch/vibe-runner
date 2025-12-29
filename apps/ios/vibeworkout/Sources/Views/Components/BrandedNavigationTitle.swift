import SwiftUI

struct BrandedNavigationTitle: View {
    let title: String

    var body: some View {
        HStack(spacing: Spacing.sm) {
            Image(.vwLogo)
                .renderingMode(.template)
                .resizable()
                .scaledToFit()
                .frame(width: 24, height: 14)
                .foregroundStyle(Color.brandPrimary)

            Text(title)
                .font(.headline)
                .foregroundStyle(Color.textPrimary)
        }
    }
}

#Preview {
    NavigationStack {
        Text("Content")
            .toolbar {
                ToolbarItem(placement: .principal) {
                    BrandedNavigationTitle(title: "Workout")
                }
            }
    }
}
