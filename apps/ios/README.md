# Prana — iOS app

One app for two kinds of people:

- **Members (the default).** No account. The week's classes as the studio enters them, and **Prijavi se** on a class
  with first and last name. The name must match a member of the studio (case, spacing and č ć š ž đ don't count),
  otherwise the sign-up is refused. No limits. A sign-up is a *najava*: staff see it on the class and check the person
  in; it counts toward the membership only then. Sign-ups made on the phone are listed under **Moje prijave** and can
  be cancelled from there (the phone keeps a cancel token; nothing else identifies it).
- **Staff.** Tap the studio's name at the top **five times quickly** to open the sign-in. After signing in (an address on
  the studio's staff list), the app is the studio tool: everything the web app has (Pregled, Raspored with najave and
  check-in, Neradni dani, Tjedni plan, Vrste satova, Učitelji, Članovi and profiles, Upis člana by photo, PDF or by
  hand, Članarine, Uplate, Analitika). "Prikaz za članove" goes back to the members' view without signing out.

The bottom bar is the system tab bar, which iOS 26 draws in Liquid Glass and shrinks while scrolling; "Upis člana"
rides above it as the tab bar's accessory. Toasts and the week switcher sit on glass too; content keeps the studio's
design system (linen ground, white cards, Cinzel titles, Montserrat text).

## Layout

| Path | What |
|---|---|
| `project.yml` | The Xcode project, generated with [XcodeGen](https://github.com/yonaskolb/XcodeGen) (the `.xcodeproj` isn't committed) |
| `PranaKit/` | Swift package with everything that isn't UI: API models and client, staff sign-in (Firebase Auth REST, no SDK), studio-time dates, the phone's sign-ups, the upisnica parser. Builds and tests on Linux too. |
| `PranaKit/Tests/PranaKitTests/Fixtures/` | Real API answers, written by `IOS_FIXTURES=1 npx vitest run api/test/ios-fixtures.test.ts` |
| `Prana/App`, `Prana/DesignSystem` | App state, Keychain, the design system in SwiftUI (with the iOS 26 glass helpers) |
| `Prana/Student` | The members' view and sign-up |
| `Prana/Staff` | The studio tool |
| `Prana/Resources` | Fonts (OFL), icon, logo |

## Build on Linux (no Mac)

On a machine with xtool and the Darwin SDK ([omarchy-apple-dev](https://github.com/joshuaswarren/omarchy-apple-dev)),
`Package.swift`, `xtool.yml` and `xtool-Info.plist` build the same sources:

```sh
cd apps/ios && xtool dev build          # → xtool/Prana.app (compile check)
bash scripts/linux-testflight.sh --check   # signed .ipa + 41 offline App Store checks
bash scripts/linux-testflight.sh           # the same, then upload to TestFlight
```

`xtool-Info.plist` carries the Release values (no build-setting expansion). In this build the logo and fonts live in
SwiftPM's resource bundle, so the app reads them through `Bundle.prana` and registers the fonts itself.

## Run it

On a Mac with Xcode 26:

```sh
brew install xcodegen
cd apps/ios && xcodegen && open Prana.xcodeproj
```

- **Debug** talks to the API on `http://localhost:8787` with the Firebase Auth emulator on `localhost:9099`
  (`npm run dev:all` in the repo root starts both, with the sample data). Staff sign-in: `mario@prana.test` / `prana-dev`; a member to sign up as: Ana Horvat.
- **Release** needs the API deployed: set `PRANA_API_URL` in `project.yml`. Sign-in uses the Firebase project "Prana".
- `cd apps/ios/PranaKit && swift test` runs the package's tests (also on Linux). The upisnica parser is checked
  against the same `fixtures/upisnica` cases as the web parser.

CI (`.github/workflows/ios.yml`) runs the package tests on Linux and builds the app for the simulator on macOS.
