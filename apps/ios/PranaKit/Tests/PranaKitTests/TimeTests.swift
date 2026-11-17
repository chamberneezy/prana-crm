import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif
import Testing
@testable import PranaKit

@Suite struct Time {
    let time = StudioTime()

    @Test func weeksStartOnMonday() {
        #expect(time.weekday("2026-11-16") == 1)
        #expect(time.weekday("2026-11-22") == 7)
        #expect(time.monday(of: "2026-11-22") == "2026-11-16")
        #expect(time.week(of: "2026-11-18") == ["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20", "2026-11-21", "2026-11-22"])
    }

    @Test func daysCrossDaylightSavingAndYears() {
        // Summer time ends on 25.10.2026; the week still has seven days.
        #expect(time.addDays("2026-10-19", 7) == "2026-10-26")
        #expect(time.addDays("2026-12-28", 7) == "2027-01-04")
        #expect(time.monday(of: "2027-01-01") == "2026-12-28")
    }

    @Test func studioTimeNotThePhones() throws {
        // 17:00 in Zagreb in winter is 16:00 UTC.
        let start = try #require(JSON.parseInstant("2026-11-16T16:00:00.000Z"))
        #expect(time.time(start) == "17:00")
        #expect(time.day(of: start) == "2026-11-16")
        #expect(time.timeRange(start, start.addingTimeInterval(7200)) == "17:00–19:00")
        // 23:30 UTC is already the next day in Zagreb.
        #expect(time.day(of: try #require(JSON.parseInstant("2026-11-16T23:30:00Z"))) == "2026-11-17")
    }

    @Test func labels() {
        #expect(time.weekRange("2026-11-16") == "16.–22.11.")
        #expect(time.weekRange("2026-11-30") == "30.11.–6.12.")
        #expect(time.dayMonth("2026-11-06") == "06.11.")
    }

    @Test func entryNotes() throws {
        let start = try #require(JSON.parseInstant("2026-11-16T16:00:00.000Z"))
        #expect(entryNote("Ulaz do 60 min nakon početka", startsAt: start) == "ulaz do 18:00")
        #expect(entryNote("Slobodan ulaz", startsAt: start) == "slobodan ulaz")
        #expect(entryNote(nil, startsAt: start) == nil)
    }

    @Test func money() {
        #expect(formatMoney(cents: 6500) == "65,00 €")
        #expect(formatMoney(cents: 123456) == "1.234,56 €")
        #expect(formatMoney(cents: 5) == "0,05 €")
    }
}

@Suite struct Names {
    @Test func spacesAreTidied() {
        #expect("  Ana   Marija ".trimmed == "Ana Marija")
    }
}

