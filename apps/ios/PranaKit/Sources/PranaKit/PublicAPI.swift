import Foundation

/** What anyone with the app can do: see the classes and sign up for one by name (members only). */
public extension APIClient {
    private var studioPath: String { "/public/studios/\(config.studioID)" }

    /** The classes from `from` to `to` ("YYYY-MM-DD", inclusive; at most 31 days). */
    func publicSchedule(from: String, to: String) async throws -> PublicSchedule {
        try await request("GET", "\(studioPath)/schedule", query: ["from": from, "to": to], signedIn: false)
    }

    /** Signs a member up. Throws `.api` with code `member_not_found` when the name matches no member. */
    func book(sessionID: String, firstName: String, lastName: String) async throws -> BookingReceipt {
        let body = BookingRequest(sessionId: sessionID, firstName: firstName.trimmed, lastName: lastName.trimmed)
        let response: BookingResponse = try await request("POST", "\(studioPath)/bookings", body: body, signedIn: false)
        return response.booking
    }

    func cancelBooking(id: String, cancelToken: String) async throws {
        try await raw("DELETE", "\(studioPath)/bookings/\(id)", headers: ["X-Cancel-Token": cancelToken], signedIn: false)
    }
}

extension String {
    /** Trimmed, with runs of spaces made one: how names are sent. */
    public var trimmed: String {
        split(whereSeparator: \.isWhitespace).joined(separator: " ")
    }
}
