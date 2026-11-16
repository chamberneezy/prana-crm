import Foundation

/** What signed-in staff can do. The API checks the role on every call. */
public extension APIClient {
    func me() async throws -> Me { try await request("GET", "/me") }

    func dashboard() async throws -> Dashboard { try await request("GET", "/dashboard") }

    func sessions(from: String, to: String) async throws -> [SessionView] {
        let response: SessionsResponse = try await request("GET", "/sessions", query: ["from": from, "to": to])
        return response.sessions
    }

    func session(id: String) async throws -> SessionDetail { try await request("GET", "/sessions/\(id)") }

    /** Checks a member in; the visit counts toward their current membership. */
    @discardableResult
    func checkIn(sessionID: String, memberID: String) async throws -> MemberSummary {
        let response: VisitResponse = try await request("POST", "/sessions/\(sessionID)/visits", body: CheckInRequest(memberId: memberID))
        return response.summary
    }

    func removeVisit(id: String) async throws { try await raw("DELETE", "/visits/\(id)") }

    func removeBooking(id: String) async throws { try await raw("DELETE", "/bookings/\(id)") }

    func members(query: String = "", status: MemberStatus? = nil) async throws -> MembersResponse {
        var params: [String: String] = [:]
        if !query.trimmed.isEmpty { params["q"] = query.trimmed }
        if let status { params["status"] = status.rawValue }
        return try await request("GET", "/members", query: params)
    }

    func member(id: String) async throws -> MemberDetail { try await request("GET", "/members/\(id)") }
}

// MARK: Everything else on the web

private struct GroupsResponse: Codable, Sendable { let groups: [OfferingGroup] }
private struct OfferingsResponse: Codable, Sendable { let offerings: [Offering] }
private struct OfferingResponse: Codable, Sendable { let offering: Offering }
private struct SessionResponse: Codable, Sendable { let session: SessionView }
private struct StaffListResponse: Codable, Sendable { let staff: [Staff] }
private struct StaffResponse: Codable, Sendable { let staff: Staff }
private struct NameBody: Codable, Sendable { let name: String }
private struct OfferingIDs: Codable, Sendable { let offeringIds: [String] }
private struct ClosuresResponse: Codable, Sendable { let closures: [Closure] }
private struct ClosureBody: Codable, Sendable { let date: String; let name: String }
private struct TemplateResponse: Codable, Sendable { let slots: [WeekSlot] }
private struct TemplateBody: Codable, Sendable { let slots: [TemplateSlot] }
private struct PlanBody: Codable, Sendable { let sessions: [PlannedSession] }
private struct PlansResponse: Codable, Sendable { let plans: [Plan] }
private struct PlanResponse: Codable, Sendable { let plan: Plan }
private struct NewMembership: Codable, Sendable { let memberId: String; let planId: String }
private struct Renew: Codable, Sendable { let planId: String? }
private struct Freeze: Encodable, Sendable {
    let until: String?
    enum CodingKeys: String, CodingKey { case until }
    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(until, forKey: .until)
    }
}

public extension APIClient {
    // Class types
    func offeringGroups() async throws -> [OfferingGroup] { (try await request("GET", "/offering-groups") as GroupsResponse).groups }
    func addOfferingGroup(name: String) async throws { try await raw("POST", "/offering-groups", body: NameBody(name: name.trimmed)) }
    func offerings() async throws -> [Offering] { (try await request("GET", "/offerings") as OfferingsResponse).offerings }
    @discardableResult
    func saveOffering(id: String?, _ input: OfferingInput) async throws -> Offering {
        let response: OfferingResponse = try await request(id == nil ? "POST" : "PATCH", id.map { "/offerings/\($0)" } ?? "/offerings", body: input)
        return response.offering
    }

    // Sessions
    @discardableResult
    func saveSession(id: String?, _ input: SessionInput) async throws -> SessionView {
        let response: SessionResponse = try await request(id == nil ? "POST" : "PATCH", id.map { "/sessions/\($0)" } ?? "/sessions", body: input)
        return response.session
    }
    func deleteSession(id: String) async throws { try await raw("DELETE", "/sessions/\(id)") }