@Suite struct SignIn {
    @Test func firebaseErrorsBecomePlainWords() {
        let body = { (message: String) in Data(#"{"error":{"code":400,"message":"\#(message)"}}"#.utf8) }
        #expect(StaffAuth.error(from: body("INVALID_LOGIN_CREDENTIALS")) == .wrongCredentials)
        #expect(StaffAuth.error(from: body("TOO_MANY_ATTEMPTS_TRY_LATER : Access disabled")) == .tooManyAttempts)
        #expect(StaffAuth.error(from: body("SOMETHING_NEW")) == .unexpected)
    }

    @Test func refreshesAMinuteEarly() {
        let now = Date()
        #expect(AuthSession(email: "a", idToken: "t", refreshToken: "r", expiresAt: now.addingTimeInterval(30)).needsRefresh(now: now))
        #expect(!AuthSession(email: "a", idToken: "t", refreshToken: "r", expiresAt: now.addingTimeInterval(600)).needsRefresh(now: now))
    }
}

@Suite struct Google {
    let google = GoogleOAuth(clientID: "123-abc.apps.googleusercontent.com")

    @Test func redirectsToTheReversedClientID() {
        #expect(google.callbackScheme == "com.googleusercontent.apps.123-abc")
        let url = google.authorizationURL(challenge: "ch", state: "st").absoluteString
        #expect(url.hasPrefix("https://accounts.google.com/o/oauth2/v2/auth?"))
        #expect(url.contains("redirect_uri=com.googleusercontent.apps.123-abc:/oauth2redirect"))
        #expect(url.contains("code_challenge_method=S256") && url.contains("scope=openid%20email%20profile"))
    }

    @Test func takesTheCodeOnlyFromItsOwnRedirect() {
        let back = URL(string: "com.googleusercontent.apps.123-abc:/oauth2redirect?state=st&code=4/xyz")!
        #expect(google.code(from: back, state: "st") == "4/xyz")
        #expect(google.code(from: back, state: "other") == nil)
    }

    @Test func exchangesTheCodeThenSignsInToFirebase() async throws {
        let tokenStub = Client.Stub(status: 200, body: Data(#"{"id_token":"google-id","access_token":"a"}"#.utf8))
        let idToken = try await GoogleOAuth(clientID: "123-abc.apps.googleusercontent.com", transport: tokenStub).exchange(code: "4/x+y", verifier: "v")
        #expect(idToken == "google-id")
        let form = String(decoding: tokenStub.last!.httpBody!, as: UTF8.self)
        #expect(form.contains("code=4/x%2By") && form.contains("code_verifier=v") && form.contains("grant_type=authorization_code"))

        let firebaseStub = Client.Stub(status: 200, body: Data(#"{"email":"mario@example.com","idToken":"fb","refreshToken":"r","expiresIn":"3600"}"#.utf8))
        let session = try await StaffAuth(apiKey: "k", transport: firebaseStub).signIn(googleIDToken: idToken)
        #expect(session.email == "mario@example.com" && session.idToken == "fb")
        #expect(firebaseStub.last!.url!.absoluteString.contains("accounts:signInWithIdp?key=k"))
        let body = String(decoding: firebaseStub.last!.httpBody!, as: UTF8.self)
        #expect(body.contains("id_token=google-id&providerId=google.com"))
    }
}

@Suite struct Saved {
    func session(_ id: String, endsIn: TimeInterval) -> PublicSession {
        PublicSession(id: id, offeringId: "o", offeringName: "Joga", colorToken: .spine, entryRule: nil, startsAt: Date().addingTimeInterval(endsIn - 3600), endsAt: Date().addingTimeInterval(endsIn), teacherName: nil, closureName: nil)
    }

    @Test func keepsUpcomingSignUpsAcrossLaunches() throws {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("bookings-\(UUID().uuidString).json")
        defer { try? FileManager.default.removeItem(at: url) }
        let store = SavedBookings(url: url)
        store.add(SavedBooking(receipt: BookingReceipt(id: "b1", sessionId: "s1", cancelToken: "t1"), session: session("s1", endsIn: 7200), personName: "Ana Horvat"))
        store.add(SavedBooking(receipt: BookingReceipt(id: "b2", sessionId: "s2", cancelToken: "t2"), session: session("s2", endsIn: -60), personName: "Ana Horvat"))
        // Signing up again for the same booking replaces it (with the new token).
        store.add(SavedBooking(receipt: BookingReceipt(id: "b1", sessionId: "s1", cancelToken: "t3"), session: session("s1", endsIn: 7200), personName: "Ana Horvat"))

        let reopened = SavedBookings(url: url)
        #expect(reopened.upcoming().map(\.id) == ["b1"])
        #expect(reopened.forSession("s1").first?.cancelToken == "t3")
        reopened.remove(id: "b1")
        #expect(SavedBookings(url: url).upcoming().isEmpty)
    }
}

@Suite struct Client {
    /** Answers with a fixed status and body, and remembers the request. */
    final class Stub: HTTPTransport, @unchecked Sendable {
        let status: Int
        let body: Data
        var last: URLRequest?
        init(status: Int, body: Data) { self.status = status; self.body = body }
        func send(_ request: URLRequest) async throws -> (Data, HTTPURLResponse) {
            last = request
            return (body, HTTPURLResponse(url: request.url!, statusCode: status, httpVersion: nil, headerFields: nil)!)
        }
    }

    let config = PranaConfig(apiBaseURL: URL(string: "https://prana.example")!, studioID: "studio-1", firebaseAPIKey: "k")

    @Test func signsUpWithoutAToken() async throws {
        let stub = Stub(status: 201, body: try fixture("public-booking"))
        let client = APIClient(config: config, transport: stub, token: { "should-not-be-sent" })
        _ = try await client.book(sessionID: "s1", firstName: " Ana ", lastName: "Horvat ")
        let request = try #require(stub.last)
        #expect(request.url?.absoluteString == "https://prana.example/api/public/studios/studio-1/bookings")
        #expect(request.value(forHTTPHeaderField: "Authorization") == nil)
        let body = String(decoding: try #require(request.httpBody), as: UTF8.self)
        #expect(body.contains(#""first_name":"Ana""#) && body.contains(#""last_name":"Horvat""#))
    }

    @Test func staffCallsCarryTheToken() async throws {
        let stub = Stub(status: 200, body: try fixture("me"))
        let client = APIClient(config: config, transport: stub, token: { "id-token" })
        _ = try await client.me()
        #expect(stub.last?.value(forHTTPHeaderField: "Authorization") == "Bearer id-token")
    }

    @Test func uploadsTheFormAsMultipart() async throws {
        let stub = Stub(status: 201, body: Data(#"{"document":{"id":"d1","member_id":null,"mime":"application/pdf","filename":"upisnica.pdf"}}"#.utf8))
        let client = APIClient(config: config, transport: stub, token: { "id-token" })
        let document = try await client.uploadDocument(data: Data("%PDF".utf8), filename: "upisnica.pdf", mime: "application/pdf", source: .pdf)
        #expect(document.id == "d1")
        let request = try #require(stub.last)
        #expect(request.value(forHTTPHeaderField: "Content-Type")?.hasPrefix("multipart/form-data; boundary=prana-") == true)
        let body = String(decoding: try #require(request.httpBody), as: UTF8.self)
        #expect(body.contains(#"name="file"; filename="upisnica.pdf""#) && body.contains("%PDF") && body.contains("\r\npdf\r\n"))
    }

    @Test func apiErrorsKeepTheirMessage() async throws {
        let stub = Stub(status: 404, body: try fixture("error-member-not-found"))
        let client = APIClient(config: config, transport: stub)
        await #expect(throws: PranaError.self) { try await client.book(sessionID: "s", firstName: "A", lastName: "B") }
        do {
            _ = try await client.book(sessionID: "s", firstName: "A", lastName: "B")
        } catch let error as PranaError {
            #expect(error.code == "member_not_found")
            #expect(error.message().contains("članu"))
        }
    }
}
