import Charts
import PranaKit
import SwiftUI

/** Uplate: payments by month with the total. */
struct PaymentsScreen: View {
    @Environment(AppModel.self) private var model
    @State private var month = ""
    @State private var state: Loadable<PaymentsPage> = .loading
    @State private var picking = false
    @State private var paying: MemberSummary?
    @State private var picked: MemberSummary?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    PageTitle(title: "Uplate", overline: monthLabel)
                    HStack {
                        Button { shift(-1) } label: { Image(systemName: "chevron.left").frame(width: 44, height: 44) }.accessibilityLabel("Prethodni mjesec")
                        Spacer()
                        if let page = state.value {
                            VStack(spacing: 2) {
                                Text("Ukupno").font(.ui(12)).foregroundStyle(DS.muted)
                                Text(formatMoney(cents: page.totalCents)).font(.ui(22, .semibold)).monospacedDigit()
                            }
                        }
                        Spacer()
                        Button { shift(1) } label: { Image(systemName: "chevron.right").frame(width: 44, height: 44) }.accessibilityLabel("Sljedeći mjesec")
                    }
                    .foregroundStyle(DS.ink)
                    .card(padding: 8)
                    LoadingView(state: state, retry: load) { page in
                        if page.payments.isEmpty {
                            EmptyStateView(title: "U ovom mjesecu nema uplata", systemImage: "eurosign.circle")
                        } else {
                            VStack(spacing: 0) {
                                ForEach(page.payments) { p in
                                    HStack {
                                        VStack(alignment: .leading, spacing: 2) {
                                            Text(p.memberName ?? "—").font(.ui(15, .semibold))
                                            Text([model.time.display(model.time.day(of: p.paidAt)), p.planName, PaymentMethod(rawValue: p.method)?.label].compactMap { $0 }.joined(separator: " · "))
                                                .font(.ui(12)).foregroundStyle(DS.muted)
                                        }
                                        Spacer()
                                        Text(formatMoney(cents: p.amountCents)).font(.ui(15, .semibold)).monospacedDigit()
                                    }
                                    .padding(14)
                                    if p.id != page.payments.last?.id { Divider().overlay(DS.lineSoft) }
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
            .refreshable { await load() }
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Zabilježi uplatu", systemImage: "plus") { picking = true } } }
            .sheet(isPresented: $picking, onDismiss: {
                // The payment form opens once the picker has gone.
                paying = picked
                picked = nil
            }) {
                MemberPicker(title: "Uplata za člana") { member in picked = member }
            }
            .sheet(item: $paying, onDismiss: { Task { await load() } }) { member in PaymentFormSheet(member: member) }
        }
        .task {
            if month.isEmpty { month = String(model.time.today().prefix(7)) }
        }
        .task(id: month) { if !month.isEmpty { await load() } }
    }

    private var monthLabel: String {
        let names = ["", "Siječanj", "Veljača", "Ožujak", "Travanj", "Svibanj", "Lipanj", "Srpanj", "Kolovoz", "Rujan", "Listopad", "Studeni", "Prosinac"]
        let p = month.split(separator: "-").compactMap { Int($0) }
        return p.count == 2 ? "\(names[p[1]]) \(p[0])." : ""
    }

    private func shift(_ by: Int) {
        let p = month.split(separator: "-").compactMap { Int($0) }
        guard p.count == 2 else { return }
        var (y, m) = (p[0], p[1] + by)
        if m < 1 { (y, m) = (y - 1, 12) }
        if m > 12 { (y, m) = (y + 1, 1) }
        month = String(format: "%04d-%02d", y, m)
    }

    private func load() async {
        let first = "\(month)-01"
        let last = model.time.addDays("\(shiftedMonth(month, 1))-01", -1)
        do { state = .loaded(try await model.api.payments(from: first, to: last)) } catch { state = .failed(error.message) }
    }

    private func shiftedMonth(_ month: String, _ by: Int) -> String {
        let p = month.split(separator: "-").compactMap { Int($0) }
        var (y, m) = (p[0], p[1] + by)
        if m > 12 { (y, m) = (y + 1, 1) }
        return String(format: "%04d-%02d", y, m)
    }
}

/** Članarine: the standard plans with their prices, and the studio's own. */
struct PlansScreen: View {
    @Environment(AppModel.self) private var model
    @State private var plans: [Plan] = []
    @State private var editing: Plan?
    @State private var creating = false
    @State private var failure: String?

    var body: some View {
        List {
            if let failure { NoticeView(message: failure).listRowBackground(Color.clear) }
            Section("Standardne") { ForEach(plans.filter { !$0.isCustom }) { row($0) } }
            Section("Vlastite") {
                let own = plans.filter(\.isCustom)
                if own.isEmpty { Text("Studio još nema vlastitih članarina.").foregroundStyle(DS.muted) }
                ForEach(own) { p in
                    row(p).swipeActions { Button("Ukloni", role: .destructive) { Task { await remove(p) } } }
                }
            }
        }
        .font(.ui(15))
        .linenBackground()
        .navigationTitle("Članarine")
        .toolbar(.hidden, for: .tabBar)
        .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Nova članarina", systemImage: "plus") { creating = true } } }
        .task { await load() }
        .sheet(item: $editing, onDismiss: { Task { await load() } }) { PlanForm(plan: $0) }
        .sheet(isPresented: $creating, onDismiss: { Task { await load() } }) { PlanForm(plan: nil) }
    }

    private func row(_ p: Plan) -> some View {
        Button { editing = p } label: {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(p.name).font(.ui(15, .semibold))
                    Text(p.visitsPerMonth.map { plural($0, "dolazak", "dolaska", "dolazaka") + " mjesečno" } ?? "Neograničeno").font(.ui(12)).foregroundStyle(DS.muted)
                }
                Spacer()
                Text(p.priceCents.map { formatMoney(cents: $0) } ?? "Cijena nije postavljena").font(.ui(14, p.priceCents == nil ? .regular : .semibold)).foregroundStyle(p.priceCents == nil ? DS.muted : DS.ink)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private func load() async {
        do { plans = try await model.api.plans(); failure = nil } catch { failure = error.message }
    }

    private func remove(_ p: Plan) async {
        do {
            try await model.api.deletePlan(id: p.id)
            await load()
        } catch { failure = error.message }
    }
}

struct PlanForm: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let plan: Plan?
    @State private var name = ""
    @State private var visits = ""
    @State private var price = ""
    @State private var failure: String?
    private var custom: Bool { plan?.isCustom ?? true }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Naziv", text: $name)
                    if custom { TextField("Dolazaka mjesečno (prazno = neograničeno)", text: $visits).keyboardType(.numberPad) }
                    TextField("Cijena (€)", text: $price).keyboardType(.decimalPad)
                }
                if let failure { Section { NoticeView(message: failure) }.listRowBackground(Color.clear).listRowInsets(EdgeInsets()) }
            }
            .font(.ui(16))
            .linenBackground()
            .navigationTitle(plan == nil ? "Nova članarina" : plan!.name)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Odustani") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) { Button("Spremi") { Task { await save() } }.disabled(name.trimmed.isEmpty).glassButton(prominent: true) }
            }
        }
        .presentationDetents([.medium, .large])
        .onAppear {
            name = plan?.name ?? ""
            visits = plan?.visitsPerMonth.map(String.init) ?? ""
            price = plan?.priceCents.map { String(format: "%d,%02d", $0 / 100, $0 % 100) } ?? ""
        }
    }

    private func save() async {
        let cents = price.trimmed.isEmpty ? nil : parseMoney(price)
        if !price.trimmed.isEmpty, cents == nil { failure = "Upišite iznos, npr. 65 ili 65,50."; return }
        let input = PlanInput(name: name.trimmed, visitsPerMonth: Int(visits), priceCents: cents, includeVisits: custom)
        do {
            let saved = try await model.api.savePlan(id: plan?.id, input)
            model.show("\(saved.name) je spremljena.")
            dismiss()
        } catch { failure = error.message }
    }
}

