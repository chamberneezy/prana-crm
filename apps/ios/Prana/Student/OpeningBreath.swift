import SwiftUI

/**
 * The opening breath, on every launch after the welcome: the logo and the studio's name swell in the middle of the
 * screen as you breathe in, then glide up into their places in the header as you breathe out, while the timetable
 * fades in beneath them. About 2.6 seconds; a tap skips it; with Reduce Motion it doesn't play.
 *
 * The header reports where its logo and name sit (in global coordinates), so the moving copies land on the pixel and
 * the swap to the real ones can't be seen.
 */
@MainActor @Observable
final class OpeningBreathModel {
    enum Part: Hashable { case logo, name }

    /** True while the intro covers the screen: the header hides its own logo and name. */
    private(set) var running: Bool
    /** The timetable under the header: hidden until the breath out, then rises in. */
    private(set) var contentShown: Bool
    private(set) var greetingShown: Bool
    var frames: [Part: CGRect] = [:]

    init(play: Bool) {
        running = play
        contentShown = !play
        greetingShown = !play
    }

    func showContent() { contentShown = true }
    func showGreeting() { greetingShown = true }

    func finish() {
        running = false
        contentShown = true
        greetingShown = true
    }
}

extension EnvironmentValues {
    @Entry var openingBreath: OpeningBreathModel? = nil
}

extension View {
    /** Reports this view's frame to the opening breath, and hides it while the moving copy stands in for it. */
    func breathTarget(_ part: OpeningBreathModel.Part) -> some View { modifier(BreathTarget(part: part)) }

    /** Part of what the breath reveals: hidden while it runs, then lifted in, each a moment after the one before. */
    func breathReveal(_ index: Int, greeting: Bool = false) -> some View { modifier(BreathReveal(index: index, greeting: greeting)) }
}

private struct BreathTarget: ViewModifier {
    let part: OpeningBreathModel.Part
    @Environment(\.openingBreath) private var breath

    func body(content: Content) -> some View {
        content
            .onGeometryChange(for: CGRect.self) { $0.frame(in: .global) } action: { breath?.frames[part] = $0 }
            .opacity(breath?.running == true ? 0 : 1)
    }
}

private struct BreathReveal: ViewModifier {
    let index: Int
    let greeting: Bool
    @Environment(\.openingBreath) private var breath

    func body(content: Content) -> some View {
        let shown = greeting ? breath?.greetingShown ?? true : breath?.contentShown ?? true
        content
            .opacity(shown ? 1 : 0)
            .offset(y: shown || greeting ? 0 : 14)
            .animation(greeting ? .easeInOut(duration: 0.9) : .timingCurve(0.22, 1, 0.36, 1, duration: 1.0).delay(Double(index) * 0.09), value: shown)
    }
}

/** The covering layer with the moving logo and name. Lives above the whole member screen, tab bar included. */
struct OpeningBreathOverlay: View {
    let breath: OpeningBreathModel
    var name = "Prana Yoga Studio"

    /** The breath in takes this share of the whole; the breath out (and the glide up) the rest. */
    private static let total = 2.6
    private static let breathIn = 0.4
    private static let logoScale = 88.0 / 60.0
    private static let nameScale = 1.3

    @State private var phase = Phase.start
    @State private var cover = 1.0
    @State private var started = false

    private enum Phase { case start, inhaled, landed }

    var body: some View {
        GeometryReader { proxy in
            let origin = proxy.frame(in: .global).origin
            ZStack(alignment: .topLeading) {
                DS.linen.opacity(cover).ignoresSafeArea()
                if let logo = breath.frames[.logo], let title = breath.frames[.name] {
                    let layout = Layout(logo: logo.offsetBy(dx: -origin.x, dy: -origin.y), name: title.offsetBy(dx: -origin.x, dy: -origin.y), size: proxy.size)
                    Image("Logo", bundle: .prana).resizable().scaledToFit()
                        .modifier(Glide(rect: layout.logo, centre: layout.logoCentre, scale: Self.logoScale, phase: phase))
                    Text(name).font(.display(22, relativeTo: .title2)).foregroundStyle(DS.ink)
                        .multilineTextAlignment(.center)
                        .fixedSize()
                        .modifier(Glide(rect: layout.name, centre: layout.nameCentre, scale: Self.nameScale, phase: phase))
                        .task { await run() }
                }
            }
        }
        .ignoresSafeArea()
        .contentShape(Rectangle())
        .onTapGesture { skip() }
        // Should the header never report where it is, step aside rather than cover the app.
        .task {
            try? await Task.sleep(for: .seconds(1.5))
            if !started { skip() }
        }
        .accessibilityHidden(true)
    }

    private func run() async {
        guard !started else { return }
        started = true
        let breathIn = Self.total * Self.breathIn, breathOut = Self.total - breathIn
        withAnimation(.timingCurve(0.45, 0, 0.55, 1, duration: breathIn)) { phase = .inhaled }
        try? await Task.sleep(for: .seconds(breathIn))
        withAnimation(.timingCurve(0.5, 0, 0.15, 1, duration: breathOut)) { phase = .landed }
        withAnimation(.easeInOut(duration: 1.3).delay(1.2 - breathIn)) { cover = 0 }
        try? await Task.sleep(for: .seconds(1.5 - breathIn))
        breath.showContent()
        try? await Task.sleep(for: .seconds(0.4))
        breath.showGreeting()
        try? await Task.sleep(for: .seconds(Self.total - 1.9))
        breath.finish()
    }

    private func skip() {
        withAnimation(.easeOut(duration: 0.3)) {
            phase = .landed
            cover = 0
        }
        breath.showContent()
        breath.showGreeting()
        Task {
            try? await Task.sleep(for: .seconds(0.3))
            breath.finish()
        }
    }

    /** Where the two sit in the middle of the screen, stacked and centred, at their larger size. */
    private struct Layout {
        let logo: CGRect, name: CGRect
        let logoCentre: CGPoint, nameCentre: CGPoint

        init(logo: CGRect, name: CGRect, size: CGSize) {
            self.logo = logo
            self.name = name
            let gap = 14.0
            let logoHeight = logo.height * OpeningBreathOverlay.logoScale, nameHeight = name.height * OpeningBreathOverlay.nameScale
            let top = size.height / 2 - (logoHeight + gap + nameHeight) / 2 - 16
            logoCentre = CGPoint(x: size.width / 2, y: top + logoHeight / 2)
            nameCentre = CGPoint(x: size.width / 2, y: top + logoHeight + gap + nameHeight / 2)
        }
    }

    /** Drawn at its place in the header; moved to the middle and enlarged until the breath out takes that away. */
    private struct Glide: ViewModifier {
        let rect: CGRect
        let centre: CGPoint
        let scale: Double
        let phase: Phase

        func body(content: Content) -> some View {
            let away = phase != .landed
            let size = switch phase {
            case .start: scale * 0.9
            case .inhaled: scale * 1.06
            case .landed: 1.0
            }
            content
                .frame(width: rect.width, height: rect.height)
                .scaleEffect(size)
                .position(x: rect.midX, y: rect.midY)
                .offset(x: away ? centre.x - rect.midX : 0, y: away ? centre.y - rect.midY : 0)
                .opacity(phase == .start ? 0 : 1)
        }
    }
}
