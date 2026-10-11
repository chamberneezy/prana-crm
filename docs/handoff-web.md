# Prana CRM — Web handoff (web app + shared backend)

Owner: Mario · Prepared 11.10.2026. · For: Claude Code

> **How to use this file.** Put it in the repo at `docs/handoff-web.md` (next to `docs/handoff-ios.md`, with the design export in `docs/design/`) and start Claude Code with the kickoff prompt at the end. Part A is identical in both handoffs. Part B is web-only. This handoff also owns the **backend** (`api/`) and the **shared package** (`packages/shared/`), which the iOS app consumes, so build this one first.

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

# PART B — Web app + backend

## B1. Scope of this handoff

1. **`api/`**: the Worker, D1 schema and migrations, seed, auth middleware, all endpoints in A5, R2 documents.
2. **`packages/shared/`**: zod schemas and types, member-status logic (tested), the upisnica parser (TS), i18n dictionaries (`hr.json`, `en.json`), and formatting helpers (money, dates, time ranges).
3. **`apps/web/`**: the web app below.
4. **CI**: GitHub Actions for typecheck, lint and tests. The deploy job runs only once Cloudflare secrets exist.

## B2. Stack

| Layer | Choice |
|---|---|
| API | Hono on Cloudflare Workers · Drizzle ORM (D1) with SQL migrations through `wrangler d1 migrations` · zod · `jose` for verifying Firebase tokens |
| Web | React 18 · Vite · TypeScript (strict) · React Router · TanStack Query |
| Login (web) | Firebase JS SDK, **Auth module only** |
| Styling | Plain CSS with the tokens in A7 (`tokens.css`) and CSS modules. **No UI kit.** |
| PDFs and OCR | `pdfjs-dist` reads the text layer. For scanned PDFs and images, `tesseract.js` with the `hrv` language, lazy-loaded in a Web Worker. |
| Tests | Vitest for shared, API and web logic. Playwright for 3 smoke flows: login with the emulator, add a member manually, import a PDF and save. |

## B3. Components to build (port of the design system's React set)

Implement these as local React components with exactly these props, so screens match the design system:

| Component | Props |
|---|---|
| `Button` | variant `primary`\|`secondary`\|`ghost`\|`attention`, size `md`(40)\|`sm`(32), disabled |
| `Input` | label, value, onChange, placeholder, error, hint, readOnly, multiline, rows, type |
| `Checkbox` | checked, onChange, required (appends "Obavezno."), invalid, children |
| `Choice` | options `[{value,label,sub?}]`, value, onChange, layout `inline`\|`grid`, columns |
| `LangSwitch` | value `HR`\|`EN`, onChange, dark |
| `Avatar` | name, size (36 in lists, 52 on profile); initials on mist-strong |
| `StatusChip` | status, children (overrides the label) |
| `Tag` | kind `plan`(ink)\|`flag`(dashed sage)\|`health`(blush)\|`neutral`(mist) |
| `Card` | padding, title, overline |
| `Stat` | label, value, attention (clay) |
| `MembershipCard` | plan, used, total (0 = unlimited), renewal (dd.mm., amber "Obnova" chip), period. Segmented bar: sage = used, mist = left. |
| `MemberRow` | name, sub, note (health Tag), status, statusLabel, compact, onClick. Stack inside a Card with padding 0. |
| `ClassTable` | date, classes `[{time,title,color,teacher,booked,capacity,waitlist?}]`. Capacity bar turns terracotta when full. |
| `Toast` | children, action, onAction. Ink, with a sage dot. |
| `Notice` | title, children. Blush block. |
| `EmptyState` | title (Cinzel 17), children, action |
| `Sidebar` | items, active, onSelect, logoSrc, lang, onLang. Ink, 200 px, LangSwitch at the foot. |
| `PageHeader` | title (Cinzel 28), children (actions on the right) |
| `UpisnicaForm` | initial, place, date, onChange, onSave (only when consent is ticked and a name is given), onCancel |
| `MemberProfile` | member (UpisnicaValue), status, since, onEdit |

