import PranaKit
import SwiftUI

/** Raspored: the week, a day at a time, as in the phone design. */
struct StaffScheduleScreen: View {
    @Environment(AppModel.self) private var model
    @State private var monday = ""
    @State private var selected = ""
    @State private var state: Loadable<[SessionView]> = .loading
    @State private var creating = false
    @State private var editingClosures = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    if !monday.isEmpty { content }
                }
                .padding(.horizontal, DS.gutter)
                .padding(.bottom, 32)
            }
            .linenBackground()
            .refreshable { await load() }
            .toolbar {
                ToolbarItemGroup(placement: .topBarTrailing) {
                    Menu {
                        Button("Neradni dani", systemImage: "sun.max") { editingClosures = true }
                        NavigationLink { OfferingsScreen() } label: { Label("Vrste satova", systemImage: "square.stack") }
                        NavigationLink { WeekPlannerScreen() } label: { Label("Tjedni plan", systemImage: "calendar.badge.plus") }
                    } label: { Image(systemName: "ellipsis") }
                    Button("Novi termin", systemImage: "plus") { creating = true }
                }
            }
            .sheet(isPresented: $creating, onDismiss: { Task { await load() } }) { SessionFormSheet(session: nil, day: selected) }
            .sheet(isPresented: $editingClosures, onDismiss: { Task { await load() } }) { ClosuresSheet(monday: monday) }
        }
        .task {
            if monday.isEmpty {
                selected = model.time.today()
                monday = model.time.monday(of: selected)
            }
        }
        .task(id: monday) { if !monday.isEmpty { await load() } }
    }

    @ViewBuilder private var content: some View {
        let time = model.time
        let sessions = state.value ?? []
        let byDay = Dictionary(grouping: sessions) { time.day(of: $0.startsAt) }
        PageTitle(title: "Raspored", overline: "Tjedan \(time.weekRange(monday))")
        WeekSwitcher(monday: monday, thisMonday: time.monday(of: time.today()), time: time) { goTo($0) }.frame(maxWidth: .infinity)
        WeekStrip(days: time.week(of: monday), selected: $selected, today: time.today(), hasClasses: { byDay[$0]?.isEmpty == false }, isClosed: { day in byDay[day]?.contains { $0.closureName != nil } == true }, time: time)
            .modifier(WeekSwipe(previous: { goTo(time.addDays(monday, -7)) }, next: { goTo(time.addDays(monday, 7)) }))
        Text(time.longDay(selected)).font(.ui(20, .semibold, relativeTo: .title3))
        LoadingView(state: state, retry: load) { _ in
            let list = byDay[selected] ?? []
            if list.isEmpty {
                EmptyStateView(title: "Nema satova", message: "Dodajte termin ili složite tjedan u Tjednom planu.", systemImage: "calendar")
            }
            ForEach(list) { session in
                NavigationLink { SessionDetailScreen(sessionID: session.id) } label: { StaffSessionCard(session: session) }.buttonStyle(.plain)
            }
        }
    }

    private func goTo(_ newMonday: String) {
        let offset = model.time.weekday(selected) - 1
        monday = newMonday
        let today = model.time.today()
        selected = model.time.monday(of: today) == newMonday ? today : model.time.addDays(newMonday, offset)
    }

    private func load() async {
        let week = monday
        do {
            let sessions = try await model.api.sessions(from: week, to: model.time.addDays(week, 6))
            if week == monday { state = .loaded(sessions) }
        } catch {
            state = .failed(error.message)
        }
    }
}