/** Analitika: attendance and income over the last 3, 6 or 12 months, with Swift Charts. */
struct AnalyticsScreen: View {
    @Environment(AppModel.self) private var model
    @State private var months = 6
    @State private var state: Loadable<Analytics> = .loading

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Picker("Razdoblje", selection: $months) {
                    Text("3 mjeseca").tag(3)
                    Text("6 mjeseci").tag(6)
                    Text("12 mjeseci").tag(12)
                }
                .pickerStyle(.segmented)
                LoadingView(state: state, retry: load) { a in content(a) }
            }
            .padding(.horizontal, DS.gutter)
            .padding(.bottom, 32)
        }
        .linenBackground()
        .navigationTitle("Analitika")
        .toolbar(.hidden, for: .tabBar)
        .task(id: months) { await load() }
    }

    @ViewBuilder
    private func content(_ a: Analytics) -> some View {
        LazyVGrid(columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)], spacing: 12) {
            Stat(label: "Dolasci", value: "\(a.totals.visits)")
            Stat(label: "Prihod", value: formatMoney(cents: a.totals.incomeCents))
            Stat(label: "Prosjek po satu", value: String(format: "%.1f", a.totals.averageClassSize).replacingOccurrences(of: ".", with: ","))
            Stat(label: "Članovi koji su došli", value: "\(a.totals.membersWhoCame)")
        }
        chartCard("Dolasci po mjesecima") {
            Chart(a.months) { m in
                BarMark(x: .value("Mjesec", String(m.month.suffix(2))), y: .value("Dolasci", m.visits)).foregroundStyle(DS.sageDeep).cornerRadius(3)
            }
        }
        chartCard("Prihod po mjesecima") {
            Chart(a.months) { m in
                BarMark(x: .value("Mjesec", String(m.month.suffix(2))), y: .value("€", Double(m.incomeCents) / 100)).foregroundStyle(DS.sage).cornerRadius(3)
            }
        }
        chartCard("Dolasci po vrsti sata") {
            Chart(a.byOffering) { o in
                BarMark(x: .value("Dolasci", o.visits), y: .value("Sat", o.name)).foregroundStyle(o.colorToken.color).cornerRadius(3)
                    .annotation(position: .trailing) { Text("\(o.visits)").font(.ui(11)).foregroundStyle(DS.muted) }
            }
            .frame(height: CGFloat(max(a.byOffering.count, 1)) * 36)
        }
        chartCard("Kad ljudi dolaze") {
            Chart(a.bySlot, id: \.self) { s in
                RectangleMark(x: .value("Dan", Weekday.short[s.weekday]), y: .value("Sat", "\(s.hour):00"))
                    .foregroundStyle(by: .value("Dolasci", s.visits))
            }
            .chartForegroundStyleScale(range: Gradient(colors: [DS.mist, DS.sageDeep]))
        }
        VStack(alignment: .leading, spacing: 8) {
            Text("Najaktivniji").font(.ui(15, .semibold))
            ForEach(a.mostActive) { m in LabeledContent(m.fullName, value: plural(m.visits, "dolazak", "dolaska", "dolazaka")) }
            Divider().overlay(DS.lineSoft)
            Text("Najmanje aktivni (zadnjih 30 dana)").font(.ui(15, .semibold))
            ForEach(a.leastActive) { m in LabeledContent(m.fullName, value: plural(m.visits, "dolazak", "dolaska", "dolazaka")) }
        }
        .font(.ui(14))
        .card()
        VStack(alignment: .leading, spacing: 8) {
            Text("Prihod po načinu plaćanja").font(.ui(15, .semibold))
            ForEach(a.byMethod, id: \.method) { m in LabeledContent(m.method.label, value: formatMoney(cents: m.cents)) }
            Divider().overlay(DS.lineSoft)
            Text("Prihod po članarini").font(.ui(15, .semibold))
            ForEach(a.byPlan, id: \.self) { p in LabeledContent(p.planName ?? "Bez članarine", value: formatMoney(cents: p.cents)) }
        }
        .font(.ui(14))
        .card()
    }

    private func chartCard<C: View>(_ title: String, @ViewBuilder chart: () -> C) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title).font(.ui(15, .semibold))
            chart().frame(minHeight: 180)
        }
        .card()
    }

    private func load() async {
        do { state = .loaded(try await model.api.analytics(months: months)) } catch { state = .failed(error.message) }
    }
}
