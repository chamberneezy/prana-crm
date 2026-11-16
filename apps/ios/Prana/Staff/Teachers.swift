import PranaKit
import SwiftUI

/** Učitelji: who teaches which classes. */
struct TeachersScreen: View {
    @Environment(AppModel.self) private var model
    @State private var staff: [Staff] = []
    @State private var offerings: [Offering] = []
    @State private var editing: Staff?
    @State private var creating = false
    @State private var failure: String?

    var body: some View {
        List {
            Section {
                Text("Tko vodi koje satove. Učitelji dodani ovdje ne prijavljuju se u aplikaciju.").font(.ui(13)).foregroundStyle(DS.muted)
                if let failure { NoticeView(message: failure) }
            }
            .listRowBackground(Color.clear)
            Section {
                if staff.isEmpty { Text("Još nema učitelja").foregroundStyle(DS.muted) }
                ForEach(staff) { person in
                    Button { editing = person } label: {
                        HStack(alignment: .top, spacing: 12) {
                            Avatar(name: person.name)
                            VStack(alignment: .leading, spacing: 6) {
                                HStack {
                                    Text(person.name).font(.ui(16, .semibold))
                                    if person.role == .owner { TagView("Vlasnik", kind: .plan) }
                                }
                                let teaches = offerings.filter { $0.teacherIds.contains(person.id) }
                                if teaches.isEmpty {
                                    Text("—").foregroundStyle(DS.muted)
                                } else {
                                    ForEach(teaches) { o in
                                        HStack(spacing: 6) {
                                            ClassPill(color: o.colorToken, width: 6, height: 14)
                                            Text(o.name).font(.ui(13)).foregroundStyle(DS.inkMuted)
                                        }
                                    }
                                }
                            }
                            Spacer()
                        }
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .font(.ui(15))
        .linenBackground()
        .navigationTitle("Učitelji")
        .toolbar(.hidden, for: .tabBar)
        .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Novi učitelj", systemImage: "plus") { creating = true } } }
        .refreshable { await load() }
        .task { await load() }
        .sheet(item: $editing, onDismiss: { Task { await load() } }) { person in TeacherForm(person: person, offerings: offerings) }
        .sheet(isPresented: $creating, onDismiss: { Task { await load() } }) { TeacherForm(person: nil, offerings: offerings) }
    }

    private func load() async {
        do {
            let api = model.api
            async let s = api.staff()
            async let o = api.offerings()
            (staff, offerings) = try await (s, o)
            failure = nil
        } catch { failure = error.message }
    }
}

struct TeacherForm: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let person: Staff?
    let offerings: [Offering]
    @State private var name = ""
    @State private var ticked: Set<String> = []
    @State private var confirmRemove = false
    @State private var failure: String?
    private var isOwner: Bool { person?.role == .owner }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Ime", text: $name).disabled(isOwner)
                } footer: {
                    if isOwner { Text("Ime vlasnika ovdje se ne mijenja.") }
                }
                Section {
                    ForEach(offerings) { o in
                        Toggle(isOn: Binding(get: { ticked.contains(o.id) }, set: { if $0 { ticked.insert(o.id) } else { ticked.remove(o.id) } })) {
                            HStack { ClassPill(color: o.colorToken, width: 6, height: 16); Text(o.name) }
                        }
                        .tint(DS.sageDeep)
                    }
                } header: {
                    Text("Vodi satove")
                } footer: {
                    Text("Novi termini dobivaju prvog učitelja vrste sata; redoslijed mijenjate u Vrstama satova.")
                }
                if person != nil, !isOwner {
                    Section { Button("Ukloni učitelja", role: .destructive) { confirmRemove = true } }
                }
                if let failure { Section { NoticeView(message: failure) }.listRowBackground(Color.clear).listRowInsets(EdgeInsets()) }
            }
            .font(.ui(16))
            .linenBackground()
            .navigationTitle(person == nil ? "Novi učitelj" : "Uredi učitelja")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Odustani") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) { Button("Spremi") { Task { await save() } }.disabled(name.trimmed.isEmpty).glassButton(prominent: true) }
            }
            .confirmationDialog("Ukloniti učitelja \(person?.name ?? "")?", isPresented: $confirmRemove, titleVisibility: .visible) {
                Button("Ukloni", role: .destructive) { Task { await remove() } }
            } message: { Text("Vrste satova i standardni tjedan više ga neće navoditi. Termini u rasporedu zadržavaju ime.") }
        }
        .onAppear {
            name = person?.name ?? ""
            if let person { ticked = Set(offerings.filter { $0.teacherIds.contains(person.id) }.map(\.id)) }
        }
    }

    private func save() async {
        do {
            var id = person?.id
            if let person {
                if !isOwner, name.trimmed != person.name { try await model.api.renameTeacher(id: person.id, name: name) }
            } else {
                id = try await model.api.addTeacher(name: name).id
            }
            try await model.api.setTeacherOfferings(id: id!, offeringIDs: Array(ticked))
            model.show("\(name.trimmed) je spremljen/a.")
            dismiss()
        } catch { failure = error.message }
    }

    private func remove() async {
        guard let person else { return }
        do {
            try await model.api.removeTeacher(id: person.id)
            model.show("\(person.name) je uklonjen/a.")
            dismiss()
        } catch { failure = error.message }
    }
}
