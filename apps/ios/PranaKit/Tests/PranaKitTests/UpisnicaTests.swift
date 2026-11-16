import Foundation
import Testing
@testable import PranaKit

/** The shared fixtures in fixtures/upisnica: the web parser passes the same files. */
@Suite struct Upisnica {
    struct Fixture: Decodable {
        struct Expected: Decodable {
            let name, email, phone, dob: String
            let student: Bool
            let plan: String
            let health: Bool
            let healthText: String
            let consent, news: Bool
            let place, date: String
            let signaturePresent: Bool
            let needsReview: [String]
        }
        let description: String
        let lines: [ScanLine]
        let expected: Expected
    }

    static let folder = URL(fileURLWithPath: #filePath).deletingLastPathComponent()
        .appendingPathComponent("../../../../../fixtures/upisnica").standardizedFileURL
    static let files = ((try? FileManager.default.contentsOfDirectory(atPath: folder.path)) ?? []).filter { $0.hasSuffix(".json") }.sorted()

    @Test func hasCases() { #expect(Self.files.count >= 5) }

    @Test(arguments: files) func parses(file: String) throws {
        let fixture = try JSONDecoder().decode(Fixture.self, from: Data(contentsOf: Self.folder.appendingPathComponent(file)))
        let scan = parseUpisnica(fixture.lines)
        let e = fixture.expected
        #expect(scan.name == e.name, "name")
        #expect(scan.email == e.email, "email")
        #expect(scan.phone == e.phone, "phone")
        #expect(scan.dob == e.dob, "dob")
        #expect(scan.student == e.student, "student")
        #expect(scan.plan.rawValue == e.plan, "plan")
        #expect(scan.health == e.health, "health")
        #expect(scan.healthText == e.healthText, "healthText")
        #expect(scan.consent == e.consent, "consent")
        #expect(scan.news == e.news, "news")
        #expect(scan.place == e.place, "place")
        #expect(scan.date == e.date, "date")
        #expect(scan.signaturePresent == e.signaturePresent)
        #expect(scan.needsReview.map(\.rawValue) == e.needsReview, "needsReview")
        for (_, region) in scan.regions { #expect(region.width > 0 && region.height > 0) }
    }

    @Test func normalizers() {
        for raw in ["0912345678", "091 234 5678", "091/234-5678", "+385 91 234 5678", "00385912345678", "+385 (0)91 234 5678"] {
            #expect(normalizePhone(raw) == Normalized(value: "091 234 5678", valid: true), "\(raw)")
        }
        #expect(normalizePhone("098 76? 4321") == Normalized(value: "098 76? 4321", valid: false))
        #expect(normalizeDate("2.9.2026") == Normalized(value: "02.09.2026.", valid: true))
        #expect(!normalizeDate("31.02.2026.").valid)
        #expect(titleCaseName("ŽELJKA ĐURĐEVIĆ-ČAČIĆ") == "Željka Đurđević-Čačić")
        #expect(normalizeEmail(" Ana.Horvat@Example.COM ") == Normalized(value: "ana.horvat@example.com", valid: true))
        #expect(String(foldCharacters("Čačić Đurđa ×")) == "cacic durda x")
    }
}
