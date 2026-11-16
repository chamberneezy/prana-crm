import PranaKit
import SwiftUI

/**
 * What everyone sees, without an account: the week's classes and their own sign-ups. Tapping the studio's name five
 * times opens the staff sign-in (nothing on screen says so).
 */
struct StudentRoot: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        let count = { _ = model.bookingsVersion; return model.bookings.upcoming().count }()
        TabView {
            Tab("Raspored", systemImage: "calendar") { StudentSchedule() }
            Tab("Moje prijave", systemImage: "checkmark.circle") { MyBookingsView() }
                .badge(count)
        }
        .minimizingTabBar()
    }
}

/** Logo and the studio's name: the hidden way into the studio tool. */
struct StudioHeader: View {
    @Environment(AppModel.self) private var model
    var name = "Prana Yoga Studio"

    var body: some View {
        HStack(spacing: 12) {
            Image("Logo").resizable().scaledToFit().frame(width: 40, height: 36).accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 0) {
                Text(name).font(.display(17, relativeTo: .headline)).foregroundStyle(DS.ink)
                Text("Varaždin").font(.ui(12)).foregroundStyle(DS.muted)
            }
            Spacer()
            if model.isSignedIn {
                Button("Studio", systemImage: "person.badge.key") { model.mode = .staff }
                    .labelStyle(.iconOnly)
                    .glassButton()
                    .accessibilityLabel("Otvori alat studija")
            }
        }
        .contentShape(Rectangle())
        .onTapGesture(count: 5) { model.openStaff() }
    }
}

@MainActor @Observable
final class StudentScheduleModel {
    var monday: String
    var selected: String
    var state: Loadable<PublicSchedule> = .loading

    init(today: String, time: StudioTime) {
        monday = time.monday(of: today)
        selected = today
    }

    func load(_ api: APIClient, time: StudioTime) async {
        if state.value == nil || state.value?.from != monday { state = .loading }
        do {
            state = .loaded(try await api.publicSchedule(from: monday, to: time.addDays(monday, 6)))
        } catch {
            state = .failed(error.message)
        }
    }
}

struct StudentSchedule: View {
    @Environment(AppModel.self) private var model
    @State private var schedule: StudentScheduleModel?
    @State private var signingUp: PublicSession?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    StudioHeader()
                    if let schedule { content(schedule) }
                }
                .padding(.horizontal, DS.gutter)
                .padding(.bottom, 32)
            }
            .linenBackground()
            .refreshable { await schedule?.load(model.api, time: model.time) }
            .toolbar(.hidden, for: .navigationBar)
        }
        .task {
            if schedule == nil { schedule = StudentScheduleModel(today: model.time.today(), time: model.time) }
        }
        .task(id: schedule?.monday) {
            if let schedule { await schedule.load(model.api, time: model.time) }
        }
        .sheet(item: $signingUp) { session in BookingSheet(session: session) }
    }

    @ViewBuilder
    private func content(_ schedule: StudentScheduleModel) -> some View {
        @Bindable var schedule = schedule
        let time = model.time
        let today = time.today()
        let days = time.week(of: schedule.monday)
        let sessions = schedule.state.value?.sessions ?? []
        let byDay = Dictionary(grouping: sessions) { time.day(of: $0.startsAt) }

        HStack(alignment: .bottom) {
            PageTitle(title: "Raspored", overline: "Tjedan \(time.weekRange(schedule.monday))")
        }
        WeekSwitcher(monday: schedule.monday, thisMonday: time.monday(of: today), time: time) { goTo($0, schedule) }
            .frame(maxWidth: .infinity)
        WeekStrip(
            days: days,
            selected: $schedule.selected,
            today: today,
            hasClasses: { byDay[$0]?.isEmpty == false },
            isClosed: { day in byDay[day]?.contains { $0.closureName != nil } == true },
            time: time
        )
        .modifier(WeekSwipe(previous: { goTo(time.addDays(schedule.monday, -7), schedule) }, next: { goTo(time.addDays(schedule.monday, 7), schedule) }))

        Text(time.longDay(schedule.selected)).font(.ui(20, .semibold, relativeTo: .title3)).foregroundStyle(DS.ink)

        LoadingView(state: schedule.state, retry: { await schedule.load(model.api, time: model.time) }) { _ in
            let list = byDay[schedule.selected] ?? []
            if list.isEmpty {
                EmptyStateView(title: "Nema satova", message: "Odaberite drugi dan u tjednu.", systemImage: "moon.zzz")
            } else {
                VStack(spacing: 12) {
                    ForEach(list) { session in
                        PublicSessionCard(session: session) { signingUp = session }
                    }
                }
            }
        }
    }

    private func goTo(_ monday: String, _ schedule: StudentScheduleModel) {
        let time = model.time
        let offset = time.weekday(schedule.selected) - 1
        schedule.monday = monday
        // Today when it is in that week, otherwise the same weekday.
        let today = time.today()
        schedule.selected = time.monday(of: today) == monday ? today : time.addDays(monday, offset)
    }
}