### UpisnicaForm sections

Sections are numbered as on the paper form:

- **01 Vaši podaci**: name (full width), e-mail, mobile, date of birth, "Student / umirovljenik?" NE/DA.
- **02 Odaberite članstvo**: Choice grid with 2 columns. Plan subtitles: "≈ 4 / 8 / 12 dolazaka mjesečno".
- **03 Važno za vašu praksu**: Ne / "Da, molimo navedite", then a multiline field. Helper text: "Vidi ga samo učitelj na popisu sata."
- **04 Suglasnosti**: accuracy consent (required) and newsletter opt-in.
- **Footer**: "Mjesto i datum" (read-only) and the signature box in Cormorant italic.
- **Actions**: "Spremi člana" (primary, disabled until consent) and "Odustani" (ghost).

## B4. App shell

- **Desktop**: an ink `Sidebar` (logo inverted). Items: **Pregled, Raspored, Vrste satova, Članovi, Karte i članarine, Uplate**, with the HR/EN switch at the foot.
- **Workspace**: linen. Content max-width 1160 px, padding 32 px top and 48 px sides.
- **Below 768 px**: the sidebar becomes a top bar with a menu button. Wide tables scroll horizontally inside their card.
- **Login screen** (not drawn; build from tokens):
  - Linen ground, centred white card with the logo and a Cinzel title "Prijava".
  - Buttons "Nastavi s Appleom" and "Nastavi s Googleom" (secondary), then e-mail and password with "Prijava" (primary).
  - An account that isn't on the allowlist sees: "Ovaj račun nema pristup studiju."

## B5. Screens

These match the artboards on the canvas's Web page.

1. **Pregled (overview)**
   - Overline with today's date ("Nedjelja, 11.10.2026."). PageHeader "Pregled" with the primary "Novi član" button (goes to Uvoz).
   - Four `Stat` cards: Aktivni članovi · Ističu ovaj tjedan · Dugovanja (attention) · Uplate u <mjesec>.
   - Left: `ClassTable` "Danas · …" and "Sutra · …", with a "Cijeli raspored ›" link.
   - Right: a "Za provjeru" card with a `Notice` for unpaid totals and `MemberRow`s for expiring and unpaid members (each opens Profil).
2. **Raspored (schedule)**
   - PageHeader with week navigation ‹ 12.–18.10.2026. › and the primary "Novi termin" button.
   - A 7-column week grid (Pon–Ned) with a header-row strip and date per day. Each session card shows the class pill, time, name and "ulaz do … · N prijava". Below 980 px the grid scrolls horizontally.
   - Clicking a session opens a side panel: details, attendee list, "Evidentiraj dolazak" (search a member and check in), edit and delete.
   - Bottom card "Dodaj termin iz vrste sata": one button per offering, which opens Novi termin pre-filled (offering, duration). The user picks date, time, teacher and capacity.
3. **Vrste satova (class types)**
   - PageHeader with the primary "Nova vrsta sata" button. Helper text: "Predlošci za planiranje. Dan i vrijeme birate tek kad dodajete termin u raspored."
   - One card per offering group ("Joga · 5 vrsta"). Table columns: Sat (pill + name) · Trajanje · Ulaz · Termina ovaj tjedan · actions "Zakaži" and "Uredi".
   - A dashed card with an EmptyState "Nova skupina" and "Dodaj skupinu" (for future massage, workshops and retreats).
   - The create/edit form has: name, group, colour (one of the `class-*` tokens), default duration, entry rule, default capacity, active.
4. **Članovi (members)**
   - PageHeader with a search field ("Ime, e-mail ili telefon") and the primary "Novi član" button.
   - Filter chips with counts: Svi · Aktivni · Ističu · Neplaćeno · Proba · Zamrznuti.
   - A card with a header row (count + "Stanje") and a `MemberRow` per member. The sub-line is "<plan> · <used>/<total> dolazaka · zadnji dolazak dd.mm."; a health note shows as a Tag.
