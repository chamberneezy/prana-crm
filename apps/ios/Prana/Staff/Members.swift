import PranaKit
import QuickLook
import SwiftUI

/** Članovi: search, filter by status, open a profile. */
struct MembersScreen: View {
    @Environment(AppModel.self) private var model
    let enroll: () -> Void
    @State private var query = ""
    @State private var status: MemberStatus?
    @State private var state: Loadable<MembersResponse> = .loading

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    PageTitle(title: "Članovi", overline: state.value.map { plural($0.counts.all, "član", "člana", "članova") })
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            chip(nil, "Svi")
                            ForEach([MemberStatus.active, .expiring, .unpaid, .trial, .frozen, .none], id: \.self) { chip($0, $0.filterLabel) }
                        }
                    }
                    LoadingView(state: state, retry: load) { response in
                        if response.members.isEmpty {
                            EmptyStateView(title: "Nema članova za ovu pretragu", systemImage: "person.crop.circle.badge.questionmark")
                        } else {
                            LazyVStack(spacing: 0) {
                                ForEach(response.members) { member in
                                    NavigationLink { MemberProfileScreen(memberID: member.id) } label: { MemberRow(member: member) }.buttonStyle(.plain)
                                    if member.id != response.members.last?.id { Divider().overlay(DS.lineSoft).padding(.leading, 62) }
                                }
                            }
                            .card(padding: 0)
                        }
                    }
                }
                .padding(.horizontal, DS.gutter)
                .padding(.bottom, 32)
            }
            .linenBackground()
            .searchable(text: $query, prompt: "Ime, e-mail ili telefon")
            .refreshable { await load() }
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Novi član", systemImage: "person.badge.plus", action: enroll) } }
            .task(id: "\(query)|\(status?.rawValue ?? "")") {
                try? await Task.sleep(for: .milliseconds(200))
                await load()
            }
        }
    }

    private func chip(_ value: MemberStatus?, _ label: String) -> some View {
        let chosen = status == value
        let count = state.value?.counts.count(value)
        return Button { status = value } label: {
            Text(count.map { "\(label) \($0)" } ?? label)
                .font(.ui(13, .semibold))
                .padding(.horizontal, 14)
                .frame(minHeight: 36)
                .foregroundStyle(chosen ? DS.white : DS.ink)
                .background(chosen ? DS.ink : DS.white, in: Capsule())
                .overlay(Capsule().strokeBorder(chosen ? .clear : DS.line))
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(chosen ? .isSelected : [])
        .sensoryFeedback(.selection, trigger: status)
    }

    private func load() async {
        do { state = .loaded(try await model.api.members(query: query, status: status)) } catch { state = .failed(error.message) }
    }
}

