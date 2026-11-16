import PranaKit
import SwiftUI

/** Vrste satova: templates with no day or time, grouped; who teaches each. */
struct OfferingsScreen: View {
    @Environment(AppModel.self) private var model
    @State private var groups: [OfferingGroup] = []
    @State private var offerings: [Offering] = []
    @State private var staff: [Staff] = []
    @State private var failure: String?
    @State private var editing: Offering?
    @State private var creating = false
    @State private var scheduling: Offering?
    @State private var newGroup = false
    @State private var groupName = ""

    var body: some View {
        List {
            Section {
                Text("Predlošci za planiranje. Dan i vrijeme birate tek kad dodajete termin.").font(.ui(13)).foregroundStyle(DS.muted)
                if let failure { NoticeView(message: failure) }
            }
            .listRowBackground(Color.clear)
            ForEach(groups) { group in
                let rows = offerings.filter { $0.groupId == group.id }
                Section {
                    if rows.isEmpty { Text("U ovoj skupini još nema vrsta sata.").foregroundStyle(DS.muted) }
                    ForEach(rows) { o in
                        Button { editing = o } label: { row(o) }
                            .buttonStyle(.plain)
                            .swipeActions(edge: .leading) {
                                if o.active { Button("Zakaži") { scheduling = o }.tint(DS.sageDeep) }
                            }
                    }
                } header: {
                    Text("\(group.name) · \(rows.count)")
                }
            }
            Section {
                Button("Nova skupina", systemImage: "folder.badge.plus") { newGroup = true }
            } footer: {
                Text("Npr. za masaže, radionice i retreatove.")
            }
        }
        .font(.ui(15))
        .linenBackground()
        .navigationTitle("Vrste satova")
        .toolbar(.hidden, for: .tabBar)
        .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Nova vrsta sata", systemImage: "plus") { creating = true }.disabled(groups.isEmpty) } }
        .refreshable { await load() }
        .task { await load() }
        .sheet(item: $editing, onDismiss: { Task { await load() } }) { o in OfferingForm(offering: o, groups: groups, staff: staff) }
        .sheet(isPresented: $creating, onDismiss: { Task { await load() } }) { OfferingForm(offering: nil, groups: groups, staff: staff) }
        .sheet(item: $scheduling, onDismiss: { Task { await load() } }) { o in SessionFormSheet(session: nil, day: model.time.today(), offeringID: o.id) }
        .alert("Nova skupina", isPresented: $newGroup) {
            TextField("Naziv skupine", text: $groupName)
            Button("Dodaj") { Task { await addGroup() } }
            Button("Odustani", role: .cancel) { groupName = "" }
        }
    }

    private func row(_ o: Offering) -> some View {
        let teachers = o.teacherIds.compactMap { id in staff.first { $0.id == id }?.name }.joined(separator: ", ")
        return HStack(alignment: .top, spacing: 12) {
            ClassPill(color: o.colorToken, width: 10)
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text(o.name).font(.ui(16, .semibold))
                    if !o.active { TagView("Neaktivno") }
                }
                HStack(spacing: 6) {
                    TagView("\(o.defaultDurationMin) min")
                    if let rule = o.entryRule { TagView(rule, kind: .flag) }
                }
                Text(teachers.isEmpty ? "Bez učitelja" : "Vodi: \(teachers)").font(.ui(13)).foregroundStyle(DS.muted)
                if let count = o.sessionsThisWeek { Text("Termina ovaj tjedan: \(count)").font(.ui(12)).foregroundStyle(DS.muted) }
            }
            Spacer()
            Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(DS.field)
        }
        .padding(.vertical, 4)
        .contentShape(Rectangle())
    }

    private func load() async {
        do {
            let api = model.api
            async let g = api.offeringGroups()
            async let o = api.offerings()
            async let s = api.staff()
            (groups, offerings, staff) = try await (g, o, s)
            failure = nil
        } catch { failure = error.message }
    }

    private func addGroup() async {
        guard !groupName.trimmed.isEmpty else { return }
        do {
            try await model.api.addOfferingGroup(name: groupName)
            model.show("Skupina \(groupName.trimmed) je dodana.")
            groupName = ""
            await load()
        } catch { failure = error.message }
    }
}

