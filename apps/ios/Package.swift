// swift-tools-version: 6.0
// Linux build of the iOS app with xtool (`xtool dev build`, or `bash scripts/linux-build.sh`).
// The Xcode project (project.yml) uses the same sources; this file only exists so the app can be
// compiled, signed and shipped without a Mac (~/Projects/tools/omarchy-apple-dev).
import PackageDescription

let package = Package(
    name: "Prana",
    defaultLocalization: "hr",
    platforms: [.iOS(.v18)],
    products: [.library(name: "Prana", targets: ["Prana"])],
    dependencies: [.package(path: "PranaKit")],
    targets: [
        .target(
            name: "Prana",
            dependencies: ["PranaKit"],
            path: "Prana",
            exclude: ["Resources/Assets.xcassets/AppIcon.appiconset"],
            resources: [.process("Resources/Assets.xcassets"), .copy("Resources/Fonts")],
            swiftSettings: [.swiftLanguageMode(.v6)]
        ),
    ]
)
