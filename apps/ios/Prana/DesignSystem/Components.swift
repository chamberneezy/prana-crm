import PranaKit
import SwiftUI

// SwiftUI versions of the design system's components (docs/handoff-ios.md B4). Cards are white with a hairline,
// never a shadow; touch targets are at least 44 pt.

/** The small caps line above a title: "TJEDAN 16.–22.11." */
struct Overline: View {
    let text: String
    init(_ text: String) { self.text = text }
    var body: some View {
        Text(text.uppercased())
            .font(.ui(11, .semibold, relativeTo: .caption))
            .tracking(2.2)
            .foregroundStyle(DS.muted)
    }
}

/** Cinzel page title with an optional overline. */
struct PageTitle: View {
    let title: String
    var overline: String?
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            if let overline { Overline(overline) }
            Text(title).font(.display(28)).foregroundStyle(DS.ink)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isHeader)
    }
}

struct CardModifier: ViewModifier {
    var padding: CGFloat = 16
    func body(content: Content) -> some View {
        content
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(DS.white, in: RoundedRectangle(cornerRadius: DS.radius, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: DS.radius, style: .continuous).strokeBorder(DS.line, lineWidth: 1))
    }
}

extension View {
    func card(padding: CGFloat = 16) -> some View { modifier(CardModifier(padding: padding)) }

    /** The linen ground under a scrolling page. */
    func linenBackground() -> some View {
        background(DS.linen.ignoresSafeArea()).scrollContentBackground(.hidden)
    }
}

/** A class's colour as a rounded bar, 10 × 22 pt. */
struct ClassPill: View {
    let color: ColorToken
    var width: CGFloat = 8
    var height: CGFloat = 22
    var body: some View {
        Capsule().fill(color.color).frame(width: width, height: height).accessibilityHidden(true)
    }
}

struct TagView: View {
    enum Kind { case neutral, flag, health, plan }
    let text: String
    var kind = Kind.neutral
    init(_ text: String, kind: Kind = .neutral) {
        self.text = text
        self.kind = kind
    }

    var body: some View {
        let (bg, fg): (Color, Color) = switch kind {
        case .neutral: (DS.headerRow, DS.inkMuted)
        case .flag: (DS.white, DS.inkMuted)
        case .health: (DS.blush, DS.clayText)
        case .plan: (DS.mist, DS.sageInk)
        }
        Text(text)
            .font(.ui(12, .medium, relativeTo: .caption))
            .foregroundStyle(fg)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(bg, in: RoundedRectangle(cornerRadius: 6, style: .continuous))
            .overlay {
                if kind == .flag { RoundedRectangle(cornerRadius: 6, style: .continuous).strokeBorder(DS.field, style: StrokeStyle(lineWidth: 1, dash: [3, 2])) }
            }
    }
}

struct StatusChip: View {
    let status: MemberStatus
    var daysLeft: Int?
    var body: some View {
        let colors = status.colors
        HStack(spacing: 6) {
            Circle().fill(colors.dot).frame(width: 6, height: 6)
            Text(label)
        }
        .font(.ui(12, .semibold, relativeTo: .caption))
        .foregroundStyle(colors.foreground)
        .padding(.horizontal, 10)
        .padding(.vertical, 4)
        .background(colors.background, in: Capsule())
        .overlay { if status == .trial { Capsule().strokeBorder(DS.mistStrong) } }
    }

    private var label: String {
        if status == .expiring, let daysLeft { return daysLeft == 1 ? "Ističe za 1 dan" : "Ističe za \(daysLeft) dana" }
        return status.label
    }
}

struct Avatar: View {
    let name: String
    var size: CGFloat = 36
    var body: some View {
        let initials = name.split(separator: " ").prefix(2).compactMap(\.first).map(String.init).joined().uppercased()
        Text(initials)
            .font(.ui(size * 0.36, .semibold))
            .foregroundStyle(DS.sageInk)
            .frame(width: size, height: size)
            .background(DS.mistStrong, in: Circle())
            .accessibilityHidden(true)
    }
}

/** A calm message: terracotta edge, blush ground. */
struct NoticeView: View {
    var title: String?
    let message: String
    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: "exclamationmark.circle").foregroundStyle(DS.terracotta).font(.system(size: 17, weight: .light))
            VStack(alignment: .leading, spacing: 4) {
                if let title { Text(title).font(.ui(14, .semibold)).foregroundStyle(DS.clayText) }
                Text(message).font(.ui(14)).foregroundStyle(DS.ink).fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
        .padding(14)
        .background(DS.blush.opacity(0.6), in: RoundedRectangle(cornerRadius: DS.radius, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: DS.radius, style: .continuous).strokeBorder(DS.terracotta.opacity(0.35)))
        .accessibilityElement(children: .combine)
    }
}