/** One class, and whether this phone has signed up for it. */
struct PublicSessionCard: View {
    @Environment(AppModel.self) private var model
    let session: PublicSession
    let signUp: () -> Void
    @State private var cancelling: SavedBooking?

    var body: some View {
        let time = model.time
        let mine = { _ = model.bookingsVersion; return model.bookings.forSession(session.id) }()
        let over = session.endsAt <= Date()
        let detail = [time.timeRange(session.startsAt, session.endsAt), entryNote(session.entryRule, startsAt: session.startsAt, time: time)].compactMap { $0 }.joined(separator: " · ")

        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top, spacing: 12) {
                ClassPill(color: session.colorToken, width: 10)
                VStack(alignment: .leading, spacing: 3) {
                    Text(session.offeringName).font(.ui(17, .semibold, relativeTo: .headline)).foregroundStyle(session.closureName == nil ? DS.ink : DS.muted)
                        .strikethrough(session.closureName != nil)
                    Text(detail).font(.ui(14)).foregroundStyle(DS.inkMuted).monospacedDigit()
                    if let teacher = session.teacherName { Text("Vodi: \(teacher)").font(.ui(13)).foregroundStyle(DS.muted) }
                }
            }
            Divider().overlay(DS.lineSoft)
            HStack {
                if let closure = session.closureName {
                    TagView("Otkazano · \(closure)", kind: .health)
                } else if !mine.isEmpty {
                    Label(mine.map(\.personName).joined(separator: ", "), systemImage: "checkmark.circle.fill")
                        .font(.ui(14, .medium)).foregroundStyle(DS.sageDeep)
                    Spacer()
                    if !over {
                        Button("Odjavi") { cancelling = mine.first }.buttonStyle(.ds(.ghost, compact: true))
                    }
                } else if over {
                    Text("Završeno").font(.ui(14)).foregroundStyle(DS.muted)
                } else {
                    Text("Slobodan ulaz za članove").font(.ui(13)).foregroundStyle(DS.muted).opacity(session.entryRule?.lowercased().contains("slobodan") == true ? 1 : 0)
                }
                Spacer(minLength: 0)
                if session.closureName == nil, !over {
                    Button(mine.isEmpty ? "Prijavi se" : "Dodaj osobu", action: signUp)
                        .buttonStyle(.ds(mine.isEmpty ? .primary : .secondary, compact: true))
                }
            }
        }
        .card()
        .accessibilityElement(children: .contain)
        .confirmationDialog("Odjaviti se sa sata?", isPresented: Binding(get: { cancelling != nil }, set: { if !$0 { cancelling = nil } }), titleVisibility: .visible, presenting: cancelling) { booking in
            Button("Odjavi \(booking.personName)", role: .destructive) { Task { await cancel(booking) } }
        } message: { booking in
            Text("\(booking.offeringName), \(model.time.shortMoment(booking.startsAt))")
        }
    }

    private func cancel(_ booking: SavedBooking) async {
        do {
            try await model.api.cancelBooking(id: booking.id, cancelToken: booking.cancelToken)
        } catch let error as PranaError where error.code == "not_found" {
            // Already removed by the studio: nothing left to cancel.
        } catch {
            model.show(error.message, systemImage: "exclamationmark.circle")
            return
        }
        model.bookings.remove(id: booking.id)
        model.bookingsChanged()
        model.show("Odjavljeni ste: \(booking.offeringName)")
    }
}
