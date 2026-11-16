import Foundation

// The rest of the staff API's shapes: class types, teachers, holidays, the week plan, memberships, payments,
// plans and analytics. Inputs encode to snake_case; a nil optional is left out (the API keeps its value).

public struct OfferingGroup: Codable, Sendable, Identifiable, Hashable {
    public let id: String
    public let name: String
    public let sort: Int
}

public struct Offering: Codable, Sendable, Identifiable, Hashable {
    public let id: String
    public let groupId: String
    public let name: String
    public let colorToken: ColorToken
    public let defaultDurationMin: Int
    public let entryRule: String?
    public let defaultCapacity: Int?
    public let active: Bool
    /** Who teaches it, in order; the first is the default teacher of a new session. */
    public let teacherIds: [String]
    /** Only from the list endpoint. */
    public let sessionsThisWeek: Int?
}

public struct OfferingInput: Codable, Sendable, Hashable {
    public var groupId: String
    public var name: String
    public var colorToken: ColorToken
    public var defaultDurationMin: Int
    public var entryRule: String?
    public var defaultCapacity: Int?
    public var active: Bool
    public var teacherIds: [String]

    public init(groupId: String, name: String, colorToken: ColorToken, defaultDurationMin: Int, entryRule: String?, defaultCapacity: Int?, active: Bool, teacherIds: [String]) {
        self.groupId = groupId
        self.name = name
        self.colorToken = colorToken
        self.defaultDurationMin = defaultDurationMin
        self.entryRule = entryRule
        self.defaultCapacity = defaultCapacity
        self.active = active
        self.teacherIds = teacherIds
    }

    // entry_rule and default_capacity are sent as null when cleared.
    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(groupId, forKey: .groupId)
        try c.encode(name, forKey: .name)
        try c.encode(colorToken, forKey: .colorToken)
        try c.encode(defaultDurationMin, forKey: .defaultDurationMin)
        try c.encode(entryRule, forKey: .entryRule)
        try c.encode(defaultCapacity, forKey: .defaultCapacity)
        try c.encode(active, forKey: .active)
        try c.encode(teacherIds, forKey: .teacherIds)
    }
}

public struct SessionInput: Codable, Sendable, Hashable {
    public var offeringId: String
    public var startsAt: Date
    public var endsAt: Date
    public var teacherStaffId: String?
    public var capacity: Int?
    public var note: String?

    public init(offeringId: String, startsAt: Date, endsAt: Date, teacherStaffId: String?, capacity: Int?, note: String?) {
        self.offeringId = offeringId
        self.startsAt = startsAt
        self.endsAt = endsAt
        self.teacherStaffId = teacherStaffId
        self.capacity = capacity
        self.note = note
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(offeringId, forKey: .offeringId)
        try c.encode(JSON.instant(startsAt), forKey: .startsAt)
        try c.encode(JSON.instant(endsAt), forKey: .endsAt)
        try c.encode(teacherStaffId, forKey: .teacherStaffId)
        try c.encode(capacity, forKey: .capacity)
        try c.encode(note, forKey: .note)
    }
}

public struct Closure: Codable, Sendable, Identifiable, Hashable {
    public let id: String
    public let date: String
    public let name: String
}

public struct WeekSlot: Codable, Sendable, Identifiable, Hashable {
    public let id: String
    public let weekday: Int
    public let startTime: String
    public let durationMin: Int
    public let offeringId: String
    public let teacherStaffId: String?
}

/** One class of a week's plan. With `id`, an existing session of the week is changed; without, one is added. */
public struct PlannedSession: Codable, Sendable, Hashable {
    public var id: String?
    public var date: String
    public var startTime: String
    public var durationMin: Int
    public var offeringId: String
    public var teacherStaffId: String?

    public init(id: String?, date: String, startTime: String, durationMin: Int, offeringId: String, teacherStaffId: String?) {
        self.id = id
        self.date = date
        self.startTime = startTime
        self.durationMin = durationMin
        self.offeringId = offeringId
        self.teacherStaffId = teacherStaffId
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encodeIfPresent(id, forKey: .id)
        try c.encode(date, forKey: .date)
        try c.encode(startTime, forKey: .startTime)
        try c.encode(durationMin, forKey: .durationMin)
        try c.encode(offeringId, forKey: .offeringId)
        try c.encode(teacherStaffId, forKey: .teacherStaffId)
    }
}