    // Teachers
    func staff() async throws -> [Staff] { (try await request("GET", "/staff") as StaffListResponse).staff }
    func addTeacher(name: String) async throws -> Staff { (try await request("POST", "/staff", body: NameBody(name: name.trimmed)) as StaffResponse).staff }
    func renameTeacher(id: String, name: String) async throws { try await raw("PATCH", "/staff/\(id)", body: NameBody(name: name.trimmed)) }
    func removeTeacher(id: String) async throws { try await raw("DELETE", "/staff/\(id)") }
    func setTeacherOfferings(id: String, offeringIDs: [String]) async throws { try await raw("PUT", "/staff/\(id)/offerings", body: OfferingIDs(offeringIds: offeringIDs)) }

    // Closed days and the week planner
    func closures(from: String, to: String) async throws -> [Closure] { (try await request("GET", "/closures", query: ["from": from, "to": to]) as ClosuresResponse).closures }
    func addClosure(date: String, name: String) async throws { try await raw("POST", "/closures", body: ClosureBody(date: date, name: name.trimmed)) }
    func removeClosure(id: String) async throws { try await raw("DELETE", "/closures/\(id)") }
    func weekTemplate() async throws -> [WeekSlot] { (try await request("GET", "/week-template") as TemplateResponse).slots }
    func saveWeekTemplate(_ slots: [TemplateSlot]) async throws { try await raw("PUT", "/week-template", body: TemplateBody(slots: slots)) }
    @discardableResult
    func saveWeekPlan(monday: String, _ sessions: [PlannedSession]) async throws -> [SessionView] {
        (try await request("PUT", "/week-plan/\(monday)", body: PlanBody(sessions: sessions)) as SessionsResponse).sessions
    }

    // Members
    @discardableResult
    func createMember(_ input: MemberInput) async throws -> MemberResponse {
        var body = input
        body.email = input.email.blankToNil
        body.phone = input.phone.blankToNil
        body.dob = input.dob.blankToNil
        body.healthText = input.healthFlag ? input.healthText.blankToNil : nil
        body.notes = input.notes.blankToNil
        return try await request("POST", "/members", body: body)
    }
    @discardableResult
    func updateMember(id: String, _ input: MemberInput) async throws -> MemberResponse { try await request("PATCH", "/members/\(id)", body: input.patch()) }
    func deleteMember(id: String) async throws { try await raw("DELETE", "/members/\(id)") }

    // Memberships
    func startMembership(memberID: String, planID: String) async throws { try await raw("POST", "/memberships", body: NewMembership(memberId: memberID, planId: planID)) }
    func renewMembership(id: String, planID: String? = nil) async throws { try await raw("POST", "/memberships/\(id)/renew", body: Renew(planId: planID)) }
    /** `until` is the last frozen day; nil lifts the freeze. */
    func freezeMembership(id: String, until: String?) async throws { try await raw("POST", "/memberships/\(id)/freeze", body: Freeze(until: until)) }

    // Plans (Članarine)
    func plans() async throws -> [Plan] { (try await request("GET", "/plans") as PlansResponse).plans }
    @discardableResult
    func savePlan(id: String?, _ input: PlanInput) async throws -> Plan {
        (try await request(id == nil ? "POST" : "PATCH", id.map { "/plans/\($0)" } ?? "/plans", body: input) as PlanResponse).plan
    }
    func deletePlan(id: String) async throws { try await raw("DELETE", "/plans/\(id)") }

    // Payments
    func payments(from: String, to: String) async throws -> PaymentsPage { try await request("GET", "/payments", query: ["from": from, "to": to]) }
    func recordPayment(_ payment: NewPayment) async throws { try await raw("POST", "/payments", body: payment) }

    // Analytics
    func analytics(months: Int) async throws -> Analytics { try await request("GET", "/analytics", query: ["months": String(months)]) }
}