/** One class: details, najave from the app, the class list with health notes, check-in, edit and delete. */
struct SessionDetailScreen: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let sessionID: String
    @State private var state: Loadable<SessionDetail> = .loading
    @State private var picking = false
    @State private var editing = false
    @State private var confirmDelete = false
    @State private var working = false

    var body: some View {
        List {
            switch state {
            case .loading:
                ProgressView().frame(maxWidth: .infinity).listRowBackground(Color.clear)
            case let .failed(message):
                NoticeView(title: "Termin se nije učitao", message: message).listRowBackground(Color.clear)
            case let .loaded(detail):
                sections(detail)
            }
        }
        .font(.ui(15))
        .linenBackground()
        .navigationTitle(state.value?.session.offeringName ?? "Termin")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.hidden, for: .tabBar)
        .refreshable { await load() }
        .toolbar {
            if let detail = state.value {
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Button("Uredi termin", systemImage: "pencil") { editing = true }
                        Button("Obriši termin", systemImage: "trash", role: .destructive) { confirmDelete = true }
                    } label: { Image(systemName: "ellipsis") }
                }
                if detail.session.closureName == nil {
                    ToolbarItem(placement: .bottomBar) {
                        Button("Evidentiraj dolazak", systemImage: "person.crop.circle.badge.checkmark") { picking = true }
                            .glassButton(prominent: true)
                    }
                }
            }
        }
        .sheet(isPresented: $picking) {
            MemberPicker(title: "Evidentiraj dolazak", exclude: Set(state.value?.attendees.map(\.memberId) ?? [])) { member in
                await checkIn(member.id, name: member.fullName)
            }
        }
        .sheet(isPresented: $editing, onDismiss: { Task { await load() } }) {
            if let session = state.value?.session { SessionFormSheet(session: session, day: model.time.day(of: session.startsAt)) }
        }
        .confirmationDialog("Obrisati ovaj termin?", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("Obriši", role: .destructive) { Task { await delete() } }
        } message: {
            Text("Evidentirani dolasci na ovom terminu više se neće računati.")
        }
        .task { await load() }
        .disabled(working)
    }

    @ViewBuilder
    private func sections(_ detail: SessionDetail) -> some View {
        let s = detail.session
        let time = model.time
        Section {
            LabeledContent("Datum", value: time.longDay(time.day(of: s.startsAt)))
            LabeledContent("Vrijeme", value: time.timeRange(s.startsAt, s.endsAt))
            if let entry = entryNote(s.entryRule, startsAt: s.startsAt, time: time) { LabeledContent("Ulaz", value: entry) }
            LabeledContent("Učitelj", value: s.teacherName ?? "—")
            LabeledContent("Dolasci", value: s.effectiveCapacity.map { "\(s.booked)/\($0)" } ?? "\(s.booked)")
            if let note = s.note { LabeledContent("Napomena", value: note) }
        }
        if let closure = s.closureName {
            Section { NoticeView(title: "Otkazano", message: "Neradni dan (\(closure)): sat je otkazan i dolazak se ne može evidentirati.") }
                .listRowBackground(Color.clear)
                .listRowInsets(EdgeInsets())
        }
        if !detail.reservations.isEmpty {
            Section {
                ForEach(detail.reservations) { r in
                    HStack(spacing: 12) {
                        Avatar(name: r.fullName, size: 32)
                        Text(r.fullName).font(.ui(15, .medium))
                        Spacer()
                        if r.checkedIn {
                            Label("Evidentirano", systemImage: "checkmark").labelStyle(.titleAndIcon).font(.ui(13, .medium)).foregroundStyle(DS.sageDeep)
                        } else if s.closureName == nil {
                            Button("Evidentiraj") { Task { await checkIn(r.memberId, name: r.fullName) } }.buttonStyle(.ds(.secondary, compact: true))
                        }
                    }
                    .swipeActions {
                        Button("Ukloni", role: .destructive) { Task { await removeBooking(r) } }
                    }
                }
            } header: {
                Text("Najave iz aplikacije · \(detail.reservations.count)")
            } footer: {
                Text("Članovi koji su se prijavili u aplikaciji studija. Dolazak se broji tek kad ga evidentirate.")
            }
        }
        Section {
            if detail.attendees.isEmpty { Text("Još nema evidentiranih dolazaka").foregroundStyle(DS.muted) }
            ForEach(detail.attendees) { a in
                HStack(alignment: .top, spacing: 12) {
                    Avatar(name: a.fullName, size: 32)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(a.fullName).font(.ui(15, .medium))
                        // The health note is here because this is the teacher's class list.
                        if let health = a.healthText { TagView(health, kind: .health) }
                    }
                }
                .swipeActions {
                    Button("Ukloni", role: .destructive) { Task { await removeVisit(a) } }
                }
            }
        } header: {
            Text("Popis sata · \(plural(detail.attendees.count, "dolazak", "dolaska", "dolazaka"))")
        }
    }

    private func load() async {
        do { state = .loaded(try await model.api.session(id: sessionID)) } catch { state = .failed(error.message) }
    }

    private func checkIn(_ memberID: String, name: String) async {
        working = true
        defer { working = false }
        do {
            try await model.api.checkIn(sessionID: sessionID, memberID: memberID)
            model.show("Dolazak evidentiran: \(name).")
            await load()
        } catch {
            model.show(error.message, systemImage: "exclamationmark.circle")
        }
    }

    private func removeVisit(_ a: Attendee) async {
        do {
            try await model.api.removeVisit(id: a.visitId)
            await load()
        } catch { model.show(error.message, systemImage: "exclamationmark.circle") }
    }

    private func removeBooking(_ r: Reservation) async {
        do {
            try await model.api.removeBooking(id: r.bookingId)
            await load()
        } catch { model.show(error.message, systemImage: "exclamationmark.circle") }
    }

    private func delete() async {
        do {
            try await model.api.deleteSession(id: sessionID)
            model.show("Termin je obrisan.")
            dismiss()
        } catch { model.show(error.message, systemImage: "exclamationmark.circle") }
    }
}

