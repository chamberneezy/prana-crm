import CoreText
import PranaKit
import SwiftUI

@main
struct PranaApp: App {
    @State private var model = AppModel()

    init() { Bundle.registerFonts() }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(model)
                .font(.ui(15))
                .tint(DS.ink)
                .task { await model.restore() }
        }
    }
}

/** Members see the studio's classes; staff get the studio tool after the hidden sign-in. */
struct RootView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        @Bindable var model = model
        Group {
            switch model.mode {
            case .student: StudentRoot()
            case .staff: StaffRoot()
            }
        }
        .animation(.smooth, value: model.mode)
        .sheet(isPresented: $model.showStaffLogin) { StaffLoginSheet() }
        .toastOverlay()
    }
}

extension Bundle {
    /**
     * Where the logo, colours and fonts are. Xcode (project.yml) puts them in the app itself; the Linux
     * build (Package.swift + xtool) puts them in SwiftPM's resource bundle.
     */
    static var prana: Bundle {
        #if SWIFT_PACKAGE
        .module
        #else
        .main
        #endif
    }

    /** The Linux build has no UIAppFonts entries (the fonts aren't at the app's root), so they're registered here. */
    static func registerFonts() {
        #if SWIFT_PACKAGE
        for url in Bundle.module.urls(forResourcesWithExtension: "ttf", subdirectory: "Fonts") ?? [] {
            CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil)
        }
        #endif
    }
}
