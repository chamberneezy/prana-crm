import Foundation

/** One member read from a CSV or Excel file, as the API's preview gives it. */
public struct ImportRow: Codable, Sendable, Hashable, Identifiable {
    public let line: Int
    public let firstName: String
    public let lastName: String
    public let email: String?
    public let phone: String?
    public let dob: String?
    public let isStudentOrRetired: Bool
    public let memberSince: String?
    public let notes: String?
    /** Cells that were there but couldn't be read: "email", "dob", "member_since". */
    public let problems: [String]
    /** Already a member, or listed earlier in the file: not added again. */
    public let duplicate: Bool

    public var id: Int { line }
    public var fullName: String { [firstName, lastName].filter { !$0.isEmpty }.joined(separator: " ") }
}

public struct ImportColumn: Codable, Sendable, Hashable {
    public let header: String
    public let field: String
}

public struct ImportPreview: Codable, Sendable {
    public let columns: [ImportColumn]
    public let rows: [ImportRow]
}

public struct ImportResult: Codable, Sendable {
    public let created: Int
    public let skipped: Int
}

private struct ImportMember: Encodable, Sendable {
    let firstName: String
    let lastName: String
    let email: String?
    let phone: String?
    let dob: String?
    let isStudentOrRetired: Bool
    let memberSince: String?
    let notes: String?
}

private struct ImportBody: Encodable, Sendable {
    let consentAccuracy: Bool
    let members: [ImportMember]
}

public extension APIClient {
    /** Sends a CSV or .xlsx file to be read; nothing is saved yet. */
    func readMemberSpreadsheet(data: Data, filename: String) async throws -> ImportPreview {
        let boundary = "prana-\(UUID().uuidString)"
        var body = Data()
        func line(_ text: String) { body.append(Data((text + "\r\n").utf8)) }
        line("--\(boundary)")
        line(#"Content-Disposition: form-data; name="file"; filename="\#(filename.replacingOccurrences(of: "\"", with: ""))""#)
        line("Content-Type: application/octet-stream")
        line("")
        body.append(data)
        line("")
        line("--\(boundary)--")
        let raw = try await raw("POST", "/members/import/read", rawBody: body, contentType: "multipart/form-data; boundary=\(boundary)")
        guard let preview = try? JSON.decoder.decode(ImportPreview.self, from: raw) else { throw PranaError.unexpected }
        return preview
    }

    /** Adds the rows that aren't duplicates; the API skips anyone already there in any case. */
    func importMembers(_ rows: [ImportRow]) async throws -> ImportResult {
        let members = rows.filter { !$0.duplicate }.map {
            ImportMember(firstName: $0.firstName, lastName: $0.lastName, email: $0.email, phone: $0.phone, dob: $0.dob, isStudentOrRetired: $0.isStudentOrRetired, memberSince: $0.memberSince, notes: $0.notes)
        }
        return try await request("POST", "/members/import", body: ImportBody(consentAccuracy: true, members: members))
    }
}
