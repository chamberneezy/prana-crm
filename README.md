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

Needs Node 22 or newer. Nothing here needs a Cloudflare or Firebase account.

```
npm install
npm run typecheck
npm run lint
npm test
```

### Web

```
npm run dev        # component demo page at http://localhost:5173
```

### API

D1 and R2 run on this machine through `wrangler dev`; data lives in `api/.wrangler/` (git-ignored).

```
cp api/.dev.vars.example api/.dev.vars   # once: accept Firebase Auth emulator tokens locally
npm run db:migrate -w @prana/api         # create the tables
npm run db:seed -w @prana/api            # studio data plus sample members and sessions (dev only)
npm run dev -w @prana/api                # http://localhost:8787/api
```

- `npm run db:reset -w @prana/api` wipes the local database and seeds it again.
- The dev seed allowlists one owner, `mario@prana.test`. Sample members, sessions and prices are made up.
- `npm run openapi -w @prana/api` regenerates `docs/openapi.json` after a schema change; a test fails if it is stale.

The production seed (M6) has no sample data and takes the owner's sign-in address:
`tsx api/scripts/seed.ts --prod --owner-email <address>`.

## Secrets

All secrets and IDs come from environment variables. Never commit them.