5. **Profil člana (member profile)**
   - "‹ Članovi" back link, then two columns.
   - Left: `MemberProfile` (Uredi opens UpisnicaForm in edit mode) and an "Upisnica" card with the file name, import date and "Otvori".
   - Right: "Članarina · <mjesec>" with `MembershipCard`, the primary "Produži članarinu" and secondary "Zamrzni"; then "Zadnji dolasci" (class pill, name, date) and "Uplate" (date · plan · method · amount).
   - A "Zabilježi uplatu" action goes on the Uplate card as a secondary button.
6. **Uvoz upisnice (import a form)**
   - PageHeader "Novi član" with "Uvezite ispunjenu upisnicu. Polja se popune sama, a Vi samo provjerite."
   - A dashed sage drop zone: "Povucite PDF upisnice ovamo", "PDF, JPG ili PNG · do 20 MB · jedna upisnica po datoteci", and the primary "Odaberite datoteku".
   - Below: "Upiši ručno" (opens an empty UpisnicaForm) and an info card pointing paper forms to the iPhone app.
   - Footer: "PDF s tekstom čita se izravno. Skenirani PDF i fotografije prepoznaju se u pregledniku…"
   - While processing, show progress steps "Učitavanje · Čitanje teksta · Popunjavanje polja". OCR runs in a Web Worker.
7. **Provjerite podatke (check the data)**
   - Two columns. Left: the original page rendered with pdf.js or as the image, with `needsReview` regions outlined in terracotta over a blush fill, and a legend (Za provjeru / Prepoznato sigurno).
   - Right: a `Notice` "N polja za provjeru: …" and `UpisnicaForm` pre-filled with flagged fields in the error state.
   - On save: create the member and the document link (PATCH the document with member_id and ocr_json). Show the Toast "<Ime> je spremljen/a kao novi član." with "Poništi", plus an "Otvori profil ›" link.

**Karte i članarine** and **Uplate** aren't designed yet. v1 is simple lists built from the same components: plans with prices; payments by month with totals. No new patterns.

## B6. Milestones and acceptance criteria

| # | Milestone | Done when |
|---|---|---|
| M0 | Monorepo scaffold, CI, tokens.css, component library with a demo page | CI is green. Every component in B3 renders with each variant. |
| M1 | API: schema, migrations, seed, auth middleware, all A5 endpoints, member-status logic | `wrangler dev` runs locally. Status logic is unit-tested (all 6 states). An invalid or unknown token returns 401/403. |
| M2 | Web shell, login (emulator), Članovi, Profil, manual Novi član | Can sign in, add a member manually, filter and search, open a profile. |
| M3 | Vrste satova, Raspored, sessions from offerings, check-in | Can create a session from a class type and check a member in. The visit counts toward the membership. |
| M4 | Memberships, payments, Pregled | Overview numbers match the API. Expiring and unpaid members appear in "Za provjeru". |
| M5 | PDF/image import, OCR, parser, review, save with document | All `fixtures/upisnica` cases pass. Flagged fields are outlined. Nothing saves without consent. |
| M6 | Deploy to Cloudflare (blocked until Mario creates the account), production Firebase | Live URL. Production D1 and R2 are in the EU. Seed has no sample members. |

## B7. Kickoff prompt for Claude Code

```
Read docs/handoff-web.md and docs/design/README.md fully. It is the source of truth; Part A is shared with the iOS app.
Work milestone by milestone (M0 → M6). Before each milestone, list the files you will create and
ask me to confirm. Keep everything minimal: no extra libraries beyond B2 without asking.
I don't have a Cloudflare account yet, so everything must run locally with `wrangler dev` and the
Firebase Auth emulator. Never commit secrets. Croatian UI first, English via i18n.
Start with M0.
```
