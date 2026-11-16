import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

/** A signed-in staff member's Firebase tokens. Kept in the Keychain by the app. */
public struct AuthSession: Codable, Sendable, Hashable {
    public let email: String
    public let idToken: String
    public let refreshToken: String
    public let expiresAt: Date

    public init(email: String, idToken: String, refreshToken: String, expiresAt: Date) {
        self.email = email
        self.idToken = idToken
        self.refreshToken = refreshToken
        self.expiresAt = expiresAt
    }

    /** Refresh a minute early, so a request never goes out with a token about to expire. */
    public func needsRefresh(now: Date = Date()) -> Bool { expiresAt.timeIntervalSince(now) < 60 }
}

public enum SignInError: Error, Sendable, Equatable {
    case wrongCredentials
    case tooManyAttempts
    case offline
    case unexpected

    public func message(english: Bool = false) -> String {
        switch self {
        case .wrongCredentials: english ? "Wrong e-mail or password." : "Pogrešan e-mail ili lozinka."
        case .tooManyAttempts: english ? "Too many attempts. Try again in a few minutes." : "Previše pokušaja. Pokušajte ponovno za nekoliko minuta."
        case .offline: english ? "No connection. Check your internet connection." : "Nema veze. Provjerite internetsku vezu."
        case .unexpected: english ? "Sign-in failed. Please try again." : "Prijava nije uspjela. Pokušajte ponovno."
        }
    }
}

/**
 * E-mail and password sign-in for staff through Firebase Auth's REST API, so the app needs no Firebase SDK.
 * Being signed in to Firebase grants nothing by itself: the Prana API lets in only addresses on the studio's
 * staff list (`GET /me` answers 403 `no_access` otherwise).
 */
public struct StaffAuth: Sendable {
    let apiKey: String
    let transport: HTTPTransport
    /** "localhost:9099" to use the local Auth emulator (development only); nil for Firebase itself. */
    let emulatorHost: String?

    public init(apiKey: String, emulatorHost: String? = nil, transport: HTTPTransport = URLSession.shared) {
        self.apiKey = apiKey
        self.emulatorHost = emulatorHost
        self.transport = transport
    }

    private func endpoint(_ host: String, _ path: String) -> URL {
        if let emulatorHost { return URL(string: "http://\(emulatorHost)/\(host)\(path)?key=\(apiKey)")! }
        return URL(string: "https://\(host)\(path)?key=\(apiKey)")!
    }

    public func signIn(email: String, password: String, now: Date = Date()) async throws -> AuthSession {
        struct Body: Encodable { let email: String; let password: String; let returnSecureToken = true }
        struct Reply: Decodable { let email: String; let idToken: String; let refreshToken: String; let expiresIn: String }
        let url = endpoint("identitytoolkit.googleapis.com", "/v1/accounts:signInWithPassword")
        let data = try await post(url, json: try JSONEncoder().encode(Body(email: email.trimmed.lowercased(), password: password)))
        guard let reply = try? JSONDecoder().decode(Reply.self, from: data) else { throw SignInError.unexpected }
        return AuthSession(email: reply.email, idToken: reply.idToken, refreshToken: reply.refreshToken, expiresAt: now.addingTimeInterval(TimeInterval(reply.expiresIn) ?? 3600))
    }

    public func refresh(_ session: AuthSession, now: Date = Date()) async throws -> AuthSession {
        struct Reply: Decodable {
            let idToken: String
            let refreshToken: String
            let expiresIn: String
            enum CodingKeys: String, CodingKey { case idToken = "id_token", refreshToken = "refresh_token", expiresIn = "expires_in" }
        }
        let url = endpoint("securetoken.googleapis.com", "/v1/token")
        var form = URLComponents()
        form.queryItems = [URLQueryItem(name: "grant_type", value: "refresh_token"), URLQueryItem(name: "refresh_token", value: session.refreshToken)]
        let data = try await post(url, form: Data((form.percentEncodedQuery ?? "").utf8))
        guard let reply = try? JSONDecoder().decode(Reply.self, from: data) else { throw SignInError.unexpected }
        return AuthSession(email: session.email, idToken: reply.idToken, refreshToken: reply.refreshToken, expiresAt: now.addingTimeInterval(TimeInterval(reply.expiresIn) ?? 3600))
    }

    private func post(_ url: URL, json: Data? = nil, form: Data? = nil) async throws -> Data {
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.timeoutInterval = 20
        request.setValue(json != nil ? "application/json" : "application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        request.httpBody = json ?? form
        let data: Data
        let response: HTTPURLResponse
        do {
            (data, response) = try await transport.send(request)
        } catch {
            throw SignInError.offline
        }
        guard response.statusCode == 200 else { throw Self.error(from: data) }
        return data
    }

    /** Firebase answers {"error": {"message": "INVALID_LOGIN_CREDENTIALS"}} and the like. */
    static func error(from data: Data) -> SignInError {
        struct Reply: Decodable { struct Inner: Decodable { let message: String }; let error: Inner }
        let message = (try? JSONDecoder().decode(Reply.self, from: data))?.error.message ?? ""
        if message.hasPrefix("TOO_MANY_ATTEMPTS") { return .tooManyAttempts }
        let wrong = ["INVALID_LOGIN_CREDENTIALS", "INVALID_PASSWORD", "EMAIL_NOT_FOUND", "INVALID_EMAIL", "USER_DISABLED", "MISSING_PASSWORD"]
        if wrong.contains(where: { message.hasPrefix($0) }) { return .wrongCredentials }
        return .unexpected
    }
}
