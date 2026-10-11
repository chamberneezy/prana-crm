# Prana CRM — iOS handoff

Owner: Mario · Prepared 11.10.2026. · For: Claude Code

> **How to use this file.** Put it in the repo at `docs/handoff-ios.md` (next to `docs/handoff-web.md`, with the design export in `docs/design/`) and start Claude Code with the kickoff prompt at the end. Part A is identical in both handoffs. Part B is iOS-only. The backend the app talks to is built from the web handoff.

---

# PART A — Shared foundation (identical in both handoffs)

## A1. Product

**Prana CRM** is the management app for Prana Yoga Studio. Today one person (Mario, the owner) runs a single studio. Soon it will be a wellness business with more locations, staff and services (massage, workshops, retreats).

**Rule: build minimal now, but never hard-code "yoga" or "one studio" into the data model.**

### v1 jobs

1. **Members**: list, search, filter by membership status, profile, health note.
2. **Enrol from the paper form (upisnica)**: the iOS app takes a photo or imports a PDF, the web imports a PDF or image. The app recognises the fields, the owner reviews them and saves. The original file is stored with the member.
3. **Class types**: templates with no date or time. Sessions are scheduled from them, and visits are checked in per session.
4. **Memberships**: 1× / 2× / 3× tjedno (≈ 4 / 8 / 12 visits a month) and Neograničeno, with visits counted per month. Payments are recorded by hand (cash, card or bank transfer); no payment processing.
5. **Overview**: today's sessions, expiring memberships, unpaid items.

### Not in v1

Member self-booking, online payments, multi-location UI, staff-roles UI, sending emails or push notifications, Android.

## A2. Decisions log

