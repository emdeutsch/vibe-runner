// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "viberunner-watch",
    platforms: [
        .watchOS(.v10)
    ],
    products: [
        .library(name: "viberunner-watch", targets: ["viberunner-watch"])
    ],
    targets: [
        .target(
            name: "viberunner-watch",
            path: "Sources"
        )
    ]
)
