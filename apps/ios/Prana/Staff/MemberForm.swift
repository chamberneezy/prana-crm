import PranaKit
import SwiftUI

/** The upisnica as a form: new (typed in or read from a form, to review) or a change to a member. */
struct MemberFormView: View {
    enum Mode {
        case create(ReviewDraft)
        case edit(Member)
    }

    @Environment(AppModel.self) private var model
    let mode: Mode
    let done: () -> Void

    @State private var input = MemberInput()
    @State private var dob = ""
    @State private var signed = ""
    @State private var plans: [Plan] = []
    @State private var planID = ""
    @State private var paid: PaymentMethod?
    @State private var flagged: Set<ScanField> = []
    @State private var tried = false
    @State private var saving = false
    @State private var failure: String?

    private var isNew: Bool { if case .create = mode { true } else { false } }

    var body: some View {
        Form {
            if case let .create(draft) = mode, draft.recognition != nil {
                Section {
                    let total = ScanField.allCases.count
                    HStack {
                        Image(systemName: "doc.text.viewfinder").font(.system(size: 26, weight: .light)).foregroundStyle(DS.sageDeep)
                        VStack(alignment: .leading) {
                            Text("Upisnica prepoznata").font(.ui(15, .semibold))
                            Text("\(total - draft.needsReview.count) polja sigurno · \(draft.needsReview.count) za provjeru").font(.ui(13)).foregroundStyle(DS.muted)
                        }
                    }
                }
            }
            Section("Osobni podaci") {
                field("Ime", text: $input.firstName, flag: .name, error: tried && input.firstName.trimmed.isEmpty ? "Upišite ime." : nil)
                    .textContentType(.givenName)
                field("Prezime", text: $input.lastName, flag: .name, error: tried && input.lastName.trimmed.isEmpty ? "Upišite prezime." : nil)
                    .textContentType(.familyName)
                field("E-mail", text: optional(\.email), flag: .email, error: nil)
                    .keyboardType(.emailAddress).textInputAutocapitalization(.never)
                field("Mobitel", text: optional(\.phone), flag: .phone, error: nil).keyboardType(.phonePad)
                field("Datum rođenja (dd.mm.gggg.)", text: $dob, flag: .dob, error: tried && !dob.isEmpty && displayToIso(dob) == nil ? "Upišite datum, npr. 14.03.1988." : nil)
                    .keyboardType(.numbersAndPunctuation)
                Toggle("Student / umirovljenik / nezaposlen", isOn: $input.isStudentOrRetired).tint(DS.sageDeep).flagged(flagged.contains(.student))
            }
            if isNew {
                Section {
                    Picker("Članarina", selection: $planID) {
                        Text("Bez članarine").tag("")
                        ForEach(plans) { p in Text(p.name).tag(p.id) }
                    }
                    .flagged(flagged.contains(.plan))
                    if !planID.isEmpty {
                        Picker("Plaćeno?", selection: $paid) {
                            Text("Ne još").tag(PaymentMethod?.none)
                            ForEach(PaymentMethod.allCases) { Text($0.label).tag(Optional($0)) }
                        }
                    }
                } header: { Text("Članstvo") }
            }
            Section("Važno za vašu praksu") {
                Toggle("Zdravstvene poteškoće", isOn: $input.healthFlag).tint(DS.terracotta).flagged(flagged.contains(.health))
                if input.healthFlag {
                    TextField("Molimo navedite", text: optional(\.healthText), axis: .vertical).lineLimit(2 ... 5).flagged(flagged.contains(.healthText))
                    Text("Vidi ga samo učitelj na popisu sata.").font(.ui(12)).foregroundStyle(DS.muted)
                }
            }
            if isNew {
                Section {
                    Toggle("Potvrđujem da su navedeni podaci točni", isOn: $input.consentAccuracy).tint(DS.sageDeep).flagged(flagged.contains(.consent) || (tried && !input.consentAccuracy))
                    Toggle("Želim primati obavijesti e-mailom", isOn: $input.consentNews).tint(DS.sageDeep).flagged(flagged.contains(.news))
                } header: { Text("Suglasnosti") } footer: {
                    if tried && !input.consentAccuracy { Text("Potrebna je potvrda točnosti podataka.").foregroundStyle(DS.clayText) }
                }
                Section("Mjesto i datum") {
                    TextField("Mjesto", text: optional(\.signedPlace)).flagged(flagged.contains(.place))
                    TextField("Datum (dd.mm.gggg.)", text: $signed).keyboardType(.numbersAndPunctuation).flagged(flagged.contains(.date))
                }
            }
            Section("Napomena") { TextField("Napomena", text: optional(\.notes), axis: .vertical) }
            if let failure { Section { NoticeView(message: failure) }.listRowBackground(Color.clear).listRowInsets(EdgeInsets()) }
        }
        .font(.ui(16))
        .linenBackground()
        .navigationTitle(isNew ? "Provjerite podatke" : "Uredi člana")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button(isNew ? "Spremi člana" : "Spremi") { Task { await save() } }.disabled(saving).glassButton(prominent: true)
            }
        }
        .task { await prepare() }
    }

    private func field(_ label: String, text: Binding<String>, flag: ScanField, error: String?) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            TextField(label, text: text)
            if let error { Text(error).font(.ui(12)).foregroundStyle(DS.clayText) }
            else if flagged.contains(flag) { Text(flagMessage(flag)).font(.ui(12)).foregroundStyle(DS.clayText) }
        }
        .flagged(flagged.contains(flag) || error != nil)
    }

    private func flagMessage(_ field: ScanField) -> String {
        switch field {
        case .phone, .dob: "Jedna znamenka nije čitljiva. Provjerite broj."
        case .email: "Provjerite adresu."
        default: "Rukopis je nejasan. Provjerite tekst."
        }
    }

    /** A binding to an optional text field of the input, empty for nil. */
    private func optional(_ path: WritableKeyPath<MemberInput, String?>) -> Binding<String> {
        Binding(get: { input[keyPath: path] ?? "" }, set: { input[keyPath: path] = $0 })
    }

    private func prepare() async {
        switch mode {
        case let .create(draft):
            input = draft.input
            flagged = draft.needsReview
            plans = (try? await model.api.plans()) ?? []
            if let code = draft.planCode { planID = plans.first { $0.code == code }?.id ?? "" }
        case let .edit(member):
            input = MemberInput(member: member)
        }
        dob = input.dob.map { model.time.display($0) } ?? ""
        signed = input.signedDate.map { model.time.display($0) } ?? ""
    }

    private func save() async {
        tried = true
        guard !input.firstName.trimmed.isEmpty, !input.lastName.trimmed.isEmpty else { return }
        if !dob.isEmpty, displayToIso(dob) == nil { return }
        if isNew, !input.consentAccuracy { return }
        saving = true
        defer { saving = false }
        var body = input
        body.dob = dob.isEmpty ? nil : displayToIso(dob)
        body.signedDate = signed.isEmpty ? nil : displayToIso(signed)
        do {
            switch mode {
            case let .create(draft):
                body.planId = planID.isEmpty ? nil : planID
                body.paidWith = planID.isEmpty ? nil : paid
                let created = try await model.api.createMember(body)
                // The upisnica goes with the member; if that fails, the member is still saved.
                if let file = draft.file {
                    let (data, name, mime, source) = file
                    if let document = try? await model.api.uploadDocument(data: data, filename: name, mime: mime, source: source) {
                        try? await model.api.linkDocument(id: document.id, memberID: created.member.id, recognition: draft.recognition)
                    }
                }
                model.show("\(created.member.fullName) je spremljen/a kao novi član.")
            case let .edit(member):
                try await model.api.updateMember(id: member.id, body)
                model.show("Promjene su spremljene.")
            }
            done()
        } catch {
            failure = error.message
        }
    }
}

