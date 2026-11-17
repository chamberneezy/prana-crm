import SwiftUI

/**
 * The first thing a member sees, once: who the studio is and what the app does (see the week, sign up with first and
 * last name, cancel under Moje prijave), in three short pages, before the timetable.
 */
struct WelcomeView: View {
    let done: () -> Void
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var page = 0
    @State private var appeared = false

    private struct Page {
        let symbol: String
        let title: String
        let text: String
    }

    private let pages = [
        Page(symbol: "calendar", title: "Raspored na dlanu", text: "Svi satovi studija, uvijek ažurni. Prijeđite prstom za sljedeći tjedan."),
        Page(symbol: "person.crop.circle.badge.checkmark", title: "Prijava imenom", text: "Bez računa i lozinke: upišite ime i prezime kao kod upisa u studio i mjesto je Vaše."),
        Page(symbol: "checkmark.seal", title: "Sve na jednom mjestu", text: "Vaše prijave čekaju pod „Moje prijave”. Promijenili ste planove? Odjava je jedan dodir."),
    ]

    var body: some View {
        let last = page == pages.count - 1
        ZStack {
            DS.linen.ignoresSafeArea()
            Backdrop(animated: !reduceMotion)

            VStack(spacing: 0) {
                HStack {
                    Spacer()
                    Button("Preskoči", action: done)
                        .font(.ui(15, .medium))
                        .foregroundStyle(DS.muted)
                        .opacity(last ? 0 : 1)
                        .disabled(last)
                }
                .frame(height: 44)
                .padding(.horizontal, 20)

                Spacer(minLength: 8)

                VStack(spacing: 6) {
                    Image("Logo", bundle: .prana).resizable().scaledToFit().frame(width: 92, height: 82)
                        .scaleEffect(appeared ? 1 : 0.7)
                        .opacity(appeared ? 1 : 0)
                        .accessibilityHidden(true)
                    Text("Dobro došli u").font(.signature(26)).foregroundStyle(DS.sageDeep)
                        .opacity(appeared ? 1 : 0).offset(y: appeared ? 0 : 8)
                    Text("Prana Yoga Studio").font(.display(26, relativeTo: .title)).foregroundStyle(DS.ink)
                        .multilineTextAlignment(.center)
                        .opacity(appeared ? 1 : 0).offset(y: appeared ? 0 : 12)
                }

                Spacer(minLength: 20)

                TabView(selection: $page) {
                    ForEach(pages.indices, id: \.self) { i in
                        pageView(pages[i], active: page == i).tag(i)
                    }
                }
                .tabViewStyle(.page(indexDisplayMode: .never))
                .frame(height: 250)
                .opacity(appeared ? 1 : 0)

                HStack(spacing: 8) {
                    ForEach(pages.indices, id: \.self) { i in
                        Capsule()
                            .fill(i == page ? DS.ink : DS.sage.opacity(0.35))
                            .frame(width: i == page ? 22 : 7, height: 7)
                    }
                }
                .animation(.snappy, value: page)
                .accessibilityHidden(true)

                Spacer(minLength: 20)

                Button(last ? "Pogledaj raspored" : "Dalje") {
                    if last { done() } else { withAnimation(.smooth) { page += 1 } }
                }
                .buttonStyle(.ds(.primary, fullWidth: true))
                .contentTransition(.opacity)
                .padding(.horizontal, 24)
                .padding(.bottom, 16)
                .opacity(appeared ? 1 : 0)
            }
        }
        .sensoryFeedback(.selection, trigger: page)
        .onAppear {
            withAnimation(reduceMotion ? .easeOut(duration: 0.3) : .spring(duration: 0.9, bounce: 0.25).delay(0.15)) { appeared = true }
        }
    }

    private func pageView(_ item: Page, active: Bool) -> some View {
        VStack(spacing: 18) {
            Image(systemName: item.symbol)
                .font(.system(size: 40, weight: .light))
                .foregroundStyle(DS.sageDeep)
                .symbolEffect(.bounce, value: active)
                .frame(width: 96, height: 96)
                .background(Circle().fill(DS.white))
                .overlay(Circle().strokeBorder(DS.line))
                .shadow(color: DS.ink.opacity(0.06), radius: 12, y: 6)
            VStack(spacing: 8) {
                Text(item.title).font(.display(20, relativeTo: .title2)).foregroundStyle(DS.ink)
                Text(item.text).font(.ui(16, relativeTo: .body)).foregroundStyle(DS.inkMuted)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(.horizontal, 32)
            .opacity(active ? 1 : 0.3)
            .offset(y: active ? 0 : 10)
            .animation(.smooth(duration: 0.5), value: active)
        }
        .accessibilityElement(children: .combine)
    }
}

/** Two soft sage and sand glows drifting slowly behind the welcome, like breath. */
private struct Backdrop: View {
    let animated: Bool
    @State private var drift = false

    var body: some View {
        ZStack {
            Circle().fill(DS.sage.opacity(0.22)).frame(width: 340).blur(radius: 70)
                .offset(x: drift ? 90 : -40, y: drift ? -250 : -180)
            Circle().fill(DS.sand.opacity(0.55)).frame(width: 300).blur(radius: 70)
                .offset(x: drift ? -90 : 30, y: drift ? 260 : 200)
        }
        .allowsHitTesting(false)
        .ignoresSafeArea()
        .onAppear {
            guard animated else { return }
            withAnimation(.easeInOut(duration: 7).repeatForever(autoreverses: true)) { drift = true }
        }
    }
}