/** Nova / Uredi vrstu sata. Ticked teachers in order: the first teaches new sessions. */
struct OfferingForm: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let offering: Offering?
    let groups: [OfferingGroup]
    @State var staff: [Staff]

    @State private var name = ""
    @State private var groupID = ""
    @State private var color = ColorToken.spine
    @State private var minutes = 60
    @State private var entryRule = ""
    @State private var capacity = ""
    @State private var active = true
    @State private var teachers: [String] = []
    @State private var newTeacher = ""
    @State private var failure: String?

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Naziv", text: $name)
                    Picker("Skupina", selection: $groupID) { ForEach(groups) { Text($0.name).tag($0.id) } }
                    Stepper("Trajanje: \(minutes) min", value: $minutes, in: 5 ... 600, step: 5)
                    TextField("Pravilo ulaza, npr. Ulaz do 60 min nakon početka", text: $entryRule)
                    TextField("Broj mjesta (prazno = bez ograničenja)", text: $capacity).keyboardType(.numberPad)
                    Toggle("Aktivna", isOn: $active).tint(DS.sageDeep)
                }
                Section("Boja") {
                    LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 6)) {
                        ForEach(ColorToken.allCases, id: \.self) { token in
                            Button { color = token } label: {
                                ClassPill(color: token, width: 12, height: 26)
                                    .frame(width: 44, height: 44)
                                    .background(color == token ? DS.mist : .clear, in: RoundedRectangle(cornerRadius: 8))
                                    .overlay(RoundedRectangle(cornerRadius: 8).strokeBorder(color == token ? DS.sageDeep : DS.line))
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel(token.label)
                            .accessibilityAddTraits(color == token ? .isSelected : [])
                        }
                    }
                }
                Section {
                    ForEach(staff) { person in
                        Toggle(isOn: Binding(get: { teachers.contains(person.id) }, set: { on in
                            teachers.removeAll { $0 == person.id }
                            if on { teachers.append(person.id) }
                        })) {
                            Text(person.name + (teachers.first == person.id && teachers.count > 1 ? " · prvi" : ""))
                        }
                        .tint(DS.sageDeep)
                    }
                    HStack {
                        TextField("Ime učitelja", text: $newTeacher)
                        Button("Dodaj") { Task { await addTeacher() } }.disabled(newTeacher.trimmed.isEmpty)
                    }
                } header: {
                    Text("Tko vodi")
                } footer: {
                    Text("Novi termini dobivaju prvog označenog učitelja.")
                }
                if let failure { Section { NoticeView(message: failure) }.listRowBackground(Color.clear).listRowInsets(EdgeInsets()) }
            }
            .font(.ui(16))
            .linenBackground()
            .navigationTitle(offering == nil ? "Nova vrsta sata" : "Uredi vrstu sata")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Odustani") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) { Button("Spremi") { Task { await save() } }.disabled(name.trimmed.isEmpty).glassButton(prominent: true) }
            }
        }
        .onAppear {
            guard let o = offering else { groupID = groups.first?.id ?? ""; return }
            name = o.name
            groupID = o.groupId
            color = o.colorToken
            minutes = o.defaultDurationMin
            entryRule = o.entryRule ?? ""
            capacity = o.defaultCapacity.map(String.init) ?? ""
            active = o.active
            teachers = o.teacherIds
        }
    }

    private func addTeacher() async {
        do {
            let person = try await model.api.addTeacher(name: newTeacher)
            staff.append(person)
            teachers.append(person.id)
            newTeacher = ""
            model.show("\(person.name) je dodan/a kao učitelj.")
        } catch { failure = error.message }
    }

    private func save() async {
        let input = OfferingInput(groupId: groupID, name: name.trimmed, colorToken: color, defaultDurationMin: minutes, entryRule: entryRule.trimmed.isEmpty ? nil : entryRule.trimmed, defaultCapacity: Int(capacity), active: active, teacherIds: teachers)
        do {
            let saved = try await model.api.saveOffering(id: offering?.id, input)
            model.show("\(saved.name) je spremljena.")
            dismiss()
        } catch { failure = error.message }
    }
}
