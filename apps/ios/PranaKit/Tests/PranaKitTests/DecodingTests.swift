import Foundation
import Testing
@testable import PranaKit

/** Real API answers (written by api/test/ios-fixtures.test.ts) decode into the app's models. */
func fixture(_ name: String) throws -> Data {
    let url = try #require(Bundle.module.url(forResource: name, withExtension: "json", subdirectory: "Fixtures"))
    return try Data(contentsOf: url)
}

func decode<T: Decodable>(_ type: T.Type, _ name: String) throws -> T {
    try JSON.decoder.decode(type, from: fixture(name))
}

@Suite struct Decoding {
    @Test func publicSchedule() throws {
        let schedule = try decode(PublicSchedule.self, "public-schedule")
        #expect(schedule.studio.name == "Prana Yoga Studio")
        #expect(!schedule.sessions.isEmpty)
        #expect(schedule.sessions.contains { $0.offeringName == "Ashtanga Mysore" && $0.colorToken == .ashtanga })
    }

    @Test func booking() throws {
        let receipt = try decode(BookingResponse.self, "public-booking").booking
        #expect(receipt.cancelToken.count >= 40)
    }

    @Test func apiError() throws {
        let error = try decode(APIErrorEnvelope.self, "error-member-not-found").error
        #expect(error.code == "member_not_found")
        #expect(error.messageHr.contains("članu"))
    }

    @Test func staffAnswers() throws {
        #expect(try decode(Me.self, "me").staff.role == .owner)
        let dashboard = try decode(Dashboard.self, "dashboard")
        #expect(dashboard.counts.activeMembers >= 0)
        #expect(try !decode(SessionsResponse.self, "sessions").sessions.isEmpty)
        let detail = try decode(SessionDetail.self, "session-detail")
        #expect(detail.reservations.contains { $0.fullName == "Ana Horvat" })
        let members = try decode(MembersResponse.self, "members")
        #expect(members.counts.all == members.members.count)
        #expect(members.members.contains { $0.status == .frozen })
        let ana = try decode(MemberDetail.self, "member-detail")
        #expect(ana.member.firstName == "Ana")
        #expect(ana.summary.membership?.visitsTotal == 8)
    }

    @Test func everythingElse() throws {
        struct Groups: Decodable { let groups: [OfferingGroup] }
        struct Offerings: Decodable { let offerings: [Offering] }
        struct StaffList: Decodable { let staff: [Staff] }
        struct Closures: Decodable { let closures: [Closure] }
        struct Template: Decodable { let slots: [WeekSlot] }
        struct Plans: Decodable { let plans: [Plan] }
        #expect(try decode(Groups.self, "offering-groups").groups.first?.name == "Joga")
        #expect(try decode(Offerings.self, "offerings").offerings.count == 5)
        #expect(try decode(StaffList.self, "staff").staff.contains { $0.name == "Ivan" })
        _ = try decode(Closures.self, "closures")
        #expect(try decode(Template.self, "week-template").slots.count == 10)
        #expect(try decode(Plans.self, "plans").plans.contains { $0.code == "unl" && $0.visitsPerMonth == nil })
        #expect(try decode(PaymentsPage.self, "payments").totalCents >= 0)
        let analytics = try decode(Analytics.self, "analytics")
        #expect(analytics.months.count == 3)
    }
}

@Suite struct Encoding {
    @Test func bodiesAreSnakeCaseAndKeepExplicitNulls() throws {
        let start = try #require(JSON.parseInstant("2026-11-16T08:00:00.000Z"))
        let input = SessionInput(offeringId: "o", startsAt: start, endsAt: start.addingTimeInterval(3600), teacherStaffId: nil, capacity: nil, note: nil)
        let text = String(decoding: try JSON.encoder.encode(input), as: UTF8.self)
        #expect(text.contains(#""offering_id":"o""#))
        #expect(text.contains(#""starts_at":"2026-11-16T08:00:00.000Z""#))
        #expect(text.contains(#""teacher_staff_id":null"#))

        let planned = PlannedSession(id: nil, date: "2026-11-16", startTime: "09:00", durationMin: 60, offeringId: "o", teacherStaffId: nil)
        let plannedText = String(decoding: try JSON.encoder.encode(planned), as: UTF8.self)
        #expect(!plannedText.contains(#""id""#))
        #expect(plannedText.contains(#""start_time":"09:00""#))

        let standardPlan = String(decoding: try JSON.encoder.encode(PlanInput(name: "1×", visitsPerMonth: 4, priceCents: 6500, includeVisits: false)), as: UTF8.self)
        #expect(!standardPlan.contains("visits_per_month"))
    }
}
