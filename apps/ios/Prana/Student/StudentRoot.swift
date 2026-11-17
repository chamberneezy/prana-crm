import PranaKit
import SwiftUI

/**
 * What everyone sees, without an account: the week's classes and their own sign-ups. Tapping the logo seven times
 * quickly opens the staff sign-in (nothing on screen says so). The first launch starts with a short welcome.
 */
struct StudentRoot: View {
    @Environment(AppModel.self) private var model
    @AppStorage("prana.welcomed") private var welcomed = false

    var body: some View {
        let count = { _ = model.bookingsVersion; return model.bookings.upcoming().count }()
        TabView {
            Tab("Raspored", systemImage: "calendar") { StudentSchedule() }
            Tab("Moje prijave", systemImage: "checkmark.circle") { MyBookingsView() }
                .badge(count)
        }
        .minimizingTabBar()
        .overlay {
            if !welcomed {
                WelcomeView { withAnimation(.smooth(duration: 0.6)) { welcomed = true } }
                    .transition(.opacity.combined(with: .scale(scale: 1.04)))
            }
        }
    }
}

/** Logo and the studio's name: the hidden way into the studio tool. */
struct StudioHeader: View {
    @Environment(AppModel.self) private var model
    var name = "Prana Yoga Studio"
    /** Staff sign-in: the logo tapped this many times, each tap within `tapGap` of the one before. Nothing hints at it. */
    static let secretTaps = 7
    static let tapGap: TimeInterval = 0.6
    @State private var taps = 0
    @State private var lastTap = Date.distantPast

    var body: some View {
        VStack(spacing: 6) {
            Image("Logo", bundle: .prana).resizable().scaledToFit().frame(width: 60, height: 54)
                .padding(6)
                .contentShape(Rectangle())
                .onTapGesture { logoTapped() }
                .accessibilityHidden(true)
            Text(name).font(.display(22, relativeTo: .title2)).foregroundStyle(DS.ink)
                .multilineTextAlignment(.center)
            Text(greeting).font(.signature(20)).foregroundStyle(DS.sageDeep)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 8)
        .overlay(alignment: .topTrailing) {
            if model.isSignedIn {
                Button("Studio", systemImage: "person.badge.key") { model.mode = .staff }
                    .labelStyle(.iconOnly)
                    .glassButton()
                    .accessibilityLabel("Otvori alat studija")
            }
        }
    }

    private var greeting: String {
        switch Calendar.current.component(.hour, from: Date()) {
        case 5 ..< 12: "Dobro jutro"
        case 12 ..< 18: "Dobar dan"
        default: "Dobra večer"
        }
    }

    private func logoTapped() {
        let now = Date()
        taps = now.timeIntervalSince(lastTap) <= Self.tapGap ? taps + 1 : 1
        lastTap = now
        if taps >= Self.secretTaps {
            taps = 0
            model.openStaff()
        }
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

        WeekCalendar(
            monday: schedule.monday,
            thisMonday: time.monday(of: today),
            today: today,
            selected: $schedule.selected,
            count: { day in byDay[day]?.filter { $0.closureName == nil }.count ?? 0 },
            isClosed: { day in byDay[day]?.contains { $0.closureName != nil } == true },
            time: time
        ) { goTo($0, schedule) }

        let list = byDay[schedule.selected] ?? []
        HStack(alignment: .firstTextBaseline) {
            Text(time.longDay(schedule.selected)).font(.ui(20, .semibold, relativeTo: .title3)).foregroundStyle(DS.ink)
            Spacer()
            if schedule.state.value != nil, !list.isEmpty {
                Text(plural(list.count, "sat", "sata", "satova")).font(.ui(14)).foregroundStyle(DS.muted)
            }
        }
        .contentTransition(.numericText())
        .animation(.smooth, value: schedule.selected)

        LoadingView(state: schedule.state, retry: { await schedule.load(model.api, time: model.time) }) { _ in
            Group {
                if list.isEmpty {
                    EmptyStateView(title: "Nema satova", message: "Odaberite drugi dan u tjednu.", systemImage: "moon.zzz")
                        .appearIn(0)
                } else {
                    VStack(spacing: 12) {
                        ForEach(Array(list.enumerated()), id: \.element.id) { index, session in
                            PublicSessionCard(session: session) { signingUp = session }
                                .appearIn(index)
                        }
                    }
                }
            }
            .id(schedule.selected + (schedule.state.value?.from ?? ""))
        }
    }

