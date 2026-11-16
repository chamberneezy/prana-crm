import PranaKit
import SwiftUI

/**
 * Tjedni plan: lay out a week's classes (by hand, from the standard week or from the week before) and save them to the
 * schedule in one go. Same rules as on the web: filling skips closed days, keeps a class already at that time, and
 * never drops a session people were checked in to.
 */
struct WeekPlannerScreen: View {
    @Environment(AppModel.self) private var model

    struct Row: Identifiable, Hashable {
        var id = UUID()
        var sessionID: String?
        var date: String
        var start: String
        var minutes: Int
        var offeringID: String
        var teacherID: String
        var booked = 0
    }

    @State private var monday = ""
    @State private var saved: [Row] = []
    @State private var rows: [Row] = []
    @State private var closed: [String: String] = [:]
    @State private var offerings: [Offering] = []
    @State private var staff: [Staff] = []
    @State private var loading = true
    @State private var failure: String?
    @State private var saving = false
    @State private var confirmTemplate = false

    private var dirty: Bool { key(rows) != key(saved) }

    var body: some View {
        List {
            Section {
                WeekSwitcher(monday: monday.isEmpty ? model.time.monday(of: model.time.today()) : monday, thisMonday: model.time.monday(of: model.time.today()), time: model.time, disabled: dirty) { monday = $0 }
                    .frame(maxWidth: .infinity)
                    .listRowBackground(Color.clear)
                Text(dirty ? "Spremite ili odbacite promjene prije prelaska na drugi tjedan." : "Složite satove odabranog tjedna i spremite ih u raspored.")
                    .font(.ui(13)).foregroundStyle(DS.muted).listRowBackground(Color.clear)
                if let failure { NoticeView(message: failure).listRowBackground(Color.clear).listRowInsets(EdgeInsets()) }
            }
            if !monday.isEmpty {
                ForEach(model.time.week(of: monday), id: \.self) { day in daySection(day) }
            }
        }
        .font(.ui(15))
        .linenBackground()
        .navigationTitle("Tjedni plan")
        .toolbar(.hidden, for: .tabBar)
        .overlay { if loading { ProgressView().controlSize(.large) } }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button("Popuni iz standardnog tjedna", systemImage: "square.and.arrow.down") { Task { await fromTemplate() } }
                    Button("Kopiraj prethodni tjedan", systemImage: "doc.on.doc") { Task { await copyPrevious() } }
                    Button("Spremi kao standardni tjedan", systemImage: "star") { confirmTemplate = true }.disabled(rows.isEmpty)
                    if dirty { Button("Odbaci promjene", systemImage: "arrow.uturn.backward", role: .destructive) { rows = saved } }
                } label: { Image(systemName: "ellipsis") }
            }
            ToolbarItem(placement: .bottomBar) {
                Button("Spremi tjedan") { Task { await save() } }.disabled(!dirty || saving).glassButton(prominent: true)
            }
        }
        .confirmationDialog("Spremiti ovaj tjedan kao standardni?", isPresented: $confirmTemplate, titleVisibility: .visible) {
            Button("Spremi kao standardni tjedan") { Task { await saveTemplate() } }
        } message: { Text("Standardni tjedan se zamjenjuje ovim rasporedom.") }
        .task {
            if monday.isEmpty { monday = model.time.monday(of: model.time.today()) }
            let api = model.api
            async let o = api.offerings()
            async let s = api.staff()
            offerings = (try? await o) ?? []
            staff = (try? await s) ?? []
        }
        .task(id: monday) { if !monday.isEmpty { await load() } }
    }

    @ViewBuilder
    private func daySection(_ day: String) -> some View {
        let dayRows = rows.filter { $0.date == day }.sorted { $0.start < $1.start }
        Section {
            if dayRows.isEmpty { Text("Nema satova").foregroundStyle(DS.muted) }
            ForEach(dayRows) { row in
                rowEditor(row)
                    .swipeActions {
                        if row.booked == 0 { Button("Ukloni", role: .destructive) { rows.removeAll { $0.id == row.id } } }
                    }
            }
            Button("Dodaj sat", systemImage: "plus") {
                let first = offerings.first(where: \.active)
                rows.append(Row(date: day, start: "18:00", minutes: first?.defaultDurationMin ?? 60, offeringID: first?.id ?? "", teacherID: first?.teacherIds.first ?? ""))
            }
            .foregroundStyle(DS.sageDeep)
        } header: {
            HStack {
                Text(model.time.longDay(day))
                Spacer()
                if let name = closed[day] { TagView("Neradni dan · \(name)", kind: .health) }
            }
        }
    }

    private func rowEditor(_ row: Row) -> some View {
        let binding = Binding(get: { rows.first { $0.id == row.id } ?? row }, set: { new in if let i = rows.firstIndex(where: { $0.id == row.id }) { rows[i] = new } })
        let offering = offerings.first { $0.id == row.offeringID }
        return VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 10) {
                ClassPill(color: offering?.colorToken ?? .spine, width: 8)
                Picker("Sat", selection: Binding(get: { binding.wrappedValue.offeringID }, set: { id in
                    binding.wrappedValue.offeringID = id
                    if let o = offerings.first(where: { $0.id == id }) {
                        binding.wrappedValue.minutes = o.defaultDurationMin
                        binding.wrappedValue.teacherID = o.teacherIds.first ?? ""
                    }
                })) {
                    ForEach(offerings.filter { $0.active || $0.id == row.offeringID }) { o in Text(o.name).tag(o.id) }
                }
                .labelsHidden()
                .pickerStyle(.menu)
                Spacer()
                if row.booked > 0 { TagView(plural(row.booked, "dolazak", "dolaska", "dolazaka"), kind: .plan) }
            }
            HStack(spacing: 12) {
                DatePicker("Početak", selection: Binding(get: { clock(binding.wrappedValue.start) }, set: { binding.wrappedValue.start = model.time.time($0) }), displayedComponents: .hourAndMinute)
                    .labelsHidden()
                    .environment(\.timeZone, model.time.timeZone)
                Stepper("\(binding.wrappedValue.minutes) min", value: binding.minutes, in: 5 ... 600, step: 5).font(.ui(14))
            }
            Picker("Učitelj", selection: binding.teacherID) {
                Text("Bez učitelja").tag("")
                ForEach(staff) { s in Text(s.name).tag(s.id) }
            }
            .font(.ui(14))
        }
        .padding(.vertical, 4)
    }

    /** "18:15" as an instant on an arbitrary studio day, for the time picker. */
    private func clock(_ text: String) -> Date {
        let parts = text.split(separator: ":").compactMap { Int($0) }
        return Calendar.studio(model.time).date(bySettingHour: parts.first ?? 18, minute: parts.last ?? 0, second: 0, of: model.time.noonDate(monday)) ?? Date()
    }

    private func key(_ list: [Row]) -> [String] {
        list.map { "\($0.sessionID ?? "-")|\($0.date)|\($0.start)|\($0.minutes)|\($0.offeringID)|\($0.teacherID)" }.sorted()
    }

    private func row(from s: SessionView) -> Row {
        Row(sessionID: s.id, date: model.time.day(of: s.startsAt), start: model.time.time(s.startsAt), minutes: Int(s.endsAt.timeIntervalSince(s.startsAt) / 60), offeringID: s.offeringId, teacherID: s.teacherStaffId ?? "", booked: s.booked)
    }

    private func load() async {
        loading = true
        defer { loading = false }
        let week = monday
        let api = model.api
        let sunday = model.time.addDays(week, 6)
        do {
            async let sessions = api.sessions(from: week, to: sunday)
            async let closures = api.closures(from: week, to: sunday)
            let (weekSessions, weekClosures) = try await (sessions, closures)
            let loaded = weekSessions.map(row(from:))
            closed = Dictionary(uniqueKeysWithValues: weekClosures.map { ($0.date, $0.name) })
            guard week == monday else { return }
            saved = loaded
            rows = loaded
            failure = nil
        } catch { failure = error.message }
    }

    /** Fills the week, skipping closed days and keeping what is already there at the same time. */
    private func fill(_ planned: [Row]) {
        var pool = saved
        var next: [Row] = []
        for p in planned where closed[p.date] == nil {
            if let i = pool.firstIndex(where: { $0.date == p.date && $0.start == p.start && $0.offeringID == p.offeringID }) {
                var same = pool.remove(at: i)
                same.minutes = p.minutes
                same.teacherID = p.teacherID
                next.append(same)
            } else {
                next.append(p)
            }
        }
        rows = next + pool.filter { $0.booked > 0 }
        model.show("Tjedan je popunjen. Spremite ga da se pojavi u rasporedu.")
    }

    private func fromTemplate() async {
        do {
            let slots = try await model.api.weekTemplate()
            if slots.isEmpty { failure = "Standardni tjedan je prazan. Složite tjedan i spremite ga kao standardni."; return }
            fill(slots.map { Row(date: model.time.addDays(monday, $0.weekday - 1), start: $0.startTime, minutes: $0.durationMin, offeringID: $0.offeringId, teacherID: $0.teacherStaffId ?? "") })
        } catch { failure = error.message }
    }

    private func copyPrevious() async {
        let previous = model.time.addDays(monday, -7)
        do {
            let sessions = try await model.api.sessions(from: previous, to: model.time.addDays(previous, 6))
            fill(sessions.map { s in
                var r = row(from: s)
                r.id = UUID()
                r.sessionID = nil
                r.booked = 0
                r.date = model.time.addDays(r.date, 7)
                return r
            })
        } catch { failure = error.message }
    }

    private func save() async {
        saving = true
        defer { saving = false }
        let plan = rows.map { PlannedSession(id: $0.sessionID, date: $0.date, startTime: $0.start, durationMin: $0.minutes, offeringId: $0.offeringID, teacherStaffId: $0.teacherID.isEmpty ? nil : $0.teacherID) }
        do {
            let result = try await model.api.saveWeekPlan(monday: monday, plan)
            saved = result.map(row(from:))
            rows = saved
            failure = nil
            model.show("Tjedan \(model.time.weekRange(monday)) je spremljen u raspored.")
        } catch { failure = error.message }
    }

    private func saveTemplate() async {
        let slots = rows.map { TemplateSlot(weekday: model.time.weekday($0.date), startTime: $0.start, durationMin: $0.minutes, offeringId: $0.offeringID, teacherStaffId: $0.teacherID.isEmpty ? nil : $0.teacherID) }
        do {
            try await model.api.saveWeekTemplate(slots)
            model.show("Standardni tjedan je spremljen.")
        } catch { failure = error.message }
    }
}
