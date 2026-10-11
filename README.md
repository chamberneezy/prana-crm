# Prana CRM

Management app for Prana Yoga Studio: members, enrolment from the paper form (upisnica), class types, sessions, memberships and payments.

- `docs/handoff-web.md` and `docs/handoff-ios.md` are the source of truth for behaviour, data and architecture.
- `docs/design/` is the source of truth for how screens look.

## Layout

```
apps/web/          React + Vite + TypeScript web app
packages/shared/   types, formatting helpers, i18n strings (hr/en)
docs/              handoffs and the design export
```

`api/` (Cloudflare Worker), `apps/ios/` and `fixtures/upisnica/` arrive in later milestones.

## Running locally

Needs Node 22 or newer.

```
npm install
npm run dev        # component demo page at http://localhost:5173
npm run typecheck
npm run lint
npm test
```

## Secrets

All secrets and IDs come from environment variables. Never commit them.