/** Search a member and pick one (check-in, payments). */
struct MemberPicker: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let title: String
    var exclude: Set<String> = []
    let pick: (MemberSummary) async -> Void
    @State private var query = ""
    @State private var results: [MemberSummary] = []

    var body: some View {
        NavigationStack {
            List(results) { member in
                Button {
                    Task {
                        await pick(member)
                        dismiss()
                    }
                } label: {
                    MemberRow(member: member)
                }
                .disabled(exclude.contains(member.id))
                .listRowInsets(EdgeInsets())
            }
            .listStyle(.plain)
            .overlay { if results.isEmpty { ContentUnavailableView.search(text: query) } }
            .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always), prompt: "Ime, e-mail ili telefon")
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Odustani") { dismiss() } } }
            .task(id: query) {
                try? await Task.sleep(for: .milliseconds(250))
                results = (try? await model.api.members(query: query).members) ?? results
            }
        }
    }
}

/** Novi termin / Uredi termin: class type, day and time (studio time), length, teacher, capacity, note. */
struct SessionFormSheet: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let session: SessionView?
    let day: String
    var offeringID: String?

    @State private var offerings: [Offering] = []
    @State private var staff: [Staff] = []
    @State private var offering = ""
    @State private var start = Date()
    @State private var minutes = 60
    @State private var teacher = ""
    @State private var capacity = ""
    @State private var note = ""
    @State private var failure: String?
    @State private var saving = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Picker("Vrsta sata", selection: $offering) {
                        Text("Odaberite").tag("")
                        ForEach(offerings.filter { $0.active || $0.id == session?.offeringId }) { o in Text(o.name).tag(o.id) }
                    }
                    .onChange(of: offering) { _, id in
                        guard session == nil, let o = offerings.first(where: { $0.id == id }) else { return }
                        minutes = o.defaultDurationMin
                        teacher = o.teacherIds.first ?? ""
                    }
                    DatePicker("Početak", selection: $start, displayedComponents: [.date, .hourAndMinute])
                        .environment(\.timeZone, model.time.timeZone)
                    Stepper("Trajanje: \(minutes) min", value: $minutes, in: 5 ... 600, step: 5)
                }
                Section {
                    Picker("Učitelj", selection: $teacher) {
                        Text("Bez učitelja").tag("")
                        ForEach(staff) { s in Text(s.name).tag(s.id) }
                    }
                    TextField("Broj mjesta (prazno = zadano)", text: $capacity).keyboardType(.numberPad)
                    TextField("Napomena", text: $note, axis: .vertical)
                }
                if let failure { Section { NoticeView(message: failure) }.listRowBackground(Color.clear).listRowInsets(EdgeInsets()) }
            }
            .font(.ui(16))
            .linenBackground()
            .navigationTitle(session == nil ? "Novi termin" : "Uredi termin")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Odustani") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(session == nil ? "Dodaj" : "Spremi") { Task { await save() } }.disabled(offering.isEmpty || saving).glassButton(prominent: true)
                }
            }
        }
        .task { await prepare() }
    }

    private func prepare() async {
        let api = model.api
        async let o = api.offerings()
        async let s = api.staff()
        offerings = (try? await o) ?? []
        staff = (try? await s) ?? []
        if let session {
            offering = session.offeringId
            start = session.startsAt
            minutes = Int(session.endsAt.timeIntervalSince(session.startsAt) / 60)
            teacher = session.teacherStaffId ?? ""
            capacity = session.capacity.map(String.init) ?? ""
            note = session.note ?? ""
        } else {
            // 18:00 studio time on the chosen day, until changed.
            start = Calendar.studio(model.time).date(bySettingHour: 18, minute: 0, second: 0, of: model.time.noonDate(day)) ?? Date()
            if let id = offeringID ?? offerings.first(where: \.active)?.id { offering = id }
        }
    }

    private func save() async {
        saving = true
        defer { saving = false }
        let places = Int(capacity.trimmingCharacters(in: .whitespaces))
        let input = SessionInput(offeringId: offering, startsAt: start, endsAt: start.addingTimeInterval(Double(minutes * 60)), teacherStaffId: teacher.isEmpty ? nil : teacher, capacity: places, note: note.trimmed.isEmpty ? nil : note)
        do {
            try await model.api.saveSession(id: session?.id, input)
            model.show(session == nil ? "Termin je dodan u raspored." : "Termin je spremljen.")
            dismiss()
        } catch {
            failure = error.message
        }
    }
}

