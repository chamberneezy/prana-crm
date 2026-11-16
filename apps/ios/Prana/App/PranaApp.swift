import PranaKit
import SwiftUI

@main
struct PranaApp: App {
    @State private var model = AppModel()

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