/** Profil člana: identity, health note, membership with its actions, contact, visits, payments, the upisnica. */
struct MemberProfileScreen: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let memberID: String
    @State private var state: Loadable<MemberDetail> = .loading
    @State private var plans: [Plan] = []
    @State private var editing = false
    @State private var paying = false
    @State private var freezing = false
    @State private var confirmDelete = false
    @State private var document: URL?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                LoadingView(state: state, retry: load) { detail in content(detail) }
            }
            .padding(.horizontal, DS.gutter)
            .padding(.bottom, 32)
        }
        .linenBackground()
        .navigationTitle(state.value?.member.fullName ?? "Član")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.hidden, for: .tabBar)
        .refreshable { await load() }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button("Uredi", systemImage: "pencil") { editing = true }
                    Button("Zabilježi uplatu", systemImage: "eurosign") { paying = true }
                    Button("Obriši člana", systemImage: "trash", role: .destructive) { confirmDelete = true }
                } label: { Image(systemName: "ellipsis") }
            }
        }
        .task {
            await load()
            plans = (try? await model.api.plans()) ?? []
        }
        .sheet(isPresented: $editing, onDismiss: { Task { await load() } }) {
            if let member = state.value?.member { MemberFormSheet(mode: .edit(member)) }
        }
        .sheet(isPresented: $paying, onDismiss: { Task { await load() } }) {
            if let detail = state.value { PaymentFormSheet(member: detail.summary) }
        }
        .sheet(isPresented: $freezing, onDismiss: { Task { await load() } }) {
            if let membership = state.value?.summary.membership { FreezeSheet(membership: membership) }
        }
        .confirmationDialog("Obrisati člana?", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("Obriši", role: .destructive) { Task { await delete() } }
        } message: { Text("Briše se član s članarinama, dolascima i spremljenom upisnicom. To se ne može poništiti.") }
        .quickLookPreview($document)
    }

    @ViewBuilder
    private func content(_ detail: MemberDetail) -> some View {
        let m = detail.member
        let s = detail.summary
        let time = model.time
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 14) {
                Avatar(name: m.fullName, size: 56)
                VStack(alignment: .leading, spacing: 4) {
                    Text(m.fullName).font(.display(22, relativeTo: .title2))
                    Text("Član od \(time.display(m.memberSince))").font(.ui(13)).foregroundStyle(DS.muted)
                }
            }
            HStack(spacing: 6) {
                StatusChip(status: s.status, daysLeft: s.daysLeft)
                if let plan = s.membership?.planName { TagView(plan, kind: .plan) }
                if m.isStudentOrRetired { TagView("Student / umirovljenik", kind: .flag) }
            }
        }
        .card()

        if m.healthFlag {
            VStack(alignment: .leading, spacing: 6) {
                Text("Zdravstvena napomena").font(.ui(13, .semibold)).foregroundStyle(DS.clayText)
                Text(m.healthText ?? "—").font(.ui(15))
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(DS.blush, in: RoundedRectangle(cornerRadius: DS.radius))
        }

        MembershipCard(summary: s, plans: plans, time: time, onChange: { await load() }, freeze: { freezing = true }, pay: { paying = true })

        VStack(alignment: .leading, spacing: 10) {
            Text("Kontakt").font(.ui(15, .semibold))
            if let email = m.email, let url = URL(string: "mailto:\(email)") { Link(destination: url) { Label(email, systemImage: "envelope") } }
            if let phone = m.phone, let url = URL(string: "tel:\(phone.filter { $0.isNumber || $0 == "+" })") { Link(destination: url) { Label(phone, systemImage: "phone") } }
            if let dob = m.dob { Label("\(time.display(dob)) · \(age(dob)) god.", systemImage: "gift") }
            if let notes = m.notes { Text(notes).font(.ui(14)).foregroundStyle(DS.inkMuted) }
        }
        .font(.ui(15))
        .tint(DS.sageDeep)
        .card()

        VStack(alignment: .leading, spacing: 10) {
            Text("Zadnji dolasci").font(.ui(15, .semibold))
            if detail.visits.isEmpty { Text("Još nema dolazaka").font(.ui(14)).foregroundStyle(DS.muted) }
            ForEach(detail.visits.prefix(10)) { v in
                HStack(spacing: 10) {
                    ClassPill(color: v.colorToken, width: 6, height: 16)
                    Text(v.offeringName).font(.ui(14))
                    Spacer()
                    Text(time.dayMonth(time.day(of: v.startsAt))).font(.ui(13)).foregroundStyle(DS.muted).monospacedDigit()
                }
            }
        }
        .card()

        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Uplate").font(.ui(15, .semibold))
                Spacer()
                Button("Zabilježi uplatu") { paying = true }.buttonStyle(.ds(.secondary, compact: true))
            }
            if detail.payments.isEmpty { Text("Još nema uplata").font(.ui(14)).foregroundStyle(DS.muted) }
            ForEach(detail.payments) { p in
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(time.display(time.day(of: p.paidAt))).font(.ui(14)).monospacedDigit()
                        Text([p.planName, PaymentMethod(rawValue: p.method)?.label].compactMap { $0 }.joined(separator: " · ")).font(.ui(12)).foregroundStyle(DS.muted)
                    }
                    Spacer()
                    Text(formatMoney(cents: p.amountCents)).font(.ui(15, .semibold)).monospacedDigit()
                }
            }
        }
        .card()

        if !detail.documents.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                Text("Upisnica").font(.ui(15, .semibold))
                ForEach(detail.documents) { d in
                    Button { Task { await open(d) } } label: { Label(d.filename ?? "Upisnica", systemImage: "doc.text") }.tint(DS.sageDeep)
                }
            }
            .card()
        }
    }

    private func age(_ dob: String) -> Int {
        let p = dob.split(separator: "-").compactMap { Int($0) }
        let t = model.time.today().split(separator: "-").compactMap { Int($0) }
        guard p.count == 3, t.count == 3 else { return 0 }
        return t[0] - p[0] - ((t[1], t[2]) < (p[1], p[2]) ? 1 : 0)
    }

    private func load() async {
        do { state = .loaded(try await model.api.member(id: memberID)) } catch { state = .failed(error.message) }
    }

    private func open(_ d: StoredDocument) async {
        do {
            let data = try await model.api.documentFile(id: d.id)
            let ext = d.mime == "application/pdf" ? "pdf" : (d.mime == "image/png" ? "png" : "jpg")
            let url = FileManager.default.temporaryDirectory.appendingPathComponent("upisnica-\(d.id).\(ext)")
            try data.write(to: url, options: [.atomic, .completeFileProtection])
            document = url
        } catch { model.show(error.message, systemImage: "exclamationmark.circle") }
    }

    private func delete() async {
        do {
            try await model.api.deleteMember(id: memberID)
            model.show("Član je obrisan.")
            dismiss()
        } catch { model.show(error.message, systemImage: "exclamationmark.circle") }
    }
}

