import Foundation

/**
 * Reads an upisnica from lines of recognised text. A port of packages/shared/src/upisnica/parser.ts (see its notes
 * and docs/handoff-web.md A6); both must pass fixtures/upisnica/.
 *
 * 1. Find the label anchors, ignoring case and diacritics and allowing small misreadings.
 * 2. Read each value: on the label's own line, to its right, or on the row below.
 * 3. For choices, find the option with a tick mark. Without one the field is flagged, never guessed.
 * 4. Normalise, then flag whatever is missing, unclear or invalid.
 */

public struct ScanLine: Codable, Sendable, Hashable {
    public var text: String
    public var x: Double
    public var y: Double
    public var width: Double
    public var height: Double
    /** 0–1; a PDF text layer is 1. nil means 1. */
    public var confidence: Double?

    public init(text: String, x: Double, y: Double, width: Double, height: Double, confidence: Double? = nil) {
        self.text = text
        self.x = x
        self.y = y
        self.width = width
        self.height = height
        self.confidence = confidence
    }
}

public struct ScanRegion: Codable, Sendable, Hashable {
    public let x: Double
    public let y: Double
    public let width: Double
    public let height: Double
}

public enum ScanField: String, Codable, Sendable, CaseIterable {
    case name, email, phone, dob, student, plan, health, healthText, consent, news, place, date
}

public enum UpisnicaPlan: String, Codable, Sendable { case once = "1x", twice = "2x", thrice = "3x", unlimited = "unl" }

/** What the parser read from one upisnica. Never saved as is: the owner always reviews it first. */
public struct UpisnicaScan: Sendable, Hashable {
    public var name = ""
    public var email = ""
    public var phone = ""
    /** dd.mm.yyyy. */
    public var dob = ""
    public var student = false
    public var plan = UpisnicaPlan.twice
    public var health = false
    public var healthText = ""
    public var consent = false
    public var news = false
    public var place = ""
    /** dd.mm.yyyy. */
    public var date = ""
    public var signaturePresent = false
    public var confidence: [ScanField: Double] = [:]
    /** Fields the owner should read before saving, in form order. */
    public var needsReview: [ScanField] = []
    public var regions: [ScanField: ScanRegion] = [:]
}

public let reviewBelowConfidence = 0.6

private enum Anchor: CaseIterable {
    case name, email, phone, dob, student, plan, health, healthText, consent, news, placeDate, signature

    var texts: [String] {
        switch self {
        case .name: ["ime i prezime"]
        case .email: ["e-mail", "email"]
        case .phone: ["broj mobitela", "mobitel", "telefon"]
        case .dob: ["datum rodenja"]
        case .student: ["student / umirovljenik", "student/umirovljenik"]
        case .plan: ["odaberite clanstvo"]
        case .health: ["postoji li nesto sto bi ucitelj trebao znati"]
        case .healthText: ["molimo navedite"]
        case .consent: ["potvrdujem da su navedeni podaci tocni"]
        case .news: ["zelim primati obavijesti"]
        case .placeDate: ["mjesto i datum"]
        case .signature: ["potpis"]
        }
    }
}

private let checked = #"[✓✔☑☒■●◉⊠✗✘]|\[\s*[x✓]\s*\]|\(\s*[x✓•]\s*\)"#
private let unchecked = #"[☐□○◯]|\[\s*\]|\(\s*\)"#
private let marker = "^(?:\(checked)|\(unchecked))\\s*"
private let anchorMaxOffset = 2
private let fuzzyMinLength = 6
private let fuzzyMinSimilarity = 0.8

private final class Item {
    let line: ScanLine
    let text: [Character]
    let folded: [Character]
    let markerLength: Int
    let confidence: Double
    var label: Anchor?
    var labelEnd = 0

    init(_ line: ScanLine) {
        self.line = line
        text = Array(collapse(line.text.precomposedStringWithCanonicalMapping))
        folded = foldCharacters(String(text))
        markerLength = groups(marker, String(folded))?[0]?.count ?? 0
        confidence = line.confidence ?? 1
    }

    var string: String { String(text) }
    var foldedString: String { String(folded) }
    var x: Double { line.x }
    var y: Double { line.y }
    var height: Double { line.height }
    var bottom: Double { line.y + line.height }
    var right: Double { line.x + line.width }
}

