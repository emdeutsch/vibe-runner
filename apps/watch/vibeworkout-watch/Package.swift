// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "vibeworkout-watch",
    platforms: [
        .watchOS(.v10)
    ],
    products: [
        .library(name: "vibeworkout-watch", targets: ["vibeworkout-watch"])
    ],
    targets: [
        .target(
            name: "vibeworkout-watch",
            path: "Sources"
        )
    ]
)
