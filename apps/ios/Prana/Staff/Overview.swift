import PranaKit
import SwiftUI

/** Pregled: the counts, today's and tomorrow's classes, and who needs attention. */
struct OverviewScreen: View {
    @Environment(AppModel.self) private var model
    let enroll: () -> Void
    @State private var state: Loadable<Dashboard> = .loading

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    PageTitle(title: "Pregled", overline: model.time.longDay(model.time.today()))
                    LoadingView(state: state, retry: load) { dashboard in
                        LazyVGrid(columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)], spacing: 12) {
                            Stat(label: "Aktivni članovi", value: "\(dashboard.counts.activeMembers)")
                            Stat(label: "Ističu ovaj tjedan", value: "\(dashboard.counts.expiringThisWeek)")
                            Stat(label: "Dugovanja", value: formatMoney(cents: dashboard.counts.debtsTotalCents), attention: dashboard.counts.debtsTotalCents > 0)
                            Stat(label: "Uplate ovaj mjesec", value: formatMoney(cents: dashboard.counts.paymentsThisMonthCents))
                        }
                        SessionList(title: "Danas", sessions: dashboard.today)
                        SessionList(title: "Sutra", sessions: dashboard.tomorrow)
                        VStack(alignment: .leading, spacing: 10) {
                            Text("Za provjeru").font(.ui(17, .semibold))
                            if dashboard.attention.isEmpty {
                                EmptyStateView(title: "Sve je u redu", message: "Nema neplaćenih ni članarina koje uskoro ističu.", systemImage: "checkmark.seal")
                            } else {
                                VStack(spacing: 0) {
                                    ForEach(dashboard.attention) { member in
                                        NavigationLink { MemberProfileScreen(memberID: member.id) } label: { MemberRow(member: member) }
                                        if member.id != dashboard.attention.last?.id { Divider().overlay(DS.lineSoft) }
                                    }
                                }
                                .card(padding: 0)
                            }
                        }
                    }
                }
                .padding(.horizontal, DS.gutter)
                .padding(.bottom, 32)
            }
            .linenBackground()
            .refreshable { await load() }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Novi član", systemImage: "person.badge.plus", action: enroll)
                }
            }
        }
        .task { await load() }
    }

    private func load() async {
        do { state = .loaded(try await model.api.dashboard()) } catch { if state.value == nil { state = .failed(error.message) } }
    }
}

struct Stat: View {
    let label: String
    let value: String
    var attention = false
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label).font(.ui(12, .medium, relativeTo: .caption)).foregroundStyle(DS.muted)
            Text(value).font(.ui(22, .semibold, relativeTo: .title2)).monospacedDigit().foregroundStyle(attention ? DS.clayText : DS.ink)
                .minimumScaleFactor(0.7).lineLimit(1)
        }
        .card(padding: 14)
        .overlay(alignment: .leading) { if attention { Rectangle().fill(DS.terracotta).frame(width: 3).padding(.vertical, 10) } }
        .accessibilityElement(children: .combine)
    }
}

struct SessionList: View {
    let title: String
    let sessions: [SessionView]
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title).font(.ui(17, .semibold))
            if sessions.isEmpty {
                Text("Nema satova").font(.ui(14)).foregroundStyle(DS.muted)
            }
            ForEach(sessions) { session in
                NavigationLink { SessionDetailScreen(sessionID: session.id) } label: { StaffSessionCard(session: session) }
                    .buttonStyle(.plain)
            }
        }
    }
}

/** A class on the schedule: time, entry rule, check-ins and najave. */
struct StaffSessionCard: View {
    @Environment(AppModel.self) private var model
    let session: SessionView

    var body: some View {
        let time = model.time
        let detail = [time.timeRange(session.startsAt, session.endsAt), entryNote(session.entryRule, startsAt: session.startsAt, time: time)].compactMap { $0 }.joined(separator: " · ")
        HStack(alignment: .top, spacing: 12) {
            ClassPill(color: session.colorToken, width: 10)
            VStack(alignment: .leading, spacing: 4) {
                Text(session.offeringName).font(.ui(16, .semibold)).foregroundStyle(session.closureName == nil ? DS.ink : DS.muted)
                    .strikethrough(session.closureName != nil)
                Text(detail).font(.ui(14)).foregroundStyle(DS.inkMuted).monospacedDigit()
                if let closure = session.closureName {
                    Text("Otkazano · \(closure)").font(.ui(13, .medium)).foregroundStyle(DS.clayText)
                } else {
                    HStack(spacing: 6) {
                        Text(session.effectiveCapacity.map { "\(session.booked)/\($0) dolazaka" } ?? plural(session.booked, "dolazak", "dolaska", "dolazaka"))
                        if session.reserved > 0 { TagView(plural(session.reserved, "najava", "najave", "najava"), kind: .plan) }
                        if let teacher = session.teacherName { Text("· \(teacher)") }
                    }
                    .font(.ui(13)).foregroundStyle(DS.muted)
                }
            }
            Spacer(minLength: 0)
            Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(DS.field)
        }
        .card(padding: 14)
        .contentShape(Rectangle())
    }
}

struct MemberRow: View {
    let member: MemberSummary
    var body: some View {
        HStack(spacing: 12) {
            Avatar(name: member.fullName)
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(member.fullName).font(.ui(15, .semibold)).foregroundStyle(DS.ink)
                    if member.healthFlag { Image(systemName: "cross.case").font(.system(size: 12)).foregroundStyle(DS.terracotta).accessibilityLabel("Zdravstvena napomena") }
                }
                Text(subline).font(.ui(13)).foregroundStyle(DS.muted).lineLimit(1)
            }
            Spacer(minLength: 8)
            StatusChip(status: member.status, daysLeft: member.daysLeft)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .contentShape(Rectangle())
    }

    private var subline: String {
        guard let m = member.membership else { return "Bez članarine" }
        if member.status == .unpaid, member.debtCents > 0 { return "\(m.planName) · duguje \(formatMoney(cents: member.debtCents))" }
        let visits = m.visitsTotal.map { "\(m.visitsUsed)/\($0) dolazaka" } ?? plural(m.visitsUsed, "dolazak", "dolaska", "dolazaka")
        return "\(m.planName) · \(visits)"
    }
}