public struct TemplateSlot: Codable, Sendable, Hashable {
    public var weekday: Int
    public var startTime: String
    public var durationMin: Int
    public var offeringId: String
    public var teacherStaffId: String?

    public init(weekday: Int, startTime: String, durationMin: Int, offeringId: String, teacherStaffId: String?) {
        self.weekday = weekday
        self.startTime = startTime
        self.durationMin = durationMin
        self.offeringId = offeringId
        self.teacherStaffId = teacherStaffId
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(weekday, forKey: .weekday)
        try c.encode(startTime, forKey: .startTime)
        try c.encode(durationMin, forKey: .durationMin)
        try c.encode(offeringId, forKey: .offeringId)
        try c.encode(teacherStaffId, forKey: .teacherStaffId)
    }
}

public enum PaymentMethod: String, Codable, Sendable, CaseIterable, Identifiable {
    case cash, card, transfer
    public var id: String { rawValue }
}

public struct Plan: Codable, Sendable, Identifiable, Hashable {
    public let id: String
    public let code: String
    public let name: String
    public let visitsPerMonth: Int?
    public let priceCents: Int?
    public var isCustom: Bool { code == "custom" }
}

public struct PlanInput: Codable, Sendable, Hashable {
    public var name: String
    public var visitsPerMonth: Int?
    public var priceCents: Int?
    /** The standard plans keep their visits; only a custom plan's are sent. */
    public var includeVisits: Bool

    public init(name: String, visitsPerMonth: Int?, priceCents: Int?, includeVisits: Bool) {
        self.name = name
        self.visitsPerMonth = visitsPerMonth
        self.priceCents = priceCents
        self.includeVisits = includeVisits
    }

    enum CodingKeys: String, CodingKey { case name, visitsPerMonth, priceCents }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        name = try c.decode(String.self, forKey: .name)
        visitsPerMonth = try c.decodeIfPresent(Int.self, forKey: .visitsPerMonth)
        priceCents = try c.decodeIfPresent(Int.self, forKey: .priceCents)
        includeVisits = true
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(name, forKey: .name)
        if includeVisits { try c.encode(visitsPerMonth, forKey: .visitsPerMonth) }
        try c.encode(priceCents, forKey: .priceCents)
    }
}

public struct PaymentsPage: Codable, Sendable {
    public let from: String
    public let to: String
    public let payments: [PaymentView]
    public let totalCents: Int
}

public struct NewPayment: Codable, Sendable, Hashable {
    public var memberId: String
    public var amountCents: Int
    public var method: PaymentMethod
    public var note: String?

    public init(memberId: String, amountCents: Int, method: PaymentMethod, note: String?) {
        self.memberId = memberId
        self.amountCents = amountCents
        self.method = method
        self.note = note
    }
}

/** A new member: what the upisnica holds. Saved only with the accuracy consent. */
public struct MemberInput: Codable, Sendable, Hashable {
    public var firstName: String
    public var lastName: String
    public var email: String?
    public var phone: String?
    public var dob: String?
    public var isStudentOrRetired: Bool
    public var healthFlag: Bool
    public var healthText: String?
    public var consentAccuracy: Bool
    public var consentNews: Bool
    public var signedPlace: String?
    public var signedDate: String?
    public var notes: String?
    /** Only when creating: a membership on this plan, and how it was paid (nil = not yet). */
    public var planId: String?
    public var paidWith: PaymentMethod?

