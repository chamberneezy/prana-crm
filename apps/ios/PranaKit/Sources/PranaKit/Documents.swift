import Foundation

public enum DocumentSource: String, Codable, Sendable { case camera, pdf, image }

public struct StoredDocument: Codable, Sendable, Identifiable, Hashable {
    public let id: String
    public let memberId: String?
    public let mime: String
    public let filename: String?
}

private struct DocumentResponse: Codable, Sendable { let document: StoredDocument }

/** What is kept with the member: the recognised fields and lines, as on the web (ocr_json, version 1). */
public struct RecognitionRecord: Encodable, Sendable {
    public let source: String
    public let lines: [ScanLine]
    public let scan: UpisnicaScan

    public init(source: String, lines: [ScanLine], scan: UpisnicaScan) {
        self.source = source
        self.lines = lines
        self.scan = scan
    }

    enum CodingKeys: String, CodingKey { case version, source, result, lines }
    enum ResultKeys: String, CodingKey { case name, email, phone, dob, student, plan, health, healthText, consent, news, place, date, signaturePresent, needsReview, confidence }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(1, forKey: .version)
        try c.encode(source, forKey: .source)
        try c.encode(lines, forKey: .lines)
        var r = c.nestedContainer(keyedBy: ResultKeys.self, forKey: .result)
        try r.encode(scan.name, forKey: .name)
        try r.encode(scan.email, forKey: .email)
        try r.encode(scan.phone, forKey: .phone)
        try r.encode(scan.dob, forKey: .dob)
        try r.encode(scan.student, forKey: .student)
        try r.encode(scan.plan.rawValue, forKey: .plan)
        try r.encode(scan.health, forKey: .health)
        try r.encode(scan.healthText, forKey: .healthText)
        try r.encode(scan.consent, forKey: .consent)
        try r.encode(scan.news, forKey: .news)
        try r.encode(scan.place, forKey: .place)
        try r.encode(scan.date, forKey: .date)
        try r.encode(scan.signaturePresent, forKey: .signaturePresent)
        try r.encode(scan.needsReview.map(\.rawValue), forKey: .needsReview)
        try r.encode(Dictionary(uniqueKeysWithValues: scan.confidence.map { ($0.key.rawValue, $0.value) }), forKey: .confidence)
    }
}

private struct LinkBody: Encodable, Sendable {
    let memberId: String
    let ocrJson: RecognitionRecord?
}

public extension APIClient {
    /** Uploads the upisnica file (multipart), not yet linked to anyone. */
    func uploadDocument(data: Data, filename: String, mime: String, source: DocumentSource) async throws -> StoredDocument {
        let boundary = "prana-\(UUID().uuidString)"
        var body = Data()
        func line(_ text: String) { body.append(Data((text + "\r\n").utf8)) }
        line("--\(boundary)")
        line(#"Content-Disposition: form-data; name="source""#)
        line("")
        line(source.rawValue)
        line("--\(boundary)")
        line(#"Content-Disposition: form-data; name="file"; filename="\#(filename.replacingOccurrences(of: "\"", with: ""))""#)
        line("Content-Type: \(mime)")
        line("")
        body.append(data)
        line("")
        line("--\(boundary)--")
        let raw = try await raw("POST", "/documents", rawBody: body, contentType: "multipart/form-data; boundary=\(boundary)")
        guard let response = try? JSON.decoder.decode(DocumentResponse.self, from: raw) else { throw PranaError.unexpected }
        return response.document
    }

    /** Keeps the document with the member, with what was recognised on it. */
    func linkDocument(id: String, memberID: String, recognition: RecognitionRecord?) async throws {
        try await raw("PATCH", "/documents/\(id)", body: LinkBody(memberId: memberID, ocrJson: recognition))
    }

    /** The stored file, e.g. for Quick Look. */
    func documentFile(id: String) async throws -> Data { try await raw("GET", "/documents/\(id)/file") }
}
