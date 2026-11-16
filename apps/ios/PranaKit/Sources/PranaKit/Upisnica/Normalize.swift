import Foundation

// Value clean-up for the upisnica parser. A port of packages/shared/src/upisnica/normalize.ts; same results.

public struct Normalized: Equatable, Sendable {
    public let value: String
    public let valid: Bool
}

func collapse(_ text: String) -> String { text.split(whereSeparator: \.isWhitespace).joined(separator: " ") }

func matches(_ pattern: String, _ text: String) -> Bool {
    (try? NSRegularExpression(pattern: pattern))?.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)) != nil
}

/** The capture groups of the first match (index 0 is the whole match), or nil. */
func groups(_ pattern: String, _ text: String) -> [String?]? {
    guard let regex = try? NSRegularExpression(pattern: pattern),
          let match = regex.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)) else { return nil }
    return (0 ..< match.numberOfRanges).map { i in Range(match.range(at: i), in: text).map { String(text[$0]) } }
}

/** A character the recogniser could not read. */
public func hasUnreadable(_ text: String) -> Bool { text.contains("?") || text.contains("\u{FFFD}") }

/** Lower-case, no spaces. */
public func normalizeEmail(_ raw: String) -> Normalized {
    let value = raw.filter { !$0.isWhitespace }.lowercased()
    return Normalized(value: value, valid: matches(#"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$"#, value))
}

/** Croatian format: "091 234 5678". +385 and 00385 become the leading 0. */
public func normalizePhone(_ raw: String) -> Normalized {
    let trimmed = collapse(raw)
    if matches(#"[^\d\s+()\-/.]"#, trimmed) { return Normalized(value: trimmed, valid: false) }
    var digits = trimmed.filter(\.isASCII).filter(\.isNumber)
    if trimmed.hasPrefix("+385") { digits = "0" + digits.dropFirst(3) }
    else if digits.hasPrefix("00385") { digits = "0" + digits.dropFirst(5) }
    // A 0 kept after the country code ("+385 (0)91 …") would otherwise double up.
    if digits.hasPrefix("00") { digits = String(digits.dropFirst()) }
    let d = Array(digits)
    if matches(#"^0\d{8,9}$"#, digits) {
        return Normalized(value: "\(String(d[0 ..< 3])) \(String(d[3 ..< 6])) \(String(d[6...]))", valid: true)
    }
    return Normalized(value: trimmed, valid: false)
}

/** Whether the day exists, e.g. not 31.02. */
func isRealDate(day: Int, month: Int, year: Int) -> Bool {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = TimeZone(identifier: "UTC")!
    guard (1 ... 12).contains(month), day >= 1, let date = calendar.date(from: DateComponents(year: year, month: month, day: day)) else { return false }
    let c = calendar.dateComponents([.year, .month, .day], from: date)
    return c.year == year && c.month == month && c.day == day
}

/** "dd.mm.yyyy." from d.m.yyyy with dots, slashes or dashes. The date must exist. */
public func normalizeDate(_ raw: String) -> Normalized {
    let trimmed = collapse(raw)
    guard let g = groups(#"^(\d{1,2})\s*[./-]\s*(\d{1,2})\s*[./-]\s*(\d{4})\s*\.?$"#, trimmed),
          let day = Int(g[1] ?? ""), let month = Int(g[2] ?? ""), let year = Int(g[3] ?? "") else {
        return Normalized(value: trimmed, valid: false)
    }
    guard year >= 1900, isRealDate(day: day, month: month, year: year) else { return Normalized(value: trimmed, valid: false) }
    return Normalized(value: String(format: "%02d.%02d.%04d.", day, month, year), valid: true)
}

/** Title case that keeps č ć š ž đ and handles double-barrelled names: "ana-marija ČAČIĆ" → "Ana-Marija Čačić". */
public func titleCaseName(_ raw: String) -> String {
    let hr = Locale(identifier: "hr")
    return collapse(raw)
        .split(separator: " ", omittingEmptySubsequences: false)
        .map { word in
            word.split(separator: "-", omittingEmptySubsequences: false)
                .map { part in part.isEmpty ? "" : part.prefix(1).uppercased(with: hr) + part.dropFirst().lowercased(with: hr) }
                .joined(separator: "-")
        }
        .joined(separator: " ")
}

/**
 * Lower-case without diacritics (č ć š ž đ → c c s z d), × as x, one character for each character of the input, so
 * positions in the folded text are positions in the original. Same as foldText on the web.
 */
func foldCharacters(_ text: String) -> [Character] {
    text.map { ch in
        if ch == "×" { return "x" }
        if ch == "đ" || ch == "Đ" { return "d" }
        let stripped = String(ch).decomposedStringWithCanonicalMapping.unicodeScalars.filter { !$0.properties.isDiacritic || $0.value < 0x300 || $0.value > 0x36F }
        let folded = String(String.UnicodeScalarView(stripped)).lowercased()
        return folded.count == 1 ? Character(folded) : ch
    }
}
