# Prana CRM — Design handoff

Owner: Mario · Exported 11.10.2026. from the design canvas · For: Claude Code

This folder is the **visual source of truth** for both apps. Put it in the repo at `docs/design/`.

- **Visuals**: this folder decides how screens look.
- **Behaviour**: `docs/handoff-web.md` and `docs/handoff-ios.md` decide behaviour, data and architecture.

If the two disagree, follow the handoff for behaviour and this folder for layout, spacing and colour.

## What's inside

```
design/
  README.md                 this file
  screens/                  PNG of every screen (iOS at 2×, web at 1440 px wide)
  prototype/                clickable HTML prototypes, one file per screen
    index.html              gallery — open this first
    assets/                 React 18, the Kadulja component bundle, tokens.css, logo, renderer
  source/
    *.dc.html               original artboard sources from the canvas (markup + inline styles)
    canvas.json             canvas layout (artboard sizes, pages iOS / Web)
    ds/tokens.json          design-system tokens (colours, type, spacing, radii)
    ds/tokens.css           the same tokens as CSS custom properties
    ds/README.md            design-system principles and rules
    ds/components/*.md      component docs with exact props (Button, Input, StatusChip, MemberRow, UpisnicaForm …)
```

### Opening the prototypes

Open `prototype/index.html` in a browser. Links and buttons between screens work, and filters, day pickers and form choices respond. Fonts (Cinzel, Montserrat, Cormorant Garamond) load from Google Fonts when online.

**Note:** the PNGs in `screens/` were rendered without network access, so they show fallback fonts (a system serif and sans). Layout, colours and sizes are exact. For type, trust the prototypes and the tokens.

## Screens

| Platform | Screen | Prototype | Size | Purpose |
|---|---|---|---|---|
| iOS | Pregled | `Main.html` | 390×844 | Today's class, attention list (expiring, unpaid) |
| iOS | Raspored | `Raspored.html` | 390×844 | Week day-picker, sessions with check-in |
| iOS | Vrste satova | `VrsteSatova.html` | 390×844 | Class-type templates (no date or time), "Zakaži" |
| iOS | Članovi | `Clanovi.html` | 390×844 | Search, status filters, member list |
| iOS | Profil člana | `Profil.html` | 390×1320 | Identity, health note, membership usage, contacts, visits, payments, form |
| iOS | Novi član | `NoviClan.html` | 390×844 | Choose: photograph the form, import PDF, enter manually |
| iOS | Provjera skenirane upisnice | `Skeniranje.html` | 390×1680 | Review recognised fields; flagged ones in terracotta; save |
| Web | Pregled | `WebPregled.html` | 1440 wide | Stats, today and tomorrow (ClassTable), "Za provjeru" |
| Web | Raspored | `WebRaspored.html` | 1440 wide | 7-day week grid, add session from class type |
| Web | Vrste satova | `WebVrsteSatova.html` | 1440 wide | Class-type table per group, "Nova skupina" for future services |
| Web | Članovi | `WebClanovi.html` | 1440 wide | Search, filter chips, MemberRow list |
| Web | Profil člana | `WebProfil.html` | 1440 wide | MemberProfile, MembershipCard, visits, payments, stored form |
| Web | Uvoz upisnice | `WebUvoz.html` | 1440 wide | Drop zone for PDF or image, manual entry |
| Web | Provjera podataka | `WebProvjera.html` | 1440 wide | Original page with flagged regions beside the pre-filled UpisnicaForm |

### Navigation

- **iOS**: bottom tab bar with Pregled · Raspored · **Upis** (raised centre button) · Članovi · Uplate.
- **Web**: ink sidebar with Pregled · Raspored · Vrste satova · Članovi · Karte i članarine · Uplate, and the HR/EN switch at the foot. In the prototypes the sidebar menu doesn't switch screens; use the in-page links.

### Not designed yet

Build these from the same components and tokens; don't invent new patterns.

- Login
- Uplate (payments)
- Karte i članarine (plans)
- Novi termin (new session) sheet or panel
- Session detail with attendee list

## How to use this when building

**Web**

- Port the components in `source/ds/components/*.md` with exactly those props.
- `prototype/assets/bundle.js` is the design system's own React implementation. Read it for exact styles, but rebuild the components as typed source in `apps/web` rather than shipping the bundle.

**iOS**

- Rebuild the same components in SwiftUI from `tokens.json`.
- Match the iOS PNGs and `source/*.dc.html` (inline styles give exact px values: 16 pt side margins, 10 pt card radius, 44 pt+ touch targets, 84 pt tab bar).

**Both**

- Copy, labels and formats in the screens are final Croatian wording, except sample data:
  - Sample data: names, counts, amounts, teacher "Mario", e-mail addresses.
  - Final wording: everything else, e.g. "Ističe za 3 dana", "Spremi člana", "Polja s terakota obrubom pročitajte prije spremanja."
- **Class colours are fixed per class type**: spine `#d6ded3`, ashtanga `#8a9a86`, restorative `#e6dacb`, black lotus `#c86d51`, pranayama `#2a322e`, workshop `#efd9cf`. Show them as a 10×22 pill beside the name.
- **Terracotta only means "look"**: unpaid, health, needs review, errors. **Amber only means "expiring".**

**Live canvas** (for Mario; requires his claude.ai login): https://claude.ai/code/artifact/14d8ea7b-3af4-440d-a97f-5c3aeee5dc90
