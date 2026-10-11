# Prana CRM

Management app for Prana Yoga Studio: members, enrolment from the paper form (upisnica), class types, sessions, memberships and payments.

- `docs/handoff-web.md` and `docs/handoff-ios.md` are the source of truth for behaviour, data and architecture.
- `docs/design/` is the source of truth for how screens look.

## Layout

```
api/               Cloudflare Worker (Hono): D1 schema and migration, seed, auth, all endpoints
apps/web/          React + Vite + TypeScript web app
packages/shared/   zod schemas (the API contract), member-status rules, date and money helpers, i18n strings (hr/en)
docs/              handoffs, the design export, openapi.json (generated)
```

`apps/ios/` and `fixtures/upisnica/` arrive in later milestones.

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
| `npm run openapi -w @prana/api` | Regenerates `docs/openapi.json`; a test fails if it is stale |

- Local data lives in `api/.wrangler/` (git-ignored).
- The component demo page is at http://localhost:5173/demo.
- First `npm run e2e` on a machine: run `npx playwright install chromium` once.

The production seed (M6) has no sample data and takes the owner's sign-in address:
`tsx api/scripts/seed.ts --prod --owner-email <address>`.

## Secrets

All secrets and IDs come from environment variables. Never commit them.