| Topic | Decision | Why / rejected alternatives |
|---|---|---|
| Code | One GitHub monorepo | One person, one place. |
| Platforms | Native iOS app (SwiftUI) + web app (React + Vite + TypeScript) | iOS gives the best camera and on-device text recognition; the web is for desk work. |
| API | One **Cloudflare Worker** (TypeScript, Hono). It is the only thing that talks to the database. | Both apps share one contract. Business rules live in one place. |
| Database | **Cloudflare D1** (SQLite), EU location | Free plan (10 DBs, 500 MB each, 5 GB per account) covers this and Mario's other projects. **Rejected:** Supabase (2 free projects, paused after 1 week idle, Pro $25/month); GitHub as a database (health data in git history, write conflicts, rate limits); iCloud-only sync (the web would need an Apple ID). |
| Files | **Cloudflare R2**, private bucket, EU jurisdiction | Stores the scanned upisnica files. Never public URLs. |
| Logins | **Firebase Authentication** in a **new, dedicated Firebase project** (`prana-crm`). Providers: Sign in with Apple, Google, e-mail/password. | Mario already uses Firebase. D1 has no users built in. Free for these providers (SMS login costs money, so it isn't used). |
| Access | The Worker verifies the Firebase ID token, then checks a **staff allowlist** in D1. v1 has one row: Mario, role `owner`. | Signing in to Firebase alone grants nothing. |
| Web hosting | Cloudflare (Workers static assets or Pages), deployed from GitHub | Same account, zero cost. |
| Text recognition | **On device / in browser only.** iOS: Apple Vision. Web: pdf.js text layer, else tesseract.js with Croatian (`hrv`). | Member data and health notes never go to third-party OCR services. |
| Offline | iOS keeps a local copy and syncs. The web is online-only. | The studio may have weak Wi-Fi. |
| Language | Croatian first, English as a switch | Brand rule. |
| Design | Kadulja design system ("Yoga CRM") | See A7. |
| Cost target | 0 €/month at studio scale | The Apple Developer Program (yearly fee) is needed for TestFlight, the App Store and Sign in with Apple. |

### Current status

- **Mario has no Cloudflare account yet.** Develop everything locally with `wrangler dev` (local D1 and R2 through Miniflare). Deployment is the last milestone.
- **The Firebase project is not created yet.** Use the Firebase Auth emulator locally until it exists.
- All secrets and IDs come from environment variables. Never commit them.

## A3. Repo layout

```
prana-crm/
  api/                  Cloudflare Worker (Hono), D1 migrations, seed, wrangler.toml
  apps/web/             React + Vite + TS
  apps/ios/             Xcode project (SwiftUI)
  packages/shared/      TS types, zod schemas, upisnica parser (TS), i18n strings (hr/en JSON)
  fixtures/upisnica/    OCR line dumps + expected JSON, used by BOTH parsers' tests
  docs/                 handoff-web.md, handoff-ios.md, adr/
  .github/workflows/    CI: typecheck, lint, test (web/api); build + test (iOS, macOS runner)
```

## A4. Data model (D1 / SQLite)

### Conventions

- **IDs**: text UUIDv7.
- **Business scope**: every business table has `business_id`.
- **Timestamps**: `created_at` and `updated_at` (ISO 8601 UTC), plus `deleted_at` for soft delete, which sync needs.
- **Money**: integer cents plus `currency` (`'EUR'`).
- **Times**: stored as UTC ISO and shown in `Europe/Zagreb`.

| Table | Columns |
|---|---|
| `business` | id, name, locale (`hr`), timezone (`Europe/Zagreb`) |
| `location` | id, business_id, name. One row in v1. |
| `staff` | id, business_id, firebase_uid (null until first login), email, name, role (`owner` \| `teacher` \| `front_desk`) |
| `offering_group` | id, business_id, name, sort. v1: `Joga`. |
| `offering` (class type) | id, business_id, group_id, name, color_token, default_duration_min, entry_rule (null), default_capacity (null), active |
| `session` | id, business_id, location_id, offering_id, starts_at, ends_at, teacher_staff_id (null), capacity (null), note |
| `member` | id, business_id, full_name, email, phone, dob, is_student_or_retired, health_flag, health_text, consent_accuracy, consent_news, signed_place, signed_date, member_since, notes |
| `plan` | id, business_id, code (`1x` \| `2x` \| `3x` \| `unl` \| `trial`), name, visits_per_month (null = unlimited), price_cents (null) |
| `membership` | id, business_id, member_id, plan_id, period_start, period_end, frozen_until (null) |
| `visit` | id, business_id, member_id, session_id, membership_id (null), checked_in_at |
| `payment` | id, business_id, member_id, membership_id (null), amount_cents, currency, method (`cash` \| `card` \| `transfer`), paid_at, note |
| `document` | id, business_id, member_id (null until saved), kind (`upisnica`), r2_key, mime, source (`camera` \| `pdf` \| `image`), ocr_json, created_by |

### Member status

Status is derived in the API and nowhere else. Both apps only display it. Rules are checked in priority order:

| Priority | Status | Rule |
|---|---|---|
| 1 | `frozen` | `frozen_until` ≥ today |
| 2 | `unpaid` | the current membership's payments are below the plan price, or there are none when a price is set |
| 3 | `expiring` | `period_end` is within 7 days. The label says "Ističe za N dana". |
| 4 | `trial` | plan code `trial` |
| 5 | `active` | otherwise |
| — | `none` | the member has no current membership |

### Seed (production)

**Business** "Prana Yoga Studio", one location, offering group "Joga".

**Offerings.** These are the studio's real classes, taken from its weekly schedule poster. Templates only: no day or time attached.

| Name | color_token | Duration | Entry rule |
|---|---|---|---|
| Joga za kralježnicu | `class-spine` | 60 | — |
| Ashtanga Mysore | `class-ashtanga` | 120 | Ulaz do 60 min nakon početka |
| Restorativna joga | `class-restorative` | 60 | — |
| Black Lotus Yoga | `class-black-lotus` | 75 | — |
| Pranayama & meditacija | `class-pranayama` | 30 | Slobodan ulaz |

**Plans:**

| Code | Visits per month |
|---|---|
| `1x` | 4 |
| `2x` | 8 |
| `3x` | 12 |
| `unl` | null (unlimited) |
| `trial` | 1 |

`price_cents` stays null until Mario provides prices.

### Seed (dev only)

**One sample week of sessions**, Mon–Sun:

| Day | Sessions |
|---|---|
| Mon | 09:00–10:00 Kralježnica · 17:00–19:00 Ashtanga |
| Tue | 19:15–20:15 Restorativna |
| Wed | 09:00–10:00 Kralježnica · 18:15–19:30 Black Lotus |
| Thu | 17:00–19:00 Ashtanga · 19:15–20:15 Restorativna |
| Fri | 18:15–19:30 Black Lotus · 19:45–20:15 Pranayama |
| Sat | — |
| Sun | 09:00–11:00 Ashtanga |

**Sample members** (Ana Horvat, Marko Kovač, …) with all five statuses represented. Dev only, never in production.

## A5. API contract (Worker, base `/api`)

### Authentication

Every request sends `Authorization: Bearer <Firebase ID token>`. The Worker:

1. Verifies the token (RS256) against Google's JWKS at `https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com`, using `jose`. It checks `aud` = `FIREBASE_PROJECT_ID`, `iss` = `https://securetoken.google.com/<FIREBASE_PROJECT_ID>`, and `exp`.
2. Loads the `staff` row by `firebase_uid`. On first login, it matches the verified e-mail and binds the uid.
3. Returns **403** if there's no staff row.
4. Scopes every query by the staff's `business_id`.

### Errors

`{ "error": { "code": "…", "message_hr": "…", "message_en": "…" } }`. Messages are plain Croatian, with no technical wording.

### Endpoints

| Area | Endpoints |
|---|---|
| Session | `GET /me` → staff and business |
| Dashboard | `GET /dashboard?date=` → today's and tomorrow's sessions, attention list, counts (active members, expiring this week, debts total, payments this month) |
| Members | `GET /members?q=&status=` · `GET /members/:id` (with current membership, last visits, payments, documents) · `POST /members` · `PATCH /members/:id` · `DELETE /members/:id` (soft delete; the R2 file is deleted too) |
| Class types | `GET /offering-groups` · `GET/POST/PATCH /offerings` |
| Sessions | `GET /sessions?from=&to=` · `POST /sessions` (from an offering: offering_id, starts_at; ends_at defaults from duration) · `PATCH /sessions/:id` · `DELETE /sessions/:id` |
| Visits | `POST /sessions/:id/visits {member_id}` (check-in) · `DELETE /visits/:id` |
| Memberships | `POST /memberships` · `POST /memberships/:id/renew` · `POST /memberships/:id/freeze {until}` |
| Payments | `GET /payments?from=&to=` · `POST /payments` |
| Documents | `POST /documents` (multipart, ≤ 20 MB; pdf, jpg, png, heic; stored at `{business_id}/documents/{id}`) · `GET /documents/:id/file` (streamed after the auth check) · `PATCH /documents/:id {member_id, ocr_json}` |
| Sync (iOS) | `GET /sync?since=<cursor>` → changed rows per table, including soft-deleted ones, plus a new cursor · `POST /sync {mutations:[…]}` → upserts. Last write wins by `updated_at`. Conflicts are returned for the client to log. |

Request and response schemas live in `packages/shared` as zod. Generate an OpenAPI document from them so the iOS side has a typed reference.

## A6. Upisnica recognition (shared spec)

Both platforms implement the same parser, the web in TS and iOS in Swift. Both must pass the same fixtures in `fixtures/upisnica/`.

### Output fields

These mirror the design system's `UpisnicaValue`:

```ts
{ name: string; email: string; phone: string; dob: string /* dd.mm.yyyy. */;
  student: boolean;            // "Student / umirovljenik?" NE/DA
  plan: '1x'|'2x'|'3x'|'unl';
  health: boolean; healthText: string;
  consent: boolean;            // accuracy consent: REQUIRED to save
  news: boolean;               // e-mail opt-in (GDPR, separate)
  place: string; date: string; signaturePresent: boolean;
  confidence: Record<field, number>; needsReview: field[] }
```

### Pipeline

1. **Get text lines** with bounding boxes and confidence. This step is platform-specific.
2. **Find label anchors.** Match fuzzily and ignore diacritics and case. The anchors are:
   - "Ime i prezime", "E-mail", "Broj mobitela", "Datum rođenja", "Student / umirovljenik"
   - "Odaberite članstvo" with "1× tjedno", "2× tjedno", "3× tjedno", "Neograničeno"
   - "Postoji li nešto što bi učitelj trebao znati", "Molimo navedite"
   - "Potvrđujem da su navedeni podaci točni", "Želim primati obavijesti"
   - "Mjesto i datum", "Potpis"
3. **Read values** to the right of or below each anchor. For checkboxes, choices and the plan, detect the ticked or circled option. Signature = ink present in the signature box.
4. **Normalise values:**
   - E-mail: lower-case.
   - Phone: Croatian format (`091 234 5678`).
   - Dates: `dd.mm.yyyy.`
   - Names: title case, keeping č ć š ž đ.
5. **Flag fields.** Add a field to `needsReview` if its OCR confidence is below 0.6, validation fails (e-mail, date, phone digit count), or a character is unreadable.

### Rules

- Never auto-save. Always show the review screen, with flagged fields marked in terracotta.
- Saving requires `consent = true` and a name.
- Store the original file in R2 and `ocr_json` on the document, for audit and later tuning.
- Don't translate member-written text. Only UI labels are localised.

The anchors come from the digital upisnica in the design system. **Confirm them against Mario's real paper form** (open item).

## A7. Design system — Kadulja ("Yoga CRM")

The design system's README describes it as "a calm desktop-first tool for members, the class schedule, memberships and payments". Sage leads, linen is the ground, ink carries the text, and terracotta is kept for whatever needs the owner's attention.

### Principles

- **Calm by default.** Sage and linen do the work.
- **Terracotta means "look".** Use it only for unpaid items, health notes, full classes, attention or destructive actions and errors. Never as decoration.
- **Amber means "expiring" only.**
- **Status = dot + word.** Never colour alone.
- **Class colour** shows as a 10×22 px pill (radius full) beside the class name. Never as a row fill.
- **Cards** are white with a 1 px `line` hairline and radius 10. **No shadows** (only toasts, menus and modals get `shadow-float`).
- **One primary button per view.** Primary is ink; its hover is sage-deep.
- **No** imagery, gradients, blur, emoji or bounce animations. Motion is quick colour transitions only.
- **Icons**: the system has none. Use **Lucide at 1.5 px stroke**.
- **Logo**: the Prana mark (`prana-mark.png`, 135×120, charcoal and copper). On ink grounds, invert it with `filter: brightness(0) invert(0.9)`. Never redraw it. Mario provides the file.

### Copy

- Croatian first. Address members with the formal **Vi**; be direct with the owner ("Ističe za 3 dana").
- Sentence case, no exclamation marks, no alarm or technical words.
- Formats: money **65,00 €**, dates **dd.mm.yyyy.** (with the trailing dot), times **18:15–19:30** (en dash). Use tabular numbers for money, dates and counts.
- Domain words: član, članarina, karta, upisnica, sat, raspored, uplata, učitelj.
- Empty states: "Još nema uplata", not "Nema podataka".
- Size every component for Croatian labels, which run about 25% longer than English.

### Tokens

```css
:root {
  --sage:#8a9a86; --ink:#2a322e; --linen:#f4efea; --sand:#e6dacb; --terracotta:#c86d51;
  --sage-deep:#5c6b58; --sage-ink:#3f4b3d; --mist:#e5eae2; --mist-strong:#dce3d8;
  --ink-muted:#535c55; --muted:#6a7268; --clay-deep:#a9553c; --clay-text:#8c3f28; --blush:#f2d8cd;
  --white:#ffffff; --hover:#f8f5f1; --header-row:#ede9e2; --line:#e3dcd2; --line-soft:#ece6de; --field:#d3d6cc;
  --amber-bg:#f6ead2; --amber-fg:#6b4a12; --amber-dot:#c08a2e; --stone-bg:#e8e6e0; --stone-dot:#9a9f98;
  --class-spine:#d6ded3; --class-restorative:#e6dacb; --class-ashtanga:#8a9a86;
  --class-black-lotus:#c86d51; --class-pranayama:#2a322e; --class-workshop:#efd9cf;
  /* semantic */
  --bg-app:var(--linen); --bg-sidebar:var(--ink); --surface-card:var(--white); --surface-hover:var(--hover);
  --surface-selected:var(--mist); --surface-readonly:var(--hover);
  --text-1:var(--ink); --text-2:var(--ink-muted); --text-3:var(--muted); --text-on-dark:var(--mist-strong); --text-attention:var(--clay-text);
  --border-card:var(--line); --border-divider:var(--line-soft); --border-field:var(--field); --border-focus:var(--sage-deep); --focus-ring:var(--mist-strong);
  --primary:var(--ink); --primary-hover:var(--sage-deep); --accent-attention:var(--terracotta); --bg-attention:var(--blush);
  --status-active-bg:var(--mist-strong); --status-active-fg:var(--sage-ink); --status-active-dot:var(--sage-deep);
  --status-expiring-bg:var(--amber-bg); --status-expiring-fg:var(--amber-fg); --status-expiring-dot:var(--amber-dot);
  --status-unpaid-bg:var(--blush); --status-unpaid-fg:var(--clay-text); --status-unpaid-dot:var(--terracotta);
  --status-frozen-bg:var(--stone-bg); --status-frozen-fg:var(--ink-muted); --status-frozen-dot:var(--stone-dot);
  --status-trial-bg:var(--white); --status-trial-fg:var(--sage-ink); /* dashed 1px sage outline, no dot */
  --font-display:"Cinzel", Georgia, serif; --font-ui:"Montserrat", system-ui, sans-serif; --font-signature:"Cormorant Garamond", Georgia, serif;
  --space-1:4px; --space-2:8px; --space-3:12px; --space-4:16px; --space-5:20px; --space-6:24px; --space-8:32px; --space-12:48px;
  --radius-xs:4px; --radius-sm:6px; --radius-md:8px; --radius-lg:10px; --radius-full:999px;
  --shadow-float:0 12px 32px rgba(42,50,46,.14), 0 0 0 1px #e3dcd2;
  --control-height:40px; --control-height-compact:36px; --row-pad:12px; --row-pad-compact:8px; --sidebar-width:200px;
  --tracking-overline:.2em; --tracking-table-head:.16em;
}
```

### Type

| Style | Font | Size / weight | Use |
|---|---|---|---|
| page-title | Cinzel | 28 / 600 | Page titles only |
| card-title | Cinzel | 22 / 600 | Card and profile titles only |
| metric | Montserrat | 26 / 600, tabular | Dashboard numbers |
| heading | Montserrat | 16 / 600 | Section and table headings |
| body | Montserrat | 14 / 400 (line height 1.6) | Default text |
| small | Montserrat | 13 | Helper text |
| label | Montserrat | 12 / 600 | Field labels, chips |
| overline | Montserrat | 11 / 600, uppercase, 0.2em tracking (table heads 0.16em) | Overlines, table heads |
| signature | Cormorant Garamond | 26 / 500 italic | Upisnica signature line only |

All three fonts are on Google Fonts (OFL licence).

### Spacing, controls and states

- **Spacing**: 4 px grid. Card padding 24 (20 on small cards).
- **Controls**: 40 px high (36 compact). On phones, touch targets are at least 44 px.
- **Focus**: `sage-deep` border plus a 3 px `focus-ring` (mist-strong).
- **Errors**: `terracotta` border plus a 3 px `blush` ring, with the message in `clay-text`.
- **Disabled**: 40% opacity.
- **Contrast caveat**: `text-3` drops below 4.5:1 on linen and on the table header row. Keep small tertiary text on white.

### Status chip labels

| Status | Label |
|---|---|
| active | Aktivna |
| expiring | Ističe uskoro (or "Ističe za N dana") |
| unpaid | Neplaćeno |
| frozen | Zamrznuta |
| trial | Proba |

### Visual references

- **The design handoff `docs/design/`** is the visual source of truth for every screen. It contains:
  - PNGs of all screens.
  - Clickable HTML prototypes (`docs/design/prototype/index.html`).
  - The artboard sources.
  - The design-system tokens and component docs with exact props.

  Read `docs/design/README.md` before building any screen.
- **Live canvas** (Mario's login only): https://claude.ai/code/artifact/14d8ea7b-3af4-440d-a97f-5c3aeee5dc90
- **Design system** (Mario's login only): https://claude.ai/code/artifact/a69f0341-7dd7-4cb2-b840-5e99fb350ea8

All names, numbers and teachers in the designs are sample data.

## A8. Privacy and security

Health notes are sensitive personal data (GDPR special category). Mario should confirm his own legal obligations; this list isn't legal advice.

- Keep D1 and R2 in the EU.
- Only allowlisted staff can read data.
- Never log member names, contacts or health text.
- Documents are served only through the authenticated endpoint.
- Deleting a member deletes their document files.
- The newsletter consent stays separate from the accuracy consent.

## A9. Open items for Mario

1. **Cloudflare**: create the account. Then `wrangler login`, create a D1 database in the EU and an R2 bucket with EU jurisdiction, and add the IDs to `wrangler.toml` and the GitHub secrets.
2. **Firebase**: create the project `prana-crm`. Enable Apple, Google and Email/Password. Register the iOS app (bundle ID) and the web app. Hand over the project ID and the web config.
3. **Apple Developer Program membership**, needed for TestFlight and Sign in with Apple.
4. **Studio details**: plan prices, teacher names, class capacities.
5. **Sample forms**: 3–5 photos or scans of filled-in upisnice (dummy data or with consent) to build `fixtures/upisnica/`, plus one blank form to confirm the anchor labels.
6. **Logo**: provide `prana-mark.png`.
7. **Domain** (optional), e.g. `crm.<studio-domain>`.

---

# PART B — iOS app

## B1. Scope of this handoff

- **This handoff covers `apps/ios/` only.** The backend (`api/`) and `packages/shared/` are built from `docs/handoff-web.md`.
- **If the API isn't ready**, code against repository protocols with an in-memory or mock implementation first. Then point at the local `wrangler dev` URL.
- **The upisnica parser** is rewritten in Swift, following spec A6. It must pass the same `fixtures/upisnica/` cases as the TypeScript version.

## B2. Stack

| Layer | Choice |
|---|---|
| Language and UI | Swift 6, SwiftUI, Observation. **iOS 17+**, iPhone only in v1, portrait. |
| Local store | SwiftData, mirroring the A4 tables the app uses: member, offering, session, plan, membership, visit, payment, document (metadata only; the file is cached on demand). |
| Network | URLSession + async/await, Codable models generated by hand from the shared OpenAPI document |
| Login | Firebase iOS SDK through Swift Package Manager, **FirebaseAuth only**. Sign in with Apple (AuthenticationServices), Google sign-in, e-mail/password. The ID token goes in `Authorization: Bearer`. Refresh it before it expires. |
| Camera scan | VisionKit `VNDocumentCameraViewController` (edge detection and de-skew) |
| Text recognition | Vision `VNRecognizeTextRequest`, `.accurate`. Use `recognitionLanguages = ["hr-HR"]` **only if** it appears in `supportedRecognitionLanguages()` at runtime; otherwise use Latin defaults with `customWords` (the A6 anchor labels) and a diacritic-restoring post-pass for known words. Always keep bounding boxes and confidence. |
| PDF import | `.fileImporter` (PDF, JPG, PNG, HEIC) and the share sheet. PDFKit: use the text layer if present, else render each page at 2× and run Vision on it. |
| Tests | XCTest for the parser (shared fixtures), sync engine (LWW, outbox replay), member-status display and formatters |
| Dependencies | **Only the Firebase packages.** Nothing else without asking. |

## B3. Architecture

- **Feature folders**: `Overview/`, `Schedule/`, `Offerings/`, `Members/`, `Enrolment/` (scan, import, review), `Payments/`, `Auth/`, `DesignSystem/`, `Sync/`, `Parser/`.
- **Repository protocols** (`MembersRepository`, `ScheduleRepository`, …) read from SwiftData. Writes go to SwiftData **and** an outbox.
- **Sync engine**:
  - Calls `GET /api/sync?since=` on launch, on return to the foreground, on pull-to-refresh, and after each mutation (debounced).
  - Replays the outbox with `POST /api/sync`. Last write wins by `updated_at`.
  - Shows a quiet line "Spremljeno na uređaju · sinkronizira se kad bude mreže" when offline. Never blocking alerts.
- **Member status** comes from the API (A4). The app only displays it, except when offline, where it shows the last synced value.
- **Document upload**: `POST /api/documents`, queued in the outbox when offline. Keep the local file until the upload succeeds.

## B4. Design system in SwiftUI

- **`DesignSystem/Tokens.swift`**: every colour from A7 as `Color` (hex init), plus spacing, radii and the type styles.
- **Fonts**: bundle Cinzel (600), Montserrat (400/500/600) and Cormorant Garamond (500 italic) from Google Fonts (OFL licence). Register them in Info.plist and expose them as `Font.dsPageTitle`, etc. Support Dynamic Type with `relativeTo:`.
- **Components** (SwiftUI equivalents of the design system set): `DSButton` (primary/secondary/ghost/attention), `DSInput` (label, error, hint, multiline), `DSCheckbox`, `DSChoice` (inline/grid), `Avatar`, `StatusChip`, `Tag`, `DSCard`, `Stat`, `ClassPill` (10×22), `VisitSegments`, `Notice`, `Toast`, `EmptyState`.
- **Phone rules**:
  - Touch targets ≥ 44 pt; primary actions 48–50 pt.
  - Page titles in Cinzel 28 on a linen ground. Content cards are white with hairlines.
  - No fake status bars, no shadows on cards.
  - Icons: SF Symbols at a light weight is acceptable as the native equivalent of Lucide 1.5 px; keep them thin and monochrome.

## B5. Navigation

A `TabView` with a custom tab bar: white, 1 px `line` top border, labels at 11 pt / 600, active in ink and inactive in `muted`.

| Tab | Content |
|---|---|
| Pregled | Overview |
| Raspored | Schedule; Vrste satova is pushed from it |
| **Upis** (centre) | A 56 pt ink circle with a scan icon, raised over the bar with a 4 pt linen ring. Opens **Novi član** as a full-screen sheet. |
| Članovi | Members; Profil is pushed from it |
| Uplate | Payments; not designed yet, v1 is a simple list by month with totals |

## B6. Screens

These match the artboards on the canvas's iOS page.

1. **Pregled (overview)**
   - Overline with today's date, Cinzel title "Pregled".
   - A 2-column Stat grid: Aktivni članovi · Uplate u <mjesec>.
   - Card "Danas": class pill, name, time and entry rule, and "N dolazaka". Tapping it opens Raspored on today.
   - Card "Za provjeru": expiring and unpaid members (Avatar 36, name, plan · visits or amount, StatusChip). Tapping a row opens Profil.
2. **Raspored (schedule)**
   - Overline "Tjedan 12.–18.10.", title, and a small primary "Novi termin" button.
   - A row link "Vrste satova · 5 predložaka ›".
   - A 7-day strip (Pon–Ned) with a dot on days that have sessions. The selected day is an ink fill with white text.
   - Day heading, then one card per session: pill, name, time · entry rule, "N prijava", and a secondary "Evidentiraj dolazak" button (opens member search and checks the member in).
   - Empty day: "Nema satova · Dodajte termin iz vrsta satova."
   - Swipe left/right changes the week.
3. **Vrste satova (class types)**
   - "‹ Raspored" back, title, helper "Predlošci za planiranje. Dan i vrijeme birate tek kad dodajete termin."
   - A card per group (header-row strip "JOGA · 5"). Rows: pill, name, Tags (duration as neutral, entry rule as flag), and "Zakaži ›", which opens Novi termin pre-filled.
   - Secondary "+ Nova vrsta sata". Footnote about future groups.
4. **Članovi (members)**
   - Overline with the count ("8 članova"), title, and a small primary "Novi član" (opens the sheet).
   - Search field ("Ime, e-mail ili telefon").
   - Horizontal filter chips with counts: Svi · Aktivni · Ističu · Neplaćeno · Proba · Zamrznuti.
   - A list card of rows: Avatar, name, "plan · used/total dolazaka", StatusChip.
5. **Profil člana (member profile)**
   - "‹ Članovi" back, ghost "Uredi".
   - Identity card: Avatar 56, name in Cinzel 22, "Članica od dd.mm.yyyy.", then StatusChip, plan Tag and Student flag Tag.
   - A blush health block, shown **only if health_flag is set**: "Zdravstvena napomena" in clay-text, then the text.
   - "Članarina" card: plan · month, "6/8", 8 segments, "Vrijedi do …" (amber if expiring), and the primary "Produži članarinu".
   - Cards: "Kontakt" (e-mail and phone open mail/call; date of birth with age), "Zadnji dolasci", "Uplate", and "Upisnica" (opens the stored file in QuickLook, plus consent ticks ✓/○).
6. **Novi član (new member, full-screen sheet)**
   - "Odustani", Cinzel "Novi član", "Kako želite upisati člana?"
   - Three option cards:
     - **Fotografiraj upisnicu**: ink card, primary. Opens the VisionKit scanner.
     - **Uvezi PDF**: opens the file importer.
     - **Upiši ručno**: opens an empty review form.
   - A tips card: "Položite upisnicu na ravnu, tamniju podlogu. Neka cijeli list stane u kadar. Dnevno svjetlo, bez sjene preko teksta."
   - Footnote: "Prepoznavanje teksta radi na Vašem iPhoneu. Podaci ne odlaze na vanjske servere."
7. **Provjerite podatke (check the data)**
   - "‹ Natrag" and "Ponovi snimanje".
   - Summary card: page thumbnail, "Upisnica prepoznata", "N polja sigurno · M za provjeru", and a sage/terracotta proportion bar.
   - Sections in this order:

     | Section | Contents |
     |---|---|
     | Osobni podaci | Ime i prezime, E-mail, Telefon, Datum rođenja |
     | Student / umirovljenik? | NE / DA |
     | Članarina | Choice grid with 2 columns: 1×/2×/3× tjedno with "≈ 4/8/12 dolazaka mjesečno", Neograničeno |
     | Zdravstvene poteškoće | NE / DA, then a multiline field when DA |
     | Privole | Accuracy consent (required) and e-mail opt-in |
     | Mjesto i datum, Potpis | Mjesto i datum (read-only) and the signature box in Cormorant italic with "Potpis pronađen na upisnici." |

   - Flagged fields use the error state with plain Croatian messages, e.g. "Jedna znamenka nije čitljiva. Provjerite broj." or "Rukopis je nejasan. Provjerite tekst."
   - Sticky bottom bar with the primary "Spremi člana" (disabled until consent and name) and "Snimka upisnice sprema se uz profil."
   - After saving: dismiss the sheet, show a Toast "<Ime> je spremljen/a." with "Poništi", and open Profil.

**Permissions** (Info.plist, Croatian): `NSCameraUsageDescription` = "Kamera se koristi za fotografiranje upisnice. Tekst se prepoznaje na Vašem iPhoneu."

**Login screen** (not drawn): linen ground, logo, Cinzel "Prijava", Sign in with Apple (system button), "Nastavi s Googleom", then e-mail and password. An account that isn't allowlisted sees: "Ovaj račun nema pristup studiju."

## B7. Milestones and acceptance criteria

| # | Milestone | Done when |
|---|---|---|
| I0 | Xcode project in `apps/ios`, CI build on macOS runner, DesignSystem module with a preview catalogue | All components render in SwiftUI previews with each variant. |
| I1 | Parser in Swift with tests on the shared fixtures | All `fixtures/upisnica` cases pass, matching the TS parser's output. |
| I2 | Scan and import pipeline: VisionKit camera, PDF/image import, Vision OCR, review screen, save locally | A real paper form → review with flags → member saved on the device. Works in airplane mode. |
| I3 | Login (Firebase) and sync engine against local `wrangler dev` | A member created offline appears in the web app after reconnecting. Edits from the web appear on the phone. |
| I4 | Pregled, Raspored, Vrste satova, Članovi, Profil, check-in, renew membership, record payment | All flows in B6 work against the API. Status chips match the web. |
| I5 | TestFlight build (needs Apple Developer membership and the production Firebase and API) | Mario installs it from TestFlight and enrols a real member. |

## B8. Kickoff prompt for Claude Code

```
Read docs/handoff-ios.md and docs/design/README.md fully. It is the source of truth; Part A is shared with the web app and
backend (built from docs/handoff-web.md). Work milestone by milestone (I0 → I5). Before each
milestone, list the files you will create and ask me to confirm. Keep it minimal: SwiftUI + SwiftData
+ Vision/VisionKit/PDFKit + FirebaseAuth only. Until the API exists, code against repository
protocols with a mock. Croatian UI first (String Catalog), English second.
Start with I0, then I1 (the parser), because scanning the upisnica is the core feature.
```