private func editDistance(_ a: [Character], _ b: [Character]) -> Int {
    var previous = Array(0 ... b.count)
    for i in 1 ... max(a.count, 1) where !a.isEmpty {
        var current = [i]
        for j in 1 ... max(b.count, 1) where !b.isEmpty {
            current.append(min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (a[i - 1] == b[j - 1] ? 0 : 1)))
        }
        previous = current
    }
    return previous[b.count]
}

private func matchAnchor(_ item: Item, _ anchor: String) -> (score: Double, end: Int)? {
    let body = Array(item.folded[item.markerLength...])
    let needle = Array(anchor)
    if let index = firstIndex(of: needle, in: body), index <= anchorMaxOffset {
        return (1, item.markerLength + index + needle.count)
    }
    if needle.count < fuzzyMinLength || body.count < needle.count - 1 { return nil }
    let similarity = 1 - Double(editDistance(Array(body.prefix(needle.count)), needle)) / Double(needle.count)
    return similarity >= fuzzyMinSimilarity ? (similarity, item.markerLength + needle.count) : nil
}

private func firstIndex(of needle: [Character], in haystack: [Character]) -> Int? {
    guard !needle.isEmpty, haystack.count >= needle.count else { return nil }
    for start in 0 ... haystack.count - needle.count where Array(haystack[start ..< start + needle.count]) == needle {
        return start
    }
    return nil
}

private func sameRow(_ a: Item, _ b: Item) -> Bool {
    let overlap = min(a.bottom, b.bottom) - max(a.y, b.y)
    return overlap >= 0.5 * min(a.height, b.height)
}

private func union(_ items: [Item]) -> ScanRegion? {
    guard !items.isEmpty else { return nil }
    let x = items.map(\.x).min()!
    let y = items.map(\.y).min()!
    return ScanRegion(x: x, y: y, width: items.map(\.right).max()! - x, height: items.map(\.bottom).max()! - y)
}

private struct Read {
    var text = ""
    var confidence = 0.0
    var region: ScanRegion?
    var found = false
}

/** Removes a leading match of `pattern`. */
private func dropPrefix(_ pattern: String, _ text: String) -> String {
    guard let whole = groups(pattern, text)?[0] else { return text }
    return String(text.dropFirst(whole.count))
}

