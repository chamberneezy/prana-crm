// swift-tools-version: 6.0
// Everything in the Prana iOS app that isn't UI: API models and client, sign-in, studio-time dates and the
// sign-ups kept on the device. It builds and tests on Linux too (`swift test`), so it is checked without a Mac.
import PackageDescription

let package = Package(
    name: "PranaKit",
    defaultLocalization: "hr",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [.library(name: "PranaKit", targets: ["PranaKit"])],
    targets: [
        .target(name: "PranaKit"),
        .testTarget(name: "PranaKitTests", dependencies: ["PranaKit"], resources: [.copy("Fixtures")]),
    ]
)