/** For editing from the profile. */
struct MemberFormSheet: View {
    @Environment(\.dismiss) private var dismiss
    let mode: MemberFormView.Mode
    var body: some View {
        NavigationStack {
            MemberFormView(mode: mode) { dismiss() }
                .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Odustani") { dismiss() } } }
        }
    }
}

private struct Flagged: ViewModifier {
    let on: Bool
    func body(content: Content) -> some View {
        content.listRowBackground(on ? DS.blush.opacity(0.55) : DS.white)
    }
}

extension View {
    /** A field the recogniser wasn't sure of, or one with an error: blush, like the web's review. */
    func flagged(_ on: Bool) -> some View { modifier(Flagged(on: on)) }
}

/** "14.3.1988", "14.03.88", "14/3/1988" → "1988-03-14"; nil if it isn't a real date. Same as the web. */
func displayToIso(_ text: String, thisYear: Int = Calendar(identifier: .gregorian).component(.year, from: Date())) -> String? {
    let trimmed = text.trimmingCharacters(in: .whitespaces)
    let pattern = #"^(\d{1,2})\s*[./\- ]\s*(\d{1,2})\s*[./\- ]\s*(\d{2}|\d{4})\s*\.?$"#
    guard let regex = try? NSRegularExpression(pattern: pattern),
          let m = regex.firstMatch(in: trimmed, range: NSRange(trimmed.startIndex..., in: trimmed)),
          let d = Range(m.range(at: 1), in: trimmed).flatMap({ Int(trimmed[$0]) }),
          let mo = Range(m.range(at: 2), in: trimmed).flatMap({ Int(trimmed[$0]) }),
          let yRange = Range(m.range(at: 3), in: trimmed), var y = Int(trimmed[yRange]) else { return nil }
    if trimmed[yRange].count == 2 { y += y <= thisYear % 100 ? thisYear / 100 * 100 : thisYear / 100 * 100 - 100 }
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = TimeZone(identifier: "UTC")!
    guard let date = calendar.date(from: DateComponents(year: y, month: mo, day: d)) else { return nil }
    let c = calendar.dateComponents([.year, .month, .day], from: date)
    guard c.year == y, c.month == mo, c.day == d else { return nil }
    return String(format: "%04d-%02d-%02d", y, mo, d)
}
