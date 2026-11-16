import Foundation

/** A sign-up made on this phone: what is needed to show it and to cancel it. */
public struct SavedBooking: Codable, Sendable, Identifiable, Hashable {
    public let id: String
    public let sessionID: String
    public let cancelToken: String
    public let offeringName: String
    public let colorToken: ColorToken
    public let startsAt: Date
    public let endsAt: Date
    /** Who it is for: several people may share a phone (a parent signing up a child). */
    public let personName: String

    public init(receipt: BookingReceipt, session: PublicSession, personName: String) {
        id = receipt.id
        sessionID = session.id
        cancelToken = receipt.cancelToken
        offeringName = session.offeringName
        colorToken = session.colorToken
        startsAt = session.startsAt
        endsAt = session.endsAt
        self.personName = personName
    }
}

/**
 * The phone's own list of sign-ups. There is no account, so this list is the only record the app has; the cancel
 * tokens in it are the only way to cancel. Finished classes are dropped. Saved as a JSON file.
 */
public final class SavedBookings: @unchecked Sendable {
    private let url: URL
    private let lock = NSLock()
    private var items: [SavedBooking]

    public init(url: URL) {
        self.url = url
        items = (try? Self.decoder.decode([SavedBooking].self, from: Data(contentsOf: url))) ?? []
    }

    /** In the app's Application Support folder. */
    public static func standard() -> SavedBookings {
        let folder = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        return SavedBookings(url: folder.appendingPathComponent("bookings.json"))
    }

    /** Upcoming sign-ups, soonest first. */
    public func upcoming(now: Date = Date()) -> [SavedBooking] {
        lock.withLock { items.filter { $0.endsAt > now }.sorted { $0.startsAt < $1.startsAt } }
    }

    public func forSession(_ id: String, now: Date = Date()) -> [SavedBooking] {
        upcoming(now: now).filter { $0.sessionID == id }
    }

    /** Adds a sign-up, replacing an earlier one for the same booking (signing up twice gives a new token). */
    public func add(_ booking: SavedBooking, now: Date = Date()) {
        lock.withLock {
            items.removeAll { $0.id == booking.id || $0.endsAt <= now }
            items.append(booking)
            save()
        }
    }

    public func remove(id: String) {
        lock.withLock {
            items.removeAll { $0.id == id }
            save()
        }
    }

    // The file is the app's own: plain keys, ISO 8601 dates.
    private static let encoder: JSONEncoder = {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        return encoder
    }()

    private static let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }()

    private func save() {
        guard let data = try? Self.encoder.encode(items) else { return }
        try? data.write(to: url, options: .atomic)
    }
}
