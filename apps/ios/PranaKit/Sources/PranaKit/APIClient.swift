import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

/** Where the app's API lives and which studio it shows. */
public struct PranaConfig: Sendable, Hashable {
    public let apiBaseURL: URL
    public let studioID: String
    /** The Firebase web API key (public by design); used only for staff sign-in. */
    public let firebaseAPIKey: String

    public init(apiBaseURL: URL, studioID: String, firebaseAPIKey: String) {
        self.apiBaseURL = apiBaseURL
        self.studioID = studioID
        self.firebaseAPIKey = firebaseAPIKey
    }
}

public enum PranaError: Error, Sendable, Equatable {
    /** The API said no, with a message for people. */
    case api(status: Int, body: APIErrorBody)
    /** No connection, or the server could not be reached. */
    case offline
    /** The answer was not what the app expects (e.g. a newer API). */
    case unexpected

    public var code: String? {
        if case let .api(_, body) = self { return body.code }
        return nil
    }

    /** Words for people, in Croatian or English. */
    public func message(english: Bool = false) -> String {
        switch self {
        case let .api(_, body): english ? body.messageEn : body.messageHr
        case .offline: english ? "No connection to the studio. Check your internet connection." : "Nema veze sa studijem. Provjerite internetsku vezu."
        case .unexpected: english ? "Something went wrong. Please try again." : "Nešto nije uspjelo. Pokušajte ponovno."
        }
    }
}

/** Something that sends HTTP requests; URLSession in the app, a stub in tests. */
public protocol HTTPTransport: Sendable {
    func send(_ request: URLRequest) async throws -> (Data, HTTPURLResponse)
}

extension URLSession: HTTPTransport {
    public func send(_ request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        let (data, response) = try await data(for: request)
        guard let http = response as? HTTPURLResponse else { throw PranaError.unexpected }
        return (data, http)
    }
}

public enum JSON {
    public static let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        decoder.dateDecodingStrategy = .custom { decoder in
            let text = try decoder.singleValueContainer().decode(String.self)
            guard let date = parseInstant(text) else {
                throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "not an ISO 8601 instant: \(text)"))
            }
            return date
        }
        return decoder
    }()

    public static let encoder: JSONEncoder = {
        let encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .convertToSnakeCase
        return encoder
    }()

    /** "2026-11-16T08:00:00.000Z", with or without the milliseconds. */
    public static func parseInstant(_ text: String) -> Date? {
        let withFraction = ISO8601DateFormatter()
        withFraction.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = withFraction.date(from: text) { return date }
        return ISO8601DateFormatter().date(from: text)
    }
}

/** Calls the Prana API: `/api/public/...` without signing in, everything else with a staff ID token. */
public final class APIClient: Sendable {
    public typealias TokenProvider = @Sendable () async throws -> String?

    public let config: PranaConfig
    private let transport: HTTPTransport
    private let token: TokenProvider

    public init(config: PranaConfig, transport: HTTPTransport = URLSession.shared, token: @escaping TokenProvider = { nil }) {
        self.config = config
        self.transport = transport
        self.token = token
    }

    func request<T: Decodable>(
        _ method: String,
        _ path: String,
        query: [String: String] = [:],
        body: (some Encodable & Sendable)? = Optional<Empty>.none,
        headers: [String: String] = [:],
        signedIn: Bool = true
    ) async throws -> T {
        let data = try await raw(method, path, query: query, body: body, headers: headers, signedIn: signedIn)
        do {
            return try JSON.decoder.decode(T.self, from: data)
        } catch {
            throw PranaError.unexpected
        }
    }

    @discardableResult
    func raw(
        _ method: String,
        _ path: String,
        query: [String: String] = [:],
        body: (some Encodable & Sendable)? = Optional<Empty>.none,
        headers: [String: String] = [:],
        rawBody: Data? = nil,
        contentType: String? = nil,
        signedIn: Bool = true
    ) async throws -> Data {
        var components = URLComponents(url: config.apiBaseURL.appendingPathComponent("api" + path), resolvingAgainstBaseURL: false)!
        if !query.isEmpty { components.queryItems = query.sorted { $0.key < $1.key }.map { URLQueryItem(name: $0.key, value: $0.value) } }
        var request = URLRequest(url: components.url!)
        request.httpMethod = method
        request.timeoutInterval = 20
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        for (name, value) in headers { request.setValue(value, forHTTPHeaderField: name) }
        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSON.encoder.encode(body)
        } else if let rawBody {
            request.setValue(contentType, forHTTPHeaderField: "Content-Type")
            request.httpBody = rawBody
        }
        if signedIn, let idToken = try await token() {
            request.setValue("Bearer \(idToken)", forHTTPHeaderField: "Authorization")
        }

        let data: Data
        let response: HTTPURLResponse
        do {
            (data, response) = try await transport.send(request)
        } catch let error as PranaError {
            throw error
        } catch {
            throw PranaError.offline
        }
        guard (200 ..< 300).contains(response.statusCode) else {
            if let envelope = try? JSON.decoder.decode(APIErrorEnvelope.self, from: data) {
                throw PranaError.api(status: response.statusCode, body: envelope.error)
            }
            throw PranaError.unexpected
        }
        return data
    }
}

/** A request without a body. */
public struct Empty: Codable, Sendable {}
