import PranaKit
import SwiftUI

/**
 * Kadulja, the studio's design system (docs/design/source/ds/tokens.json): sage leads, linen is the ground, ink carries
 * the text, terracotta is kept for what needs attention.
 */
enum DS {
    static let sage = Color(hex: 0x8A9A86)
    static let ink = Color(hex: 0x2A322E)
    static let linen = Color(hex: 0xF4EFEA)
    static let sand = Color(hex: 0xE6DACB)
    static let terracotta = Color(hex: 0xC86D51)
    static let sageDeep = Color(hex: 0x5C6B58)
    static let sageInk = Color(hex: 0x3F4B3D)
    static let mist = Color(hex: 0xE5EAE2)
    static let mistStrong = Color(hex: 0xDCE3D8)
    static let inkMuted = Color(hex: 0x535C55)
    static let muted = Color(hex: 0x6A7268)
    static let clayText = Color(hex: 0x8C3F28)
    static let blush = Color(hex: 0xF2D8CD)
    static let white = Color.white
    static let headerRow = Color(hex: 0xEDE9E2)
    static let line = Color(hex: 0xE3DCD2)
    static let lineSoft = Color(hex: 0xECE6DE)
    static let field = Color(hex: 0xD3D6CC)
    static let amberBg = Color(hex: 0xF6EAD2)
    static let amberFg = Color(hex: 0x6B4A12)
    static let amberDot = Color(hex: 0xC08A2E)
    static let stoneBg = Color(hex: 0xE8E6E0)
    static let stoneDot = Color(hex: 0x9A9F98)

    static let radius: CGFloat = 10
    static let gutter: CGFloat = 16
}

extension Color {
    init(hex: UInt32) {
        self.init(.sRGB, red: Double((hex >> 16) & 0xFF) / 255, green: Double((hex >> 8) & 0xFF) / 255, blue: Double(hex & 0xFF) / 255)
    }
}

extension ColorToken {
    var color: Color {
        switch self {
        case .spine: Color(hex: 0xD6DED3)
        case .restorative: Color(hex: 0xE6DACB)
        case .ashtanga: Color(hex: 0x8A9A86)
        case .blackLotus: Color(hex: 0xC86D51)
        case .pranayama: Color(hex: 0x2A322E)
        case .workshop: Color(hex: 0xEFD9CF)
        }
    }

    var label: String {
        switch self {
        case .spine: "Kadulja svijetla"
        case .restorative: "Pijesak"
        case .ashtanga: "Kadulja"
        case .blackLotus: "Terakota"
        case .pranayama: "Tinta"
        case .workshop: "Rumenilo"
        }
    }
}

extension MemberStatus {
    var label: String {
        switch self {
        case .active: "Aktivna"
        case .expiring: "Ističe uskoro"
        case .unpaid: "Neplaćeno"
        case .frozen: "Zamrznuta"
        case .trial: "Proba"
        case .none: "Bez članarine"
        }
    }

    var filterLabel: String {
        switch self {
        case .active: "Aktivni"
        case .expiring: "Ističu"
        case .unpaid: "Neplaćeno"
        case .frozen: "Zamrznuti"
        case .trial: "Proba"
        case .none: "Bez članarine"
        }
    }

    var colors: (background: Color, foreground: Color, dot: Color) {
        switch self {
        case .active: (DS.mistStrong, DS.sageInk, DS.sageDeep)
        case .expiring: (DS.amberBg, DS.amberFg, DS.amberDot)
        case .unpaid: (DS.blush, DS.clayText, DS.terracotta)
        case .frozen: (DS.stoneBg, DS.inkMuted, DS.stoneDot)
        case .trial: (DS.white, DS.sageInk, DS.sage)
        case .none: (DS.stoneBg, DS.inkMuted, DS.stoneDot)
        }
    }
}

extension PaymentMethod {
    var label: String {
        switch self {
        case .cash: "Gotovina"
        case .card: "Kartica"
        case .transfer: "Uplata na račun"
        }
    }
}

extension Font {
    /** Cinzel 600, for page titles; grows with Dynamic Type. */
    static func display(_ size: CGFloat, relativeTo style: TextStyle = .largeTitle) -> Font {
        .custom("Cinzel", size: size, relativeTo: style).weight(.semibold)
    }

    /** Montserrat, the UI face. */
    static func ui(_ size: CGFloat, _ weight: Weight = .regular, relativeTo style: TextStyle = .body) -> Font {
        .custom("Montserrat", size: size, relativeTo: style).weight(weight)
    }

    /** Cormorant Garamond italic, for the signature box. */
    static func signature(_ size: CGFloat) -> Font {
        .custom("Cormorant Garamond", size: size, relativeTo: .title).weight(.medium).italic()
    }
}