/** Članarina: plan, visits as segments, valid until, debt; renew, freeze, start one. */
struct MembershipCard: View {
    @Environment(AppModel.self) private var model
    let summary: MemberSummary
    let plans: [Plan]
    let time: StudioTime
    let onChange: () async -> Void
    let freeze: () -> Void
    let pay: () -> Void
    @State private var working = false

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if let m = summary.membership {
                HStack {
                    Text("Članarina · \(m.planName)").font(.ui(15, .semibold))
                    Spacer()
                    Text(m.visitsTotal.map { "\(m.visitsUsed)/\($0)" } ?? "\(m.visitsUsed)").font(.ui(20, .semibold)).monospacedDigit()
                }
                if let total = m.visitsTotal, total > 0 {
                    HStack(spacing: 4) {
                        ForEach(0 ..< total, id: \.self) { i in
                            Capsule().fill(i < m.visitsUsed ? DS.sageDeep : DS.mistStrong).frame(height: 6)
                        }
                    }
                    .accessibilityLabel("Iskorišteno \(m.visitsUsed) od \(total)")
                }
                Text(validity(m)).font(.ui(13)).foregroundStyle(summary.status == .expiring ? DS.amberFg : DS.muted)
                if summary.debtCents > 0 {
                    Text("Duguje \(formatMoney(cents: summary.debtCents))").font(.ui(13, .semibold)).foregroundStyle(DS.clayText)
                }
                HStack(spacing: 8) {
                    if m.renewedUntil == nil {
                        Menu {
                            Button("Isti plan: \(m.planName)") { Task { await renew(m, plan: nil) } }
                            ForEach(plans.filter { $0.code != m.planCode || $0.isCustom }) { p in
                                Button(p.name) { Task { await renew(m, plan: p.id) } }
                            }
                        } label: { Text("Produži članarinu") }
                            .buttonStyle(.ds(.primary, compact: true))
                    }
                    Button(m.frozenUntil == nil ? "Zamrzni" : "Odmrzni") {
                        if m.frozenUntil == nil { freeze() } else { Task { await unfreeze(m) } }
                    }
                    .buttonStyle(.ds(.secondary, compact: true))
                    if summary.debtCents > 0 { Button("Uplata", action: pay).buttonStyle(.ds(.ghost, compact: true)) }
                }
            } else {
                Text("Bez članarine").font(.ui(15, .semibold))
                Menu {
                    ForEach(plans) { p in Button(p.name) { Task { await start(p) } } }
                } label: { Text("Nova članarina") }
                    .buttonStyle(.ds(.primary, compact: true))
            }
        }
        .disabled(working)
        .card()
    }

    private func validity(_ m: MembershipView) -> String {
        if let frozen = m.frozenUntil { return "Zamrznuta do \(time.display(frozen))" }
        if let renewed = m.renewedUntil { return "Vrijedi do \(time.display(m.periodEnd)) · produžena do \(time.display(renewed))" }
        return "Vrijedi do \(time.display(m.periodEnd))"
    }

    private func renew(_ m: MembershipView, plan: String?) async {
        working = true
        defer { working = false }
        do {
            try await model.api.renewMembership(id: m.id, planID: plan)
            model.show("Članarina je produžena.")
            await onChange()
        } catch { model.show(error.message, systemImage: "exclamationmark.circle") }
    }

    private func unfreeze(_ m: MembershipView) async {
        do {
            try await model.api.freezeMembership(id: m.id, until: nil)
            model.show("Članarina više nije zamrznuta.")
            await onChange()
        } catch { model.show(error.message, systemImage: "exclamationmark.circle") }
    }

    private func start(_ plan: Plan) async {
        do {
            try await model.api.startMembership(memberID: summary.id, planID: plan.id)
            model.show("Članarina je dodana.")
            await onChange()
        } catch { model.show(error.message, systemImage: "exclamationmark.circle") }
    }
}

