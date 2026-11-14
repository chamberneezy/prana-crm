# Prana CRM

Management app for Prana Yoga Studio: members, enrolment from the paper form (upisnica), class types, sessions, memberships and payments.

- `docs/handoff-web.md` and `docs/handoff-ios.md` are the source of truth for behaviour, data and architecture.
- `docs/design/` is the source of truth for how screens look.

## Try it

**https://chamberneezy.github.io/prana-crm/** is a preview of the web app.

- **Sign-in is real**, through the Firebase project "Prana" (`prana-studio-crm`): Google, or e-mail and password.
  Only listed addresses get in; anyone else is told the account has no access.
- **The data is made up and is kept only in your own browser.** There is no server or shared database yet, so
  another browser or device starts from the sample data. "Vrati početne podatke" on the login screen starts over.

The preview runs the same API code as the real app, but inside the browser on SQLite (`api/src/demo`). It is rebuilt
from `main` by `.github/workflows/pages.yml`.

| Build | Sign-in | Data |
|---|---|---|
| `npm run build` | Firebase | The Cloudflare Worker (not deployed yet) |
| `npm run build:preview` | Firebase project "Prana" | In the browser, sample data |
| `npm run build:demo` | None: any button lets you in | In the browser, sample data |

To let another address into the preview, add the SHA-256 of its lower-cased e-mail to `VITE_OWNER_HASHES` in
`apps/web/.env.preview` (`printf '%s' name@example.com | shasum -a 256`), and to the list in `firestore.rules`
so they can send feedback too (a test checks the two agree), then `npm run deploy:rules`.

## Roles

Who may see and change what is decided in one place, `ROLE_ACCESS` in `packages/shared/src/access.ts`: per role and
section, `none`, `view` or `edit`. The API enforces it on every request and the web app shows only those sections
(and hides the buttons that change things where a role may only look).

- **Owners** can do everything. On the preview they are `VITE_OWNER_HASHES`; in production, `--owner` in the seed.
- **Teachers** will be view-only on part of the app. For now they see an empty tool ("Pristup još nije postavljen").
  Let one in with `VITE_TEACHER_HASHES` on the preview or `--teacher "Name <address>"` in the production seed.
  Locally, sign in as `petra@prana.test` / `prana-dev` to see a teacher's view.
- To open a section to teachers: set it in `ROLE_ACCESS`, e.g. `schedule: 'view'`. A new endpoint goes in
  `api/src/access.ts` with the section it belongs to (a test fails until it does).

## Feedback

In the signed-in app, **right-click on anything** (a button, a row, a card, the page) to send feedback about it.
The form offers the element, each named section around it and the whole page, highlights the chosen one, and takes
a type (something's wrong / suggestion / question) and a comment. Shift + right-click keeps the browser's own menu.

Entries go to Firestore (collection `feedback`) in the same Firebase project as sign-in. `firestore.rules` lets only
verified owners add entries, and nobody read them from the app. Each entry records the page's address (without the
query), the chosen target and its path, a CSS path to the element, the language, the window size and the build's commit.

| Command | What it does |
|---|---|
| `npm run feedback` | Prints new entries as Markdown (uses your `gcloud auth login`) |
| `npm run feedback -- --mark-seen` | The same, then marks them `seen` |
| `npm run feedback -- --all` | Every entry, with its status |
| `npm run feedback -- --set <id> <status>` | e.g. `planned`, `done`, `wontfix` |
| `npm run feedback -- --emulator` | Reads the local Firestore emulator instead |
| `npm run deploy:rules` | Publishes `firestore.rules` to the Firebase project "Prana" |

Feedback is on where `VITE_FEEDBACK=firestore` (the preview and local development) and off in the plain demo.

## Layout

```
api/               Cloudflare Worker (Hono): D1 schema and migrations, seed, auth, all endpoints
apps/web/          React + Vite + TypeScript web app
packages/shared/   zod schemas (the API contract), member-status rules, date and money helpers, i18n strings (hr/en)
docs/              handoffs, the design export, openapi.json (generated)
```

`fixtures/upisnica/` holds the upisnica parser's test cases, shared with the iOS app. `apps/ios/` arrives later.

## Running locally

Needs Node 22 or newer, and Java 21 or newer for the Firestore emulator. Nothing here needs a Cloudflare or Firebase account: the database, file storage and
sign-in all run on this machine.

```
npm install
cp api/.dev.vars.example api/.dev.vars   # once: lets the local API accept emulator sign-ins
npm run db:reset -w @prana/api           # once: create the local database with sample data
npm run dev:all                          # Auth and Firestore emulators + API + web app
```

Then open http://localhost:5173 and sign in with **mario@prana.test** / **prana-dev**.
The sample members, sessions and prices are made up, and the emulator account is created on every start.

| Command | What it does |
|---|---|
| `npm run dev:all` | Auth (9099) and Firestore (8080) emulators, API (8787) and web app (5173) together |
| `npm run db:reset -w @prana/api` | Wipes the local database and seeds it again |
| `npm run typecheck` / `npm run lint` / `npm test` | Checks and unit tests |
| `npm run e2e` | Playwright smoke flows, on their own ports and their own database |
| `npm run e2e:demo` | The same kind of check against the demo build, served as GitHub Pages serves it |
| `npm run openapi -w @prana/api` | Regenerates `docs/openapi.json`; a test fails if it is stale |

- Local data lives in `api/.wrangler/` (git-ignored).
- A new file in `api/migrations/` also goes in the list in `api/src/demo/migrations.ts` (a test checks): the preview
  applies it in each visitor's browser and keeps their data. Locally, `npm run db:migrate -w @prana/api` applies it.
- The component demo page is at http://localhost:5173/demo.
- First `npm run e2e` on a machine: run `npx playwright install chromium` once.

The production seed (M6) has no sample data and takes the owner's sign-in address:
`tsx api/scripts/seed.ts --prod --owner "Name <address>"` (repeat `--owner` for each owner).

## Secrets

All secrets and IDs come from environment variables. Never commit them.
