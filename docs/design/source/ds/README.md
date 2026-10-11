Kadulja (sage) is the design system for the Prana Yoga Studio owner's CRM, a calm desktop-first tool for members, the class schedule, memberships and payments. Sage leads, linen is the ground, ink carries the text, and terracotta is kept for whatever needs the owner's attention.

## Principles

- **Calm by default.** `sage` and `linen` do the work and nothing shouts. If everything looks quiet, everything is fine.
- **Terracotta means "look".** Use `terracotta`, `clay-text` and `blush` only for unpaid items, health notes, full classes and attention or destructive actions. Never decorate with them.
- **Scan, don't read.** Use tabular numbers, aligned columns and short status chips, so visits, euros and dates line up.
- **Croatian first.** Size every component for HR labels, which run about 25% longer. English is a switch (`LangSwitch`), not a rebuild.

## Content fundamentals

- Write Croatian first and keep it warm, plain and short. Address members with the formal **Vi** ("Molimo navedite", "Drago nam je što nam se pridružujete"). Be direct with the owner ("Ističe za 3 dana").
- Use sentence case and no exclamation marks. Never use alarm words or technical errors.

| Write | Not |
| --- | --- |
| Ističe za 3 dana | UPOZORENJE: članarina ističe! |
| Ana Horvat je spremljena. | Operacija uspješno izvršena. |
| Još nema uplata | Nema podataka (0 rezultata) |
| Unesite ispravnu e-mail adresu. | Greška 422: nevaljan unos |

- Formats: money **65,00 €** (comma decimals, € after the amount), dates **dd.mm.yyyy.** with the trailing dot, times **18:15–19:30** with an en dash.
- Keep domain words consistent: *član, članarina, karta, upisnica, sat, raspored, uplata, učitelj*.
- Plans come from the paper upisnica: **1× / 2× / 3× tjedno** (≈ 4 / 8 / 12 visits a month) and **Neograničeno**. Count visits per month.
- No emoji. ✓ and ○ appear only as consent markers.

## Visual foundations

### Colour

- Set the app on `bg-app` (`linen`), put content on `surface-card` (`white`), and set text in `text-1` (`ink`), `text-2` (`ink-muted`) and `text-3` (`muted`).
- Use `ink` for the one primary button per view and for the sidebar (`bg-sidebar`). Its hover is `sage-deep`.
- Selection and focus are sage: `surface-selected` (`mist`), `border-focus` (`sage-deep`) plus a 3px `focus-ring` (`mist-strong`).
- Attention is terracotta: `accent-attention` for borders, dots and bars, `text-attention` (`clay-text`) for words and `bg-attention` (`blush`) for blocks.
- `amber-bg` / `amber-fg` / `amber-dot` is the only added hue, and it means "expiring" only.
- Membership states always pair a dot with a word: `status-active-*` (sage), `status-expiring-*` (amber), `status-unpaid-*` (blush/terracotta), `status-frozen-*` (stone) and `status-trial-*` (white with a dashed `sage` outline).
- Each class type has one colour (`class-spine`, `class-restorative`, `class-ashtanga`, `class-black-lotus`, `class-pranayama`, `class-workshop`). Show it as a 10×22px pill (`radius-full`) beside the class name, never as a row fill.
- Contrast: `text-3` reads 5:1 on white but only 4.36:1 on `linen` and 4.11:1 on `header-row`, so keep small tertiary text on white cards. The resting control border `field` is 1.5:1 on white. Both are kept as the source has them.

### Type

- **Cinzel 600** (`display`) is for page titles (`page-title`, 28px) and card titles (`card-title`, 22px) only.
- **Montserrat** (`ui`) covers all UI: `body` 14px, `small` 13px, `label` 12px/600, `heading` 16px/600 and `metric` 26px/600. Use `font-variant-numeric: tabular-nums` for money, dates and counts.
- Overlines and table heads are `overline` (11px/600, uppercase). Track overlines at `tracking-overline` (0.2em) and table heads at `tracking-table-head` (0.16em).
- **Cormorant Garamond italic** (`signature`) is for the upisnica signature line only.
- All three faces load from Google Fonts. Self-hosted files have not been provided.

### Space, shape and surfaces

- Work on a 4px grid (`space-1` … `space-12`). Card padding is `space-6` (24px), or `space-5` (20px) on small cards. Controls are `control-height` (40px) tall, or `control-height-compact` (36px). Table rows have `row-pad` (12px) padding, or `row-pad-compact` (8px).
- Radii: `radius-xs` for the checkbox, `radius-sm` for chips, `radius-md` for controls, `radius-lg` for cards and `radius-full` for avatars, pills and bars.
- Cards are white with a 1px `line` hairline and `radius-lg`, and they have **no shadow**. `shadow-float` is only for toasts, menus and modals.
- Tables: the header row is `header-row` with `overline` text, and rows are split by `line-soft` dividers.

### States

- On hover, primary buttons go `ink` → `sage-deep`, secondary borders turn `sage`, ghost buttons get `mist`, and rows get `surface-hover`.
- Focused fields get a `border-focus` border plus a 3px `focus-ring`. Errors get a `terracotta` border plus a 3px `blush` ring and a `clay-text` message.
- Disabled items drop to 40% opacity. Pressed states don't shrink.

### Layout

- The app shell is an ink `Sidebar` (`sidebar-width`, 200px) with five sections (Pregled, Raspored, Članovi, Karte i članarine, Uplate) and a HR/EN switch at the foot. It sits beside a linen workspace.
- Each page opens with a `PageHeader`: the Cinzel title on the left and one primary action on the right.

### Imagery and motion

- No imagery inside the tool. The brand's watercolour and botanical motifs stay out of the data UI.
- Motion is minimal: quick colour transitions only, with no bounces.
- No gradients, blur or transparency effects.

## Iconography

There is no icon set in the sources. The UI relies on text labels, coloured dots (status) and pills (class colour). Unicode ✓ ○ ‹ › are used sparingly. If icons are needed later, use a thin-stroke line set (e.g. Lucide at 1.5px) to match the line icons in the studio's schedule posts. This is a recommendation, not a source.

## Logo

Use `assets/Logos/prana-mark.png`, the Prana mark (a ring breaking into waves, in charcoal and copper on transparent), as given. Place it on `linen` or `white`. On `ink` grounds, invert it with `filter: brightness(0) invert(0.9)`. Never redraw it.

## Components

- **Forms:** `Button`, `Input`, `Checkbox`, `Choice`, `LangSwitch`
- **Data:** `Card`, `Avatar`, `StatusChip`, `Tag`, `Stat`, `MembershipCard`, `MemberRow`, `ClassTable`
- **Feedback:** `Toast`, `Notice`, `EmptyState`
- **Navigation:** `Sidebar`, `PageHeader`
- **Members:** `UpisnicaForm`, `MemberProfile`

Components read the tokens as CSS custom properties, so load the tokens stylesheet and `components/bundle.css` first. They are exported on `window.YogaCRM`. `Sidebar` takes the logo as `logoSrc`.

## Intentional additions

The studio had no component library, so this set was authored from the Kadulja reference page. `Choice` covers the upisnica's NE/DA questions and the plan picker. `UpisnicaForm` and `MemberProfile` reproduce the paper enrolment form field for field.