struct EmptyStateView: View {
    let title: String
    var message: String?
    var systemImage = "leaf"
    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: systemImage).font(.system(size: 26, weight: .ultraLight)).foregroundStyle(DS.sage)
            Text(title).font(.ui(15, .semibold)).foregroundStyle(DS.ink)
            if let message { Text(message).font(.ui(13)).foregroundStyle(DS.muted).multilineTextAlignment(.center) }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 28)
        .padding(.horizontal, 16)
        .background(DS.white.opacity(0.5), in: RoundedRectangle(cornerRadius: DS.radius, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: DS.radius, style: .continuous).strokeBorder(DS.field, style: StrokeStyle(lineWidth: 1, dash: [4, 3])))
    }
}

/** Buttons in the content: ink for the main action, outlined for the rest. Glass is kept for the bars above content. */
struct DSButtonStyle: ButtonStyle {
    enum Kind { case primary, secondary, ghost, attention }
    var kind = Kind.primary
    var compact = false
    var fullWidth = false

    func makeBody(configuration: Configuration) -> some View {
        let (bg, fg, border): (Color, Color, Color) = switch kind {
        case .primary: (DS.ink, DS.white, .clear)
        case .secondary: (DS.white, DS.ink, DS.ink)
        case .ghost: (.clear, DS.ink, .clear)
        case .attention: (DS.terracotta, DS.white, .clear)
        }
        configuration.label
            .font(.ui(compact ? 14 : 15, .semibold))
            .lineLimit(1)
            .padding(.horizontal, compact ? 14 : 18)
            .frame(minHeight: compact ? 44 : 50)
            .frame(maxWidth: fullWidth ? .infinity : nil)
            .foregroundStyle(fg)
            .background(bg, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 8, style: .continuous).strokeBorder(border, lineWidth: 1))
            .opacity(configuration.isPressed ? 0.75 : 1)
            .contentShape(Rectangle())
    }
}

extension ButtonStyle where Self == DSButtonStyle {
    static var primary: DSButtonStyle { DSButtonStyle(kind: .primary) }
    static var secondary: DSButtonStyle { DSButtonStyle(kind: .secondary) }
    static func ds(_ kind: DSButtonStyle.Kind, compact: Bool = false, fullWidth: Bool = false) -> DSButtonStyle {
        DSButtonStyle(kind: kind, compact: compact, fullWidth: fullWidth)
    }
}

// MARK: Liquid Glass (iOS 26), with a material fallback on earlier versions

extension View {
    /** Floating controls (the toast, the week switcher) sit on glass. */
    @ViewBuilder
    func glassSurface<S: Shape>(in shape: S, interactive: Bool = false) -> some View {
        if #available(iOS 26.0, *) {
            glassEffect(interactive ? .regular.interactive() : .regular, in: shape)
        } else {
            background(.ultraThinMaterial, in: shape)
        }
    }

    /** The tab bar shrinks to its glass pill while scrolling down, as in Apple's own apps. */
    @ViewBuilder
    func minimizingTabBar() -> some View {
        if #available(iOS 26.0, *) {
            tabBarMinimizeBehavior(.onScrollDown)
        } else {
            self
        }
    }

    /** A glass button style in toolbars on iOS 26; the system default before. */
    @ViewBuilder
    func glassButton(prominent: Bool = false) -> some View {
        if #available(iOS 26.0, *) {
            if prominent { buttonStyle(.glassProminent) } else { buttonStyle(.glass) }
        } else {
            if prominent { buttonStyle(.borderedProminent) } else { buttonStyle(.bordered) }
        }
    }
}

// MARK: Toast

struct ToastOverlay: ViewModifier {
    @Environment(AppModel.self) private var model

    func body(content: Content) -> some View {
        content.overlay(alignment: .top) {
            if let toast = model.toast {
                Label(toast.message, systemImage: toast.systemImage)
                    .font(.ui(14, .medium))
                    .foregroundStyle(DS.ink)
                    .padding(.horizontal, 18)
                    .padding(.vertical, 12)
                    .glassSurface(in: Capsule())
                    .padding(.horizontal, DS.gutter)
                    .padding(.top, 8)
                    .transition(.move(edge: .top).combined(with: .opacity))
                    .accessibilityAddTraits(.isStaticText)
                    .task(id: toast.id) {
                        try? await Task.sleep(for: .seconds(3))
                        if model.toast?.id == toast.id { model.toast = nil }
                    }
                    .onTapGesture { model.toast = nil }
            }
        }
        .animation(.spring(duration: 0.35), value: model.toast)
        .sensoryFeedback(.success, trigger: model.toast?.id) { _, new in new != nil }
    }
}

extension View {
    func toastOverlay() -> some View { modifier(ToastOverlay()) }
}

// MARK: Loading

/** Something loaded from the API: the value, or what went wrong. */
enum Loadable<Value> {
    case loading
    case loaded(Value)
    case failed(String)

    var value: Value? {
        if case let .loaded(value) = self { return value }
        return nil
    }
}

extension Error {
    /** Words for people, in Croatian. */
    var message: String {
        if let error = self as? PranaError { return error.message() }
        if let error = self as? SignInError { return error.message() }
        return PranaError.unexpected.message()
    }
}

/** Shows a spinner, a retryable error or the content. */
struct LoadingView<Value, Content: View>: View {
    let state: Loadable<Value>
    let retry: () async -> Void
    @ViewBuilder let content: (Value) -> Content

