import Foundation

/**
 * Days and times as the studio sees them, in its own time zone (Europe/Zagreb), whatever the phone's zone.
 * Days are "YYYY-MM-DD" strings, as in the API; weeks start on Monday.
 */
public struct StudioTime: Sendable {
    public let timeZone: TimeZone
    private let calendar: Calendar

    public init(timeZone: TimeZone = TimeZone(identifier: "Europe/Zagreb")!) {
        self.timeZone = timeZone
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timeZone
        calendar.firstWeekday = 2
        calendar.locale = Locale(identifier: "hr_HR")
        self.calendar = calendar
    }

    /** The studio day an instant falls on. */
    public func day(of date: Date) -> String {
        let c = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year!, c.month!, c.day!)
    }

    /** Noon of a day, as an instant: safe for adding days across daylight-saving changes. */
    func noon(_ day: String) -> Date {
        let parts = day.split(separator: "-").compactMap { Int($0) }
        precondition(parts.count == 3, "not a YYYY-MM-DD day: \(day)")
        return calendar.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2], hour: 12))!
    }

    public func addDays(_ day: String, _ days: Int) -> String {
        self.day(of: calendar.date(byAdding: .day, value: days, to: noon(day))!)
    }

    /** 1 = Monday … 7 = Sunday. */
    public func weekday(_ day: String) -> Int {
        let sundayFirst = calendar.component(.weekday, from: noon(day))
        return (sundayFirst + 5) % 7 + 1
    }

    public func monday(of day: String) -> String { addDays(day, 1 - weekday(day)) }

    public func week(of day: String) -> [String] {
        let start = monday(of: day)
        return (0 ..< 7).map { addDays(start, $0) }
    }

    public func today(now: Date = Date()) -> String { day(of: now) }

    /** "18:15". */
    public func time(_ date: Date) -> String {
        let c = calendar.dateComponents([.hour, .minute], from: date)
        return String(format: "%02d:%02d", c.hour!, c.minute!)
    }

    /** "18:15–19:30", with an en dash. */
    public func timeRange(_ start: Date, _ end: Date) -> String { "\(time(start))–\(time(end))" }

    /** "16.11." */
    public func dayMonth(_ day: String) -> String {
        let p = day.split(separator: "-")
        return "\(p[2]).\(p[1])."
    }

    /** "16." */
    public func dayOfMonth(_ day: String) -> String { String(Int(day.split(separator: "-")[2])!) }

    /** "16.–22.11." or "30.11.–6.12." for the week starting on `monday`. */
    public func weekRange(_ monday: String) -> String {
        let sunday = addDays(monday, 6)
        let (m1, m2) = (monday.split(separator: "-")[1], sunday.split(separator: "-")[1])
        let first = m1 == m2 ? "\(dayOfMonth(monday))." : "\(dayOfMonth(monday)).\(m1)."
        return "\(first)–\(dayOfMonth(sunday)).\(m2)."
    }
}

/** Croatian day names, as on the web (weekday.short / weekday.long). Index 1 = Monday. */
public enum Weekday {
    public static let short = ["", "Pon", "Uto", "Sri", "Čet", "Pet", "Sub", "Ned"]
    public static let long = ["", "Ponedjeljak", "Utorak", "Srijeda", "Četvrtak", "Petak", "Subota", "Nedjelja"]
    public static let shortEnglish = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    public static let longEnglish = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
}

/**
 * The entry rule as it applies to one class: a rule naming minutes ("Ulaz do 60 min nakon početka") becomes a clock
 * time ("ulaz do 18:00"); any other rule is shown as written, lower-cased ("slobodan ulaz"). Same as the web.
 */
public func entryNote(_ rule: String?, startsAt: Date, time: StudioTime = StudioTime()) -> String? {
    guard let rule, !rule.isEmpty else { return nil }
    if let match = rule.firstMatch(of: /(\d+)\s*min/.ignoresCase()), let minutes = Int(match.1) {
        return "ulaz do \(time.time(startsAt.addingTimeInterval(TimeInterval(minutes * 60))))"
    }
    return rule.prefix(1).lowercased() + rule.dropFirst()
}

/** "65,00 €" */
public func formatMoney(cents: Int) -> String {
    let euros = cents / 100
    let rest = abs(cents % 100)
    var grouped = String(abs(euros))
    var i = grouped.count - 3
    while i > 0 {
        grouped.insert(".", at: grouped.index(grouped.startIndex, offsetBy: i))
        i -= 3
    }
    return "\(cents < 0 ? "-" : "")\(grouped),\(String(format: "%02d", rest)) €"
}
