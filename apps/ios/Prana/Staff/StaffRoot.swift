import PranaKit
import SwiftUI

/**
 * The studio tool: everything the web app has. The bottom bar is the system tab bar, which iOS 26 draws in Liquid
 * Glass and shrinks while scrolling; "Upis člana" sits in its bottom accessory, where the old raised button was.
 */
struct StaffRoot: View {
    @Environment(AppModel.self) private var model
    @State private var tab = StaffTab.overview
    @State private var enrolling = false

    enum StaffTab: Hashable { case overview, schedule, members, payments, more }

    var body: some View {
        TabView(selection: $tab) {
            Tab("Pregled", systemImage: "square.grid.2x2", value: StaffTab.overview) { OverviewScreen(enroll: { enrolling = true }) }
            Tab("Raspored", systemImage: "calendar", value: StaffTab.schedule) { StaffScheduleScreen() }
            Tab("Članovi", systemImage: "person.2", value: StaffTab.members) { MembersScreen(enroll: { enrolling = true }) }
            Tab("Uplate", systemImage: "creditcard", value: StaffTab.payments) { PaymentsScreen() }
            Tab("Više", systemImage: "ellipsis.circle", value: StaffTab.more) { MoreScreen() }
        }
        .minimizingTabBar()
        .modifier(EnrolAccessory(enrolling: $enrolling))
        .fullScreenCover(isPresented: $enrolling) { EnrolmentFlow() }
    }
}

/** On iOS 26, a glass "Upis člana" button rides above the tab bar. */
private struct EnrolAccessory: ViewModifier {
    @Binding var enrolling: Bool
    func body(content: Content) -> some View {
        if #available(iOS 26.0, *) {
            content.tabViewBottomAccessory {
                Button { enrolling = true } label: {
                    Label("Upis člana", systemImage: "doc.viewfinder").font(.ui(15, .semibold)).frame(maxWidth: .infinity)
                }
                .foregroundStyle(DS.ink)
            }
        } else {
            content
        }
    }
}

/** Tjedni plan, Vrste satova, Učitelji, Članarine, Analitika, and leaving. */
struct MoreScreen: View {
    @Environment(AppModel.self) private var model
    @State private var confirmSignOut = false

    var body: some View {
        NavigationStack {
            List {
                Section {
                    NavigationLink { WeekPlannerScreen() } label: { Label("Tjedni plan", systemImage: "calendar.badge.plus") }
                    NavigationLink { OfferingsScreen() } label: { Label("Vrste satova", systemImage: "square.stack") }
                    NavigationLink { TeachersScreen() } label: { Label("Učitelji", systemImage: "person.crop.rectangle.stack") }
                    NavigationLink { PlansScreen() } label: { Label("Članarine", systemImage: "ticket") }
                    NavigationLink { AnalyticsScreen() } label: { Label("Analitika", systemImage: "chart.bar.xaxis") }
                }
                Section {
                    Button { model.mode = .student } label: { Label("Prikaz za članove", systemImage: "eye") }
                    Button(role: .destructive) { confirmSignOut = true } label: { Label("Odjava", systemImage: "rectangle.portrait.and.arrow.right") }
                } footer: {
                    if let me = model.me { Text("Prijavljeni ste kao \(me.staff.name) (\(me.staff.email)).") }
                }
            }
            .font(.ui(16))
            .tint(DS.sageDeep)
            .linenBackground()
            .navigationTitle("Više")
            .confirmationDialog("Odjaviti se?", isPresented: $confirmSignOut, titleVisibility: .visible) {
                Button("Odjava", role: .destructive) { Task { await model.signOut() } }
            } message: {
                Text("Aplikacija se vraća na prikaz za članove.")
            }
        }
    }
}
