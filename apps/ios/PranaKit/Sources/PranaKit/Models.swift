import Foundation

// Mirrors the API's JSON (packages/shared/src/schemas.ts, docs/openapi.json). Keys are snake_case on the wire;
// the decoder converts them. Instants decode to Date; calendar dates stay "YYYY-MM-DD" strings.

public enum ColorToken: String, Codable, Sendable, CaseIterable {
    case spine = "class-spine"
    case restorative = "class-restorative"
    case ashtanga = "class-ashtanga"
    case blackLotus = "class-black-lotus"
    case pranayama = "class-pranayama"
    case workshop = "class-workshop"
}

public enum StaffRole: String, Codable, Sendable {
    case owner, teacher
    case frontDesk = "front_desk"
}

public enum MemberStatus: String, Codable, Sendable, CaseIterable {
    case active, expiring, unpaid, frozen, trial, none
}

// MARK: Public (the studio app, no sign-in)

public struct PublicSession: Codable, Sendable, Identifiable, Hashable {
    public let id: String
    public let offeringId: String
    public let offeringName: String
    public let colorToken: ColorToken
    public let entryRule: String?
    public let startsAt: Date
    public let endsAt: Date
    public let teacherName: String?
    /** Set when the studio is closed that day (a holiday): the class is cancelled. */
    public let closureName: String?

    public init(id: String, offeringId: String, offeringName: String, colorToken: ColorToken, entryRule: String?, startsAt: Date, endsAt: Date, teacherName: String?, closureName: String?) {
        self.id = id
        self.offeringId = offeringId
        self.offeringName = offeringName
        self.colorToken = colorToken
        self.entryRule = entryRule
        self.startsAt = startsAt
        self.endsAt = endsAt
        self.teacherName = teacherName
        self.closureName = closureName
    }
}

public struct Studio: Codable, Sendable, Hashable {
    public let name: String
    public let timezone: String
}

public struct PublicSchedule: Codable, Sendable {
    public let studio: Studio
    public let from: String
    public let to: String
    public let sessions: [PublicSession]
}

public struct BookingReceipt: Codable, Sendable, Hashable {
    public let id: String
    public let sessionId: String
    /** The only way to cancel this sign-up; it is kept on the device. */
    public let cancelToken: String
}

struct BookingResponse: Codable, Sendable { let booking: BookingReceipt }

struct BookingRequest: Codable, Sendable {
    let sessionId: String
    let firstName: String
    let lastName: String
}

// MARK: Staff

public struct Staff: Codable, Sendable, Identifiable, Hashable {
    public let id: String
    public let email: String
    public let name: String
    public let role: StaffRole
}

public struct Business: Codable, Sendable, Hashable {
    public let id: String
    public let name: String
    public let locale: String
    public let timezone: String
}

public struct Me: Codable, Sendable {
    public let staff: Staff
    public let business: Business
}

public struct SessionView: Codable, Sendable, Identifiable, Hashable {
    public let id: String
    public let offeringId: String
    public let offeringName: String
    public let colorToken: ColorToken
    public let entryRule: String?
    public let startsAt: Date
    public let endsAt: Date
    public let teacherStaffId: String?
    public let teacherName: String?
    public let capacity: Int?
    public let note: String?
    /** Check-ins so far. */
    public let booked: Int
    public let effectiveCapacity: Int?
    public let closureName: String?
    /** Najave: members who signed up from the studio app. */
    public let reserved: Int
}

public struct SessionsResponse: Codable, Sendable { public let sessions: [SessionView] }

public struct Attendee: Codable, Sendable, Identifiable, Hashable {
    public var id: String { visitId }
    public let visitId: String
    public let memberId: String
    public let fullName: String
    public let healthFlag: Bool
    public let healthText: String?
    public let checkedInAt: Date
}

public struct Reservation: Codable, Sendable, Identifiable, Hashable {
    public var id: String { bookingId }
    public let bookingId: String
    public let memberId: String
    public let fullName: String
    public let createdAt: Date
    public let checkedIn: Bool
}

public struct SessionDetail: Codable, Sendable {
    public let session: SessionView
    public let attendees: [Attendee]
    public let reservations: [Reservation]
}

public struct MembershipView: Codable, Sendable, Hashable {
    public let id: String
    public let planCode: String
    public let planName: String
    public let periodStart: String
    public let periodEnd: String
    public let frozenUntil: String?
    public let visitsTotal: Int?
    public let visitsUsed: Int
    public let priceCents: Int?
    public let paidCents: Int
    public let renewedUntil: String?
}

public struct MemberSummary: Codable, Sendable, Identifiable, Hashable {
    public let id: String
    public let fullName: String
    public let email: String?
    public let phone: String?
    public let healthFlag: Bool
    public let healthText: String?
    public let status: MemberStatus
    public let daysLeft: Int?
    public let debtCents: Int
    public let membership: MembershipView?
    public let lastVisitAt: Date?
}

public struct StatusCounts: Codable, Sendable, Hashable {
    public let all: Int
    public let active: Int
    public let expiring: Int
    public let unpaid: Int
    public let frozen: Int
    public let trial: Int
    public let none: Int

    public func count(_ status: MemberStatus?) -> Int {
        switch status {
        case nil: all
        case .active: active
        case .expiring: expiring
        case .unpaid: unpaid
        case .frozen: frozen
        case .trial: trial
        case .some(.none): none
        }
    }
}

public struct MembersResponse: Codable, Sendable {
    public let members: [MemberSummary]
    public let counts: StatusCounts
}

public struct Member: Codable, Sendable, Identifiable, Hashable {
    public let id: String
    public let firstName: String
    public let lastName: String
    public let fullName: String
    public let email: String?
    public let phone: String?
    public let dob: String?
    public let isStudentOrRetired: Bool
    public let healthFlag: Bool
    public let healthText: String?
    public let memberSince: String
    public let notes: String?
}

public struct MemberVisit: Codable, Sendable, Identifiable, Hashable {
    public let id: String
    public let sessionId: String
    public let checkedInAt: Date
    public let startsAt: Date
    public let offeringName: String
    public let colorToken: ColorToken
}

public struct PaymentView: Codable, Sendable, Identifiable, Hashable {
    public let id: String
    public let amountCents: Int
    public let method: String
    public let paidAt: Date
    public let note: String?
    public let memberName: String?
    public let planName: String?
}

public struct MemberDetail: Codable, Sendable {
    public let member: Member
    public let summary: MemberSummary
    public let visits: [MemberVisit]
    public let payments: [PaymentView]
    public let documents: [StoredDocument]
}

public struct DashboardCounts: Codable, Sendable, Hashable {
    public let activeMembers: Int
    public let expiringThisWeek: Int
    public let unpaidMembers: Int
    public let debtsTotalCents: Int
    public let paymentsThisMonthCents: Int
}

public struct Dashboard: Codable, Sendable {
    public let date: String
    public let today: [SessionView]
    public let tomorrow: [SessionView]
    public let attention: [MemberSummary]
    public let counts: DashboardCounts
}

public struct VisitResponse: Codable, Sendable { public let summary: MemberSummary }

struct CheckInRequest: Codable, Sendable { let memberId: String }

// MARK: Errors

/** The API's error body: a code and a message in Croatian and English, ready to show as they are. */
public struct APIErrorBody: Codable, Sendable, Hashable {
    public let code: String
    public let messageHr: String
    public let messageEn: String
    public let fields: [String]?
}

struct APIErrorEnvelope: Codable, Sendable { let error: APIErrorBody }