extension Calendar {
    /** The Gregorian calendar in the studio's time zone. */
    static func studio(_ time: StudioTime) -> Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = time.timeZone
        return calendar
    }
}

extension StudioTime {
    /** Noon of a studio day as an instant. */
    func noonDate(_ day: String) -> Date {
        let p = day.split(separator: "-").compactMap { Int($0) }
        guard p.count == 3 else { return Date() }
        return Calendar.studio(self).date(from: DateComponents(year: p[0], month: p[1], day: p[2], hour: 12)) ?? Date()
    }
}

/** Neradni dani: close a day (a holiday) or open it again. */
struct ClosuresSheet: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let monday: String
    @State private var closures: [Closure] = []
    @State private var date = Date()
    @State private var name = ""
    @State private var failure: String?

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    DatePicker("Datum", selection: $date, displayedComponents: .date).environment(\.timeZone, model.time.timeZone)
                    TextField("Naziv, npr. Božić", text: $name)
                    Button("Označi neradni dan") { Task { await add() } }.disabled(name.trimmed.isEmpty)
                } footer: {
                    Text("Satovi tog dana ostaju u rasporedu kao otkazani i na njih se ne može evidentirati dolazak. Kad uklonite neradni dan, vraćaju se.")
                }
                Section("U ovom tjednu") {
                    if closures.isEmpty { Text("U ovom tjednu nema neradnih dana.").foregroundStyle(DS.muted) }
                    ForEach(closures) { c in
                        LabeledContent(c.name, value: model.time.display(c.date))
                            .swipeActions { Button("Ukloni", role: .destructive) { Task { await remove(c) } } }
                    }
                }
                if let failure { Section { NoticeView(message: failure) }.listRowBackground(Color.clear).listRowInsets(EdgeInsets()) }
            }
            .font(.ui(16))
            .linenBackground()
            .navigationTitle("Neradni dani")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Gotovo") { dismiss() } } }
        }
        .task {
            date = model.time.noonDate(model.time.monday(of: model.time.today()) == monday ? model.time.today() : monday)
            await load()
        }
    }

    private func load() async {
        closures = (try? await model.api.closures(from: monday, to: model.time.addDays(monday, 6))) ?? []
    }

    private func add() async {
        let day = model.time.day(of: date)
        do {
            try await model.api.addClosure(date: day, name: name)
            model.show("\(model.time.display(day)) je neradni dan.")
            name = ""
            failure = nil
            await load()
        } catch { failure = error.message }
    }

    private func remove(_ c: Closure) async {
        do {
            try await model.api.removeClosure(id: c.id)
            model.show("\(model.time.display(c.date)) više nije neradni dan.")
            await load()
        } catch { failure = error.message }
    }
}
