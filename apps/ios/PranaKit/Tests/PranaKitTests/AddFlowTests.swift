import Foundation
import Testing
@testable import PranaKit

/**
 * Every "add" the staff app offers, against a running local API with test sign-in, starting from an empty studio
 * (class types and plans only, like the live one). Skipped unless PRANA_LOCAL_API is set, e.g.
 * `PRANA_LOCAL_API=http://127.0.0.1:8799 PRANA_OWNER_EMAIL=owner@example.test swift test --filter AddFlow`.
 */
@Suite struct AddFlow {
    static let base = ProcessInfo.processInfo.environment["PRANA_LOCAL_API"]
    static let email = ProcessInfo.processInfo.environment["PRANA_OWNER_EMAIL"] ?? "owner@example.test"

    /** An unsigned Firebase-shaped token, which the API accepts only in local emulator mode. */
    static func token() -> String {
        func part(_ json: String) -> String {
            Data(json.utf8).base64EncodedString().replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
        }
        let exp = Int(Date().timeIntervalSince1970) + 3600
        let claims = #"{"aud":"prana-crm","iss":"https://securetoken.google.com/prana-crm","sub":"ios-add-check","email":"\#(email)","email_verified":true,"exp":\#(exp),"iat":\#(exp - 3600)}"#
        return part(#"{"alg":"none","typ":"JWT"}"#) + "." + part(claims) + "."
    }

    @Test(.enabled(if: base != nil)) func everyAddWorks() async throws {
        let config = PranaConfig(apiBaseURL: URL(string: Self.base!)!, studioID: "", firebaseAPIKey: "")
        let token = Self.token()
        let api = APIClient(config: config, token: { token })
        let time = StudioTime()

        let me = try await api.me()
        #expect(me.staff.email == Self.email)

        // Vrste satova: a group, a teacher, a class type taught by them.
        try await api.addOfferingGroup(name: "Provjera")
        let group = try #require(try await api.offeringGroups().first { $0.name == "Provjera" })
        let teacher = try await api.addTeacher(name: "Učiteljica Provjera")
        let offering = try await api.saveOffering(id: nil, OfferingInput(groupId: group.id, name: "Provjera sat", colorToken: .spine, defaultDurationMin: 60, entryRule: nil, defaultCapacity: 12, active: true, teacherIds: [teacher.id]))
        try await api.setTeacherOfferings(id: teacher.id, offeringIDs: [offering.id])

        // Tjedni plan: the standard week, then this week from it.
        try await api.saveWeekTemplate([TemplateSlot(weekday: 1, startTime: "18:00", durationMin: 60, offeringId: offering.id, teacherStaffId: teacher.id)])
        #expect(try await api.weekTemplate().count == 1)
        let today = time.today()
        let monday = time.monday(of: today)
        let planned = try await api.saveWeekPlan(monday: monday, [PlannedSession(id: nil, date: time.addDays(monday, 6), startTime: "23:00", durationMin: 30, offeringId: offering.id, teacherStaffId: teacher.id)])
        #expect(planned.count == 1)

        // Raspored: a single new session, and a closed day.
        let start = Date().addingTimeInterval(86_400 * 9)
        let session = try await api.saveSession(id: nil, SessionInput(offeringId: offering.id, startsAt: start, endsAt: start.addingTimeInterval(3600), teacherStaffId: teacher.id, capacity: 10, note: "provjera"))
        try await api.addClosure(date: time.addDays(today, 30), name: "Provjera praznik")

        // Članarine: a plan of the studio's own.
        let plan = try await api.savePlan(id: nil, PlanInput(name: "Provjera paket", visitsPerMonth: 4, priceCents: 3000, includeVisits: true))

        // Novi član (typed in), with a membership paid on the spot, then a payment and a check-in.
        var input = MemberInput(firstName: "Ana", lastName: "Provjera", email: "ana@example.test", consentAccuracy: true, signedDate: today)
        input.planId = plan.id
        input.paidWith = .cash
        let created = try await api.createMember(input)
        let second = try await api.createMember(MemberInput(firstName: "Ivo", lastName: "Provjera", consentAccuracy: true, signedDate: today))
        try await api.startMembership(memberID: second.member.id, planID: plan.id)
        try await api.recordPayment(NewPayment(memberId: second.member.id, amountCents: 3000, method: .card, note: nil))
        try await api.checkIn(sessionID: session.id, memberID: created.member.id)

        let members = try await api.members()
        #expect(members.members.count == 2)
        let detail = try await api.member(id: second.member.id)
        #expect(!detail.payments.isEmpty)
        #expect(try await api.session(id: session.id).attendees.count == 1)

        // Uvezi popis članova: a CSV read, previewed and added; Ana is already there.
        let csv = "Ime;Prezime;E-mail;Datum rođenja;Student\nAna;Provjera;;;\nLea;Tablica;lea@example.test;3.4.1990.;da\n"
        let preview = try await api.readMemberSpreadsheet(data: Data(csv.utf8), filename: "clanovi.csv")
        #expect(preview.rows.map(\.duplicate) == [true, false])
        #expect(preview.rows[1].dob == "1990-04-03" && preview.rows[1].isStudentOrRetired)
        let result = try await api.importMembers(preview.rows)
        #expect(result.created == 1)
        #expect(try await api.members().members.count == 3)
    }
}
