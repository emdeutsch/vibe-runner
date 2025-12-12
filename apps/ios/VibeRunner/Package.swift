// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "VibeRunner",
    platforms: [
        .iOS(.v17)
    ],
    products: [
        .library(
            name: "VibeRunner",
            targets: ["VibeRunner"]
        ),
    ],
    targets: [
        .target(
            name: "VibeRunner",
            path: "Sources"
        ),
    ]
)
