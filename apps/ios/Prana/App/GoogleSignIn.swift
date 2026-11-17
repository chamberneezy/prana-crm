import AuthenticationServices
import CryptoKit
import PranaKit
import UIKit

/**
 * Opens Google's sign-in in the system's secure browser sheet and returns Google's redirect. The account picker is
 * Google's own page; the app never sees the password.
 */
@MainActor
final class GoogleSignIn: NSObject, @preconcurrency ASWebAuthenticationPresentationContextProviding {
    private var running: ASWebAuthenticationSession?

    /** A Google ID token for the chosen account, or nil when the person closed the sheet. */
    func idToken(_ google: GoogleOAuth) async throws -> String? {
        let verifier = Self.random()
        let challenge = Data(SHA256.hash(data: Data(verifier.utf8))).base64URL
        let state = Self.random()
        let callback: URL
        do {
            callback = try await present(google.authorizationURL(challenge: challenge, state: state), scheme: google.callbackScheme)
        } catch let error as ASWebAuthenticationSessionError where error.code == .canceledLogin {
            return nil
        }
        guard let code = google.code(from: callback, state: state) else { return nil }
        return try await google.exchange(code: code, verifier: verifier)
    }

    private func present(_ url: URL, scheme: String) async throws -> URL {
        defer { running = nil }
        return try await withCheckedThrowingContinuation { continuation in
            let session = ASWebAuthenticationSession(url: url, callbackURLScheme: scheme) { callback, error in
                if let callback { continuation.resume(returning: callback) } else { continuation.resume(throwing: error ?? SignInError.unexpected) }
            }
            session.presentationContextProvider = self
            running = session
            if !session.start() { continuation.resume(throwing: SignInError.unexpected) }
        }
    }

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        let windows = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.flatMap(\.windows)
        return windows.first(where: \.isKeyWindow) ?? windows.first ?? ASPresentationAnchor()
    }

    private static func random() -> String {
        var bytes = [UInt8](repeating: 0, count: 32)
        _ = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        return Data(bytes).base64URL
    }
}

private extension Data {
    var base64URL: String {
        base64EncodedString().replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
    }
}