    public init(firstName: String = "", lastName: String = "", email: String? = nil, phone: String? = nil, dob: String? = nil, isStudentOrRetired: Bool = false, healthFlag: Bool = false, healthText: String? = nil, consentAccuracy: Bool = false, consentNews: Bool = false, signedPlace: String? = "Varaždin", signedDate: String? = nil, notes: String? = nil, planId: String? = nil, paidWith: PaymentMethod? = nil) {
        self.firstName = firstName
        self.lastName = lastName
        self.email = email
        self.phone = phone
        self.dob = dob
        self.isStudentOrRetired = isStudentOrRetired
        self.healthFlag = healthFlag
        self.healthText = healthText
        self.consentAccuracy = consentAccuracy
        self.consentNews = consentNews
        self.signedPlace = signedPlace
        self.signedDate = signedDate
        self.notes = notes
        self.planId = planId
        self.paidWith = paidWith
    }

    public init(member: Member) {
        self.init(firstName: member.firstName, lastName: member.lastName, email: member.email, phone: member.phone, dob: member.dob, isStudentOrRetired: member.isStudentOrRetired, healthFlag: member.healthFlag, healthText: member.healthText, consentAccuracy: true, signedPlace: nil, notes: member.notes)
    }

    /** For a change to an existing member: no plan or payment, empty fields cleared. */
    func patch() -> MemberPatch { MemberPatch(input: self) }
}

struct MemberPatch: Encodable, Sendable {
    let input: MemberInput
    enum CodingKeys: String, CodingKey { case firstName, lastName, email, phone, dob, isStudentOrRetired, healthFlag, healthText, notes }
    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(input.firstName.trimmed, forKey: .firstName)
        try c.encode(input.lastName.trimmed, forKey: .lastName)
        try c.encode(input.email.blankToNil, forKey: .email)
        try c.encode(input.phone.blankToNil, forKey: .phone)
        try c.encode(input.dob.blankToNil, forKey: .dob)
        try c.encode(input.isStudentOrRetired, forKey: .isStudentOrRetired)
        try c.encode(input.healthFlag, forKey: .healthFlag)
        try c.encode(input.healthFlag ? input.healthText.blankToNil : nil, forKey: .healthText)
        try c.encode(input.notes.blankToNil, forKey: .notes)
    }
}

public struct MemberResponse: Codable, Sendable {
    public let member: Member
    public let summary: MemberSummary
}

public struct MembershipResponse: Codable, Sendable { public let summary: MemberSummary }

public struct Analytics: Codable, Sendable {
    public struct Totals: Codable, Sendable, Hashable {
        public let visits: Int
        public let incomeCents: Int
        public let sessions: Int
        public let averageClassSize: Double
        public let membersWhoCame: Int
    }
    public struct Month: Codable, Sendable, Hashable, Identifiable {
        public var id: String { month }
        public let month: String
        public let visits: Int
        public let incomeCents: Int
        public let membersWhoCame: Int
    }
    public struct ByOffering: Codable, Sendable, Hashable, Identifiable {
        public var id: String { offeringId }
        public let offeringId: String
        public let name: String
        public let colorToken: ColorToken
        public let visits: Int
        public let sessions: Int
    }
    public struct Slot: Codable, Sendable, Hashable {
        public let weekday: Int
        public let hour: Int
        public let visits: Int
    }
    public struct MemberCount: Codable, Sendable, Hashable, Identifiable {
        public let id: String
        public let fullName: String
        public let visits: Int
        public let lastVisitAt: Date?
    }
    public struct ByMethod: Codable, Sendable, Hashable {
        public let method: PaymentMethod
        public let cents: Int
    }
    public struct ByPlan: Codable, Sendable, Hashable {
        public let planCode: String?
        public let planName: String?
        public let cents: Int
    }

    public let from: String
    public let to: String
    public let totals: Totals
    public let months: [Month]
    public let byOffering: [ByOffering]
    public let bySlot: [Slot]
    public let mostActive: [MemberCount]
    public let leastActive: [MemberCount]
    public let byMethod: [ByMethod]
    public let byPlan: [ByPlan]
}

extension Optional where Wrapped == String {
    /** nil for a missing or blank string, else the trimmed string. */
    var blankToNil: String? {
        guard let value = self?.trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty else { return nil }
        return value
    }
}

extension JSON {
    /** The API's instant format: "2026-11-16T08:00:00.000Z". */
    public static func instant(_ date: Date) -> String {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f.string(from: date)
    }
}
