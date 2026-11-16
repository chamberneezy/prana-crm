import Foundation
import Observation
import PranaKit
import SwiftUI

/** What the whole app shares: the API, who is signed in, which mode is shown and the toast. */
@MainActor @Observable
final class AppModel {
    enum Mode: Hashable { case student, staff }

    let config: PranaConfig
    let api: APIClient
    let time = StudioTime()
    let bookings = SavedBookings.standard()
    private let session: SessionStore

    var mode = Mode.student
    var me: Me?
    var showStaffLogin = false
    var toast: Toast?
    /** Bumped whenever the phone's own sign-ups change, so views re-read them. */
    var bookingsVersion = 0

    init() {
        let info = Bundle.main.infoDictionary ?? [:]
        let url = URL(string: info["PranaAPIURL"] as? String ?? "") ?? URL(string: "http://localhost:8787")!
        config = PranaConfig(apiBaseURL: url, studioID: info["PranaStudioID"] as? String ?? "", firebaseAPIKey: info["PranaFirebaseAPIKey"] as? String ?? "")
        let emulator = (info["PranaAuthEmulator"] as? String).flatMap { $0.isEmpty ? nil : $0 }
        let store = SessionStore(auth: StaffAuth(apiKey: config.firebaseAPIKey, emulatorHost: emulator))
        session = store
        api = APIClient(config: config, token: { try await store.idToken() })
    }

    var isSignedIn: Bool { me != nil }

    /** On launch: a staff member signed in earlier stays signed in, but the app still opens on the members' view. */
    func restore() async {
        guard await session.isSignedIn else { return }
        do {
            me = try await api.me()
        } catch let error as PranaError where error.code == "unauthenticated" || error.code == "no_access" {
            await session.signOut()
        } catch {
            // Offline: try again when they open the studio tool.
        }
    }

    /** The hidden gesture on the studio's name. */
    func openStaff() {
        if isSignedIn { mode = .staff } else { showStaffLogin = true }
    }

    func signIn(email: String, password: String) async throws {
        try await session.signIn(email: email, password: password)
        do {
            me = try await api.me()
        } catch {
            // Signed in to Firebase but not on the studio's staff list (or offline): nothing is kept.
            await session.signOut()
            throw error
        }
        mode = .staff
    }

    func signOut() async {
        await session.signOut()
        me = nil
        mode = .student
    }

    func show(_ message: String, systemImage: String = "checkmark.circle.fill") {
        toast = Toast(message: message, systemImage: systemImage)
    }

    func bookingsChanged() { bookingsVersion += 1 }
}

struct Toast: Identifiable, Equatable {
    let id = UUID()
    let message: String
    let systemImage: String
}

/** The staff member's tokens, refreshed when needed and kept in the Keychain. */
actor SessionStore {
    private var session: AuthSession?
    private let auth: StaffAuth

    init(auth: StaffAuth) {
        self.auth = auth
        session = Keychain.load()
    }

    var isSignedIn: Bool { session != nil }

    func signIn(email: String, password: String) async throws {
        let new = try await auth.signIn(email: email, password: password)
        session = new
        Keychain.save(new)
    }

    func idToken() async throws -> String? {
        guard var current = session else { return nil }
        if current.needsRefresh() {
            current = try await auth.refresh(current)
            session = current
            Keychain.save(current)
        }
        return current.idToken
    }

    func signOut() {
        session = nil
        Keychain.delete()
    }
}