struct FreezeSheet: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let membership: MembershipView
    @State private var until = Date().addingTimeInterval(14 * 86400)
    @State private var failure: String?

    var body: some View {
        NavigationStack {
            Form {
                DatePicker("Zamrznuta do", selection: $until, in: Date()..., displayedComponents: .date).environment(\.timeZone, model.time.timeZone)
                if let failure { NoticeView(message: failure) }
            }
            .font(.ui(16))
            .linenBackground()
            .navigationTitle("Zamrzni članarinu")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Odustani") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) { Button("Zamrzni") { Task { await save() } }.glassButton(prominent: true) }
            }
        }
        .presentationDetents([.medium])
    }

    private func save() async {
        let day = model.time.day(of: until)
        do {
            try await model.api.freezeMembership(id: membership.id, until: day)
            model.show("Članarina je zamrznuta do \(model.time.display(day))")
            dismiss()
        } catch { failure = error.message }
    }
}

/** Zabilježi uplatu: amount (defaults to what is owed), method, note. */
struct PaymentFormSheet: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let member: MemberSummary
    @State private var amount = ""
    @State private var method = PaymentMethod.cash
    @State private var note = ""
    @State private var failure: String?

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    LabeledContent("Član", value: member.fullName)
                    TextField("Iznos (€)", text: $amount).keyboardType(.decimalPad)
                    Picker("Način", selection: $method) { ForEach(PaymentMethod.allCases) { Text($0.label).tag($0) } }.pickerStyle(.segmented)
                    TextField("Napomena", text: $note, axis: .vertical)
                }
                if let failure { Section { NoticeView(message: failure) }.listRowBackground(Color.clear).listRowInsets(EdgeInsets()) }
            }
            .font(.ui(16))
            .linenBackground()
            .navigationTitle("Zabilježi uplatu")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Odustani") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) { Button("Spremi") { Task { await save() } }.disabled(parseMoney(amount) == nil).glassButton(prominent: true) }
            }
        }
        .presentationDetents([.medium, .large])
        .onAppear {
            let owed = member.debtCents > 0 ? member.debtCents : (member.membership?.priceCents ?? 0)
            if owed > 0 { amount = String(format: "%d,%02d", owed / 100, owed % 100) }
        }
    }

    private func save() async {
        guard let cents = parseMoney(amount), cents > 0 else { return }
        do {
            try await model.api.recordPayment(NewPayment(memberId: member.id, amountCents: cents, method: method, note: note.trimmed.isEmpty ? nil : note))
            model.show("Uplata je zabilježena.")
            dismiss()
        } catch { failure = error.message }
    }
}

/** "65", "65,5", "65.50" or "1.180,00" → cents; nil if it isn't an amount. Same as the web. */
func parseMoney(_ text: String) -> Int? {
    let cleaned = text.filter { !$0.isWhitespace && $0 != "€" }
    guard !cleaned.isEmpty else { return nil }
    let normalised = cleaned.contains(",") ? cleaned.replacingOccurrences(of: ".", with: "").replacingOccurrences(of: ",", with: ".") : cleaned
    guard normalised.range(of: #"^\d+(\.\d{1,2})?$"#, options: .regularExpression) != nil, let value = Double(normalised) else { return nil }
    return Int((value * 100).rounded())
}