public func parseUpisnica(_ lines: [ScanLine]) -> UpisnicaScan {
    // Stable sort, as in JavaScript: left to right within a row, else top to bottom.
    let items = lines.map(Item.init).filter { !$0.text.isEmpty }
        .enumerated()
        .sorted { a, b in
            let (x, y) = (a.element, b.element)
            let order = sameRow(x, y) ? x.x - y.x : x.y - y.y
            return order != 0 ? order < 0 : a.offset < b.offset
        }
        .map(\.element)

    // 1. Label anchors: each anchor claims the line that matches it best.
    var labels: [Anchor: Item] = [:]
    for key in Anchor.allCases {
        var best: (item: Item, score: Double, end: Int)?
        for item in items where item.label == nil {
            for anchor in key.texts {
                if let match = matchAnchor(item, anchor), best == nil || match.score > best!.score { best = (item, match.score, match.end) }
            }
        }
        if let best {
            best.item.label = key
            best.item.labelEnd = best.end
            labels[key] = best.item
        }
    }

    func collect(_ found: [Item], _ fallback: ScanRegion?) -> Read {
        Read(text: found.sorted { $0.x < $1.x }.map(\.string).joined(separator: " "), confidence: found.map(\.confidence).min()!, region: union(found) ?? fallback, found: true)
    }

    /** Lines that hold a value for `key`: the rest of its own line, else to its right, else the row below. */
    func valueOf(_ key: Anchor) -> Read {
        guard let label = labels[key] else { return Read() }
        let region = union([label])
        var inline = String(label.text[label.labelEnd...])
        inline = dropPrefix(#"^\s*\([^)]*\)"#, inline)
        inline = dropPrefix(#"^[\s:?.\-–]+"#, inline).trimmingCharacters(in: .whitespaces)
        if !inline.isEmpty { return Read(text: inline, confidence: label.confidence, region: region, found: true) }

        let rowLabels = items.filter { $0.label != nil && $0 !== label && sameRow($0, label) && $0.x > label.x }
        let columnEnd = rowLabels.map(\.x).min() ?? .infinity
        let tolerance = label.height

        let beside = items.filter { $0.label == nil && sameRow($0, label) && $0.x >= label.right - tolerance && $0.x < columnEnd }
        if !beside.isEmpty { return collect(beside, region) }

        let below = items
            .filter { $0.y > label.y + 0.5 * label.height && $0.y <= label.bottom + 2.5 * label.height && $0.x >= label.x - tolerance && $0.x < columnEnd - tolerance }
            .enumerated().sorted { $0.element.y != $1.element.y ? $0.element.y < $1.element.y : $0.offset < $1.offset }.map(\.element)
        guard let first = below.first, first.label == nil else { return Read(text: "", confidence: 0, region: region, found: true) }
        return collect(below.filter { $0.label == nil && sameRow($0, first) }, region)
    }

    /** Everything between a section label and the next section label, in reading order. */
    func blockAfter(_ key: Anchor, until: [Anchor]) -> Read {
        guard let label = labels[key], let start = items.firstIndex(where: { $0 === label }) else { return Read() }
        let stops = until.compactMap { labels[$0] }
        var block: [Item] = []
        for item in items[(start + 1)...] {
            if stops.contains(where: { $0 === item }) { break }
            block.append(item)
        }
        let inline = String(label.text[label.labelEnd...]).trimmingCharacters(in: .whitespaces)
        return Read(text: ([inline] + block.map(\.string)).joined(separator: " "), confidence: block.isEmpty ? label.confidence : block.map(\.confidence).min()!, region: union([label] + block), found: true)
    }

    var scan = UpisnicaScan()
    for field in ScanField.allCases { scan.confidence[field] = 0 }
    var flagged = Set<ScanField>()

    func record(_ field: ScanField, _ read: Read, _ certainty: Double? = nil) {
        let value = certainty ?? read.confidence
        scan.confidence[field] = value
        if let region = read.region { scan.regions[field] = region }
        if value < reviewBelowConfidence { flagged.insert(field) }
    }

    func textField(_ field: ScanField, _ read: Read, _ tidy: (String) -> Normalized) -> String {
        record(field, read, read.text.isEmpty ? 0 : read.confidence)
        if read.text.isEmpty { return "" }
        let tidied = tidy(read.text)
        if !tidied.valid || hasUnreadable(read.text) { flagged.insert(field) }
        return tidied.value
    }

    let thisYear = Calendar(identifier: .gregorian).component(.year, from: Date())
    scan.name = textField(.name, valueOf(.name)) { Normalized(value: titleCaseName($0), valid: true) }
    scan.email = textField(.email, valueOf(.email), normalizeEmail)
    scan.phone = textField(.phone, valueOf(.phone), normalizePhone)
    scan.dob = textField(.dob, valueOf(.dob)) { raw in
        let date = normalizeDate(raw)
        let year = Int(date.value.dropFirst(6).prefix(4)) ?? 0
        return Normalized(value: date.value, valid: date.valid && year <= thisYear)
    }

    let studentRead = valueOf(.student)
    let student = choose(studentRead.text, [(true, "da"), (false, "ne")])
    record(.student, studentRead, student == nil ? 0 : studentRead.confidence)

    let planRead = blockAfter(.plan, until: [.health, .healthText, .consent, .news, .placeDate, .signature])
    let plan = choose(planRead.text, [(UpisnicaPlan.once, "1x tjedno"), (.twice, "2x tjedno"), (.thrice, "3x tjedno"), (.unlimited, "neograniceno")])
    record(.plan, planRead, plan == nil ? 0 : planRead.confidence)

    let healthTextRead = valueOf(.healthText)
    let healthText = healthTextRead.text.trimmingCharacters(in: .whitespaces)
    let healthRead = valueOf(.health)
    let healthChoice = choose(healthRead.text, [(true, "da"), (false, "ne")])
    // A written note means "yes", whatever was (or wasn't) ticked.
    let health = !healthText.isEmpty ? true : (healthChoice ?? false)
    record(.health, healthRead, !healthText.isEmpty ? max(healthRead.confidence, healthTextRead.confidence) : healthChoice == nil ? 0 : healthRead.confidence)
    if !healthText.isEmpty {
        record(.healthText, healthTextRead)
        if hasUnreadable(healthText) { flagged.insert(.healthText) }
    } else {
        // Nothing written: only worth a look when "yes" was ticked.
        scan.confidence[.healthText] = healthTextRead.found ? healthTextRead.confidence : 0
        if let region = healthTextRead.region { scan.regions[.healthText] = region }
        if health { flagged.insert(.healthText) }
    }

    func tick(_ key: Anchor, _ field: ScanField) -> Bool? {
        guard let label = labels[key] else { return nil }
        scan.regions[field] = union([label])
        let own = String(label.folded.prefix(label.markerLength))
        // The tick box can also be a separate run just left of the sentence.
        let beside = items.filter { $0.label == nil && sameRow($0, label) && $0.x < label.x && label.x - $0.right < 3 * label.height }.last
        let mark = !own.isEmpty ? own : (beside?.foldedString ?? "")
        if matches(checked, mark) { return true }
        if matches(unchecked, mark) { return false }
        return nil
    }
    let consent = tick(.consent, .consent)
    scan.confidence[.consent] = consent == nil ? 0 : (labels[.consent]?.confidence ?? 0)
    if scan.confidence[.consent]! < reviewBelowConfidence { flagged.insert(.consent) }
    let news = tick(.news, .news)
    scan.confidence[.news] = news == nil ? 0 : (labels[.news]?.confidence ?? 0)
    // A form without the newsletter sentence simply has no opt-in; nothing to review.
    if labels[.news] != nil, scan.confidence[.news]! < reviewBelowConfidence { flagged.insert(.news) }

    let placeDateRead = valueOf(.placeDate)
    let datePattern = #"\d{1,2}\s*[./-]\s*\d{1,2}\s*[./-]\s*\d{4}\s*\.?"#
    let regex = try! NSRegularExpression(pattern: datePattern)
    let text = placeDateRead.text
    let dateMatch = regex.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)).flatMap { Range($0.range, in: text) }
    var place = dateMatch.map { String(text[..<$0.lowerBound]) } ?? text
    while let last = place.last, last.isWhitespace || last == "," || last == ";" { place.removeLast() }
    place = place.trimmingCharacters(in: .whitespaces)
    let signed = dateMatch.map { normalizeDate(String(text[$0])) } ?? Normalized(value: "", valid: true)
    scan.confidence[.place] = place.isEmpty ? 0 : placeDateRead.confidence
    scan.confidence[.date] = signed.value.isEmpty ? 0 : placeDateRead.confidence
    if let region = placeDateRead.region {
        scan.regions[.place] = region
        scan.regions[.date] = region
    }
    // Place and date are optional (the form falls back to today), so only unclear or invalid ones are flagged.
    if !place.isEmpty, placeDateRead.confidence < reviewBelowConfidence || hasUnreadable(place) { flagged.insert(.place) }
    if !signed.value.isEmpty, placeDateRead.confidence < reviewBelowConfidence || !signed.valid { flagged.insert(.date) }

    scan.student = student ?? false
    scan.plan = plan ?? .twice
    scan.health = health
    scan.healthText = healthText
    scan.consent = consent ?? false
    scan.news = news ?? false
    scan.place = place
    scan.date = signed.valid ? signed.value : ""
    scan.needsReview = ScanField.allCases.filter { flagged.contains($0) }
    return scan
}

/**
 * Picks the chosen option from text such as "☐ NE ☑ DA", "NE [x] DA" or just "DA". One ticked option wins. With no
 * tick marks, a lone option is taken as the answer. Otherwise nil.
 */
private func choose<T: Equatable>(_ text: String, _ options: [(T, String)]) -> T? {
    let folded = String(foldCharacters(text))
    var ticked: [T] = []
    var present: [T] = []
    for (value, label) in options {
        let escaped = NSRegularExpression.escapedPattern(for: label)
        let regex = try! NSRegularExpression(pattern: "(\(checked)|\(unchecked))?\\s*(?<![a-z0-9])\(escaped)(?![a-z0-9])")
        for match in regex.matches(in: folded, range: NSRange(folded.startIndex..., in: folded)) {
            if !present.contains(value) { present.append(value) }
            if let range = Range(match.range(at: 1), in: folded), matches("^(?:\(checked))$", String(folded[range])), !ticked.contains(value) {
                ticked.append(value)
            }
        }
    }
    if ticked.count == 1 { return ticked[0] }
    if ticked.isEmpty, present.count == 1, !matches(unchecked, folded) { return present[0] }
    return nil
}