    var body: some View {
        switch state {
        case .loading:
            ProgressView().controlSize(.large).tint(DS.sage).frame(maxWidth: .infinity, minHeight: 200)
        case let .failed(message):
            VStack(spacing: 12) {
                NoticeView(title: "Nije se učitalo", message: message)
                Button("Pokušaj ponovno") { Task { await retry() } }.buttonStyle(.ds(.secondary, compact: true))
            }
        case let .loaded(value):
            content(value)
        }
    }
}

// MARK: The week

/** Pon–Ned with the date; the chosen day in ink. A dot marks days with classes, terracotta a closed day. */
struct WeekStrip: View {
    let days: [String]
    @Binding var selected: String
    var today: String
    var hasClasses: (String) -> Bool
    var isClosed: (String) -> Bool = { _ in false }
    let time: StudioTime

    var body: some View {
        HStack(spacing: 6) {
            ForEach(days, id: \.self) { day in
                let chosen = day == selected
                Button {
                    selected = day
                } label: {
                    VStack(spacing: 2) {
                        Text(Weekday.short[time.weekday(day)]).font(.ui(12, .medium, relativeTo: .caption))
                        Text(time.dayOfMonth(day)).font(.ui(19, .semibold, relativeTo: .title3)).monospacedDigit()
                        Circle()
                            .fill(isClosed(day) ? DS.terracotta : (hasClasses(day) ? (chosen ? DS.white : DS.sage) : .clear))
                            .frame(width: 5, height: 5)
                    }
                    .frame(maxWidth: .infinity, minHeight: 62)
                    .foregroundStyle(chosen ? DS.white : DS.ink)
                    .background(chosen ? DS.ink : DS.white, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                    .overlay {
                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                            .strokeBorder(day == today && !chosen ? DS.sageDeep : (chosen ? .clear : DS.line), lineWidth: day == today && !chosen ? 1.5 : 1)
                    }
                }
                .buttonStyle(.plain)
                .accessibilityLabel("\(Weekday.long[time.weekday(day)]), \(time.dayMonth(day))")
                .accessibilityAddTraits(chosen ? .isSelected : [])
            }
        }
        .sensoryFeedback(.selection, trigger: selected)
    }
}

/** ‹ 16.–22.11. › with "Ovaj tjedan"; on glass, so it reads over the scrolling list. */
struct WeekSwitcher: View {
    let monday: String
    let thisMonday: String
    let time: StudioTime
    var disabled = false
    let go: (String) -> Void

    var body: some View {
        HStack(spacing: 4) {
            Button { go(time.addDays(monday, -7)) } label: { Image(systemName: "chevron.left").frame(width: 44, height: 44) }
                .accessibilityLabel("Prethodni tjedan")
            Text(time.weekRange(monday)).font(.ui(15, .semibold)).monospacedDigit().frame(minWidth: 110)
            Button { go(time.addDays(monday, 7)) } label: { Image(systemName: "chevron.right").frame(width: 44, height: 44) }
                .accessibilityLabel("Sljedeći tjedan")
            if monday != thisMonday {
                Button("Ovaj tjedan") { go(thisMonday) }.font(.ui(13, .semibold)).padding(.trailing, 10)
            }
        }
        .foregroundStyle(DS.ink)
        .disabled(disabled)
        .glassSurface(in: Capsule(), interactive: true)
    }
}

/** Swiping across the week changes it, as in the design. */
struct WeekSwipe: ViewModifier {
    let previous: () -> Void
    let next: () -> Void
    func body(content: Content) -> some View {
        content.simultaneousGesture(
            DragGesture(minimumDistance: 40).onEnded { value in
                guard abs(value.translation.width) > abs(value.translation.height) * 2 else { return }
                if value.translation.width < -60 { next() } else if value.translation.width > 60 { previous() }
            }
        )
    }
}

// MARK: Small helpers

extension StudioTime {
    /** "Ponedjeljak, 16.11." */
    func longDay(_ day: String) -> String { "\(Weekday.long[weekday(day)]), \(dayMonth(day))" }
    /** "pon 16.11. u 09:00" */
    func shortMoment(_ date: Date) -> String {
        let d = day(of: date)
        return "\(Weekday.short[weekday(d)].lowercased()) \(dayMonth(d)) u \(time(date))"
    }
    /** "16.11.2026." from "2026-11-16". */
    func display(_ iso: String) -> String {
        let p = iso.split(separator: "-")
        guard p.count == 3 else { return iso }
        return "\(p[2]).\(p[1]).\(p[0])."
    }
}

/** Croatian plural: 1 dolazak, 2 dolaska, 5 dolazaka. */
func plural(_ n: Int, _ one: String, _ few: String, _ other: String) -> String {
    let mod10 = n % 10, mod100 = n % 100
    let word = mod10 == 1 && mod100 != 11 ? one : ((2 ... 4).contains(mod10) && !(12 ... 14).contains(mod100) ? few : other)
    return "\(n) \(word)"
}