    private func goTo(_ monday: String, _ schedule: StudentScheduleModel) {
        let time = model.time
        let offset = time.weekday(schedule.selected) - 1
        // Today when it is in that week, otherwise the same weekday.
        let today = time.today()
        withAnimation(.smooth(duration: 0.35)) {
            schedule.monday = monday
            schedule.selected = time.monday(of: today) == monday ? today : time.addDays(monday, offset)
        }
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

/**
 * The week as a card: the month and which week it is, arrows on glass, and the seven days. The chosen day is a dark
 * pill that slides between days; dots under a day count its classes (up to three), terracotta marks a closed day.
 * Swiping across the days changes the week, and the days slide in from the side they came from.
 */
struct WeekCalendar: View {
    let monday: String
    let thisMonday: String
    let today: String
    @Binding var selected: String
    var count: (String) -> Int
    var isClosed: (String) -> Bool
    let time: StudioTime
    let go: (String) -> Void
    @Namespace private var pill
    @State private var forward = true

    var body: some View {
        VStack(spacing: 14) {
            HStack(alignment: .center, spacing: 8) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(monthTitle).font(.display(19, relativeTo: .title3)).foregroundStyle(DS.ink)
                    Text(weekLabel).font(.ui(13)).foregroundStyle(DS.muted).monospacedDigit()
                }
                .contentTransition(.opacity)
                Spacer(minLength: 0)
                if monday != thisMonday {
                    Button("Danas") { move(to: thisMonday) }
                        .font(.ui(13, .semibold))
                        .foregroundStyle(DS.ink)
                        .padding(.horizontal, 12)
                        .frame(height: 36)
                        .glassSurface(in: Capsule(), interactive: true)
                        .transition(.scale.combined(with: .opacity))
                }
                HStack(spacing: 0) {
                    Button { move(to: time.addDays(monday, -7)) } label: { Image(systemName: "chevron.left").frame(width: 40, height: 36) }
                        .accessibilityLabel("Prethodni tjedan")
                    Button { move(to: time.addDays(monday, 7)) } label: { Image(systemName: "chevron.right").frame(width: 40, height: 36) }
                        .accessibilityLabel("Sljedeći tjedan")
                }
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(DS.ink)
                .glassSurface(in: Capsule(), interactive: true)
            }

            days
                .id(monday)
                .transition(.asymmetric(
                    insertion: .move(edge: forward ? .trailing : .leading).combined(with: .opacity),
                    removal: .move(edge: forward ? .leading : .trailing).combined(with: .opacity)
                ))
        }
        .padding(14)
        .background(DS.white, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(DS.line))
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .shadow(color: DS.ink.opacity(0.05), radius: 14, y: 6)
        .modifier(WeekSwipe(previous: { move(to: time.addDays(monday, -7)) }, next: { move(to: time.addDays(monday, 7)) }))
        .sensoryFeedback(.selection, trigger: selected)
        .animation(.smooth(duration: 0.35), value: monday)
    }

    private var days: some View {
        HStack(spacing: 4) {
            ForEach(time.week(of: monday), id: \.self) { day in
                let chosen = day == selected
                let n = count(day)
                Button {
                    withAnimation(.snappy(duration: 0.3)) { selected = day }
                } label: {
                    VStack(spacing: 4) {
                        Text(Weekday.short[time.weekday(day)].uppercased())
                            .font(.ui(10, .semibold, relativeTo: .caption2)).tracking(0.6)
                            .foregroundStyle(chosen ? DS.white.opacity(0.8) : DS.muted)
                        Text(time.dayOfMonth(day)).font(.ui(18, .semibold, relativeTo: .title3)).monospacedDigit()
                            .foregroundStyle(chosen ? DS.white : DS.ink)
                        HStack(spacing: 3) {
                            if isClosed(day) {
                                Circle().fill(DS.terracotta).frame(width: 5, height: 5)
                            } else {
                                ForEach(0 ..< min(n, 3), id: \.self) { _ in
                                    Circle().fill(chosen ? DS.white : DS.sage).frame(width: 4, height: 4)
                                }
                            }
                        }
                        .frame(height: 5)
                    }
                    .frame(maxWidth: .infinity, minHeight: 66)
                    .background {
                        if chosen {
                            RoundedRectangle(cornerRadius: 14, style: .continuous).fill(DS.ink)
                                .matchedGeometryEffect(id: "pill", in: pill)
                        } else if day == today {
                            RoundedRectangle(cornerRadius: 14, style: .continuous).fill(DS.mist)
                        }
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("\(Weekday.long[time.weekday(day)]), \(time.dayMonth(day))\(day == today ? ", danas" : ""), \(isClosed(day) ? "studio zatvoren" : plural(n, "sat", "sata", "satova"))")
                .accessibilityAddTraits(chosen ? .isSelected : [])
            }
        }
    }

    private func move(to newMonday: String) {
        guard newMonday != monday else { return }
        forward = newMonday > monday
        go(newMonday)
    }

    private static let months = ["", "Siječanj", "Veljača", "Ožujak", "Travanj", "Svibanj", "Lipanj", "Srpanj", "Kolovoz", "Rujan", "Listopad", "Studeni", "Prosinac"]

    /** "Studeni 2026", or "Studeni – Prosinac 2026" for a week across two months. */
    private var monthTitle: String {
        let first = monday.split(separator: "-"), last = time.addDays(monday, 6).split(separator: "-")
        let m1 = Self.months[Int(first[1])!], m2 = Self.months[Int(last[1])!]
        if first[0] != last[0] { return "\(m1) \(first[0]) – \(m2) \(last[0])" }
        return m1 == m2 ? "\(m1) \(first[0])" : "\(m1) – \(m2) \(first[0])"
    }

    private var weekLabel: String {
        let range = time.weekRange(monday)
        switch monday {
        case thisMonday: return "Ovaj tjedan · \(range)"
        case time.addDays(thisMonday, 7): return "Sljedeći tjedan · \(range)"
        case time.addDays(thisMonday, -7): return "Prošli tjedan · \(range)"
        default: return range
        }
    }
}

extension View {
    /** Fades and lifts a list item in, each a moment after the one before. */
    func appearIn(_ index: Int) -> some View { modifier(AppearIn(index: index)) }
}

private struct AppearIn: ViewModifier {
    let index: Int
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var shown = false

    func body(content: Content) -> some View {
        content
            .opacity(shown ? 1 : 0)
            .offset(y: shown || reduceMotion ? 0 : 16)
            .onAppear {
                withAnimation(.spring(duration: 0.5, bounce: 0.2).delay(Double(min(index, 6)) * 0.06)) { shown = true }
            }
    }
}
