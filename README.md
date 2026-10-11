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
`apps/web/.env.preview` (`printf '%s' name@example.com | shasum -a 256`).

## Layout

```
api/               Cloudflare Worker (Hono): D1 schema and migration, seed, auth, all endpoints
apps/web/          React + Vite + TypeScript web app
packages/shared/   zod schemas (the API contract), member-status rules, date and money helpers, i18n strings (hr/en)
docs/              handoffs, the design export, openapi.json (generated)
```

`fixtures/upisnica/` holds the upisnica parser's test cases, shared with the iOS app. `apps/ios/` arrives later.

## Running locally

Needs Node 22 or newer. Nothing here needs a Cloudflare or Firebase account: the database, file storage and
sign-in all run on this machine.

```
npm install
cp api/.dev.vars.example api/.dev.vars   # once: lets the local API accept emulator sign-ins
npm run db:reset -w @prana/api           # once: create the local database with sample data
npm run dev:all                          # Auth emulator + API + web app
```

Then open http://localhost:5173 and sign in with **mario@prana.test** / **prana-dev**.
The sample members, sessions and prices are made up, and the emulator account is created on every start.

| Command | What it does |
|---|---|
| `npm run dev:all` | Auth emulator (9099), API (8787) and web app (5173) together |
| `npm run db:reset -w @prana/api` | Wipes the local database and seeds it again |
| `npm run typecheck` / `npm run lint` / `npm test` | Checks and unit tests |
| `npm run e2e` | Playwright smoke flows, on their own ports and their own database |
| `npm run e2e:demo` | The same kind of check against the demo build, served as GitHub Pages serves it |
| `npm run openapi -w @prana/api` | Regenerates `docs/openapi.json`; a test fails if it is stale |

- Local data lives in `api/.wrangler/` (git-ignored).
- The component demo page is at http://localhost:5173/demo.
- First `npm run e2e` on a machine: run `npx playwright install chromium` once.

The production seed (M6) has no sample data and takes the owner's sign-in address:
`tsx api/scripts/seed.ts --prod --owner-email <address>`.

## Secrets

All secrets and IDs come from environment variables. Never commit them.
