# Pegwin Circle — Web

One Next.js application with three experiences: the public website +
Attendee Portal, the Host Portal, and the Super Admin Portal. It consumes
the existing Pegwin backend REST API and ships no replacement backend.

- Stack: Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS v4
- Product analysis: [`docs/analysis/`](docs/analysis/) (requirements matrix,
  screen inventory, API integration map, business rules, clarifications,
  implementation plan, Phase 2 progress log)
- Source documents in [`docs/`](docs/) are read-only references. Do not edit them.

## Run locally

```bash
npm install
cp .env.example .env.local   # then set PEGWIN_API_BASE_URL
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in a browser.

> Backend status (10 Oct 2026): `https://api.pegwin.in/api/v1` currently
> answers `502 Bad Gateway`, so data-driven pages render honest error states
> with retry until the backend is reachable. See
> [`docs/analysis/phase2-progress.md`](docs/analysis/phase2-progress.md).

## Environment variables

| Variable | Scope | Purpose |
|---|---|---|
| `PEGWIN_API_BASE_URL` | server-only | Backend REST base URL, e.g. `https://api.pegwin.in/api/v1` |
| `NEXT_PUBLIC_APP_URL` | public | App URL used for links/redirects |
| `SUPPORT_EMAIL` | server-only | Support contact shown on help pages |

Placeholders live in [`.env.example`](.env.example). Never commit real
secrets: `.env*` files are git-ignored.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Development server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Serve a production build |
| `npm run lint` | ESLint over `src` and `tests` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Vitest unit suite |

## Delivered portals (Phase 2 complete, 11 Oct 2026)

- **Public + Attendee**: landing, home feed, explore + map/nearby,
  event detail (agenda, attendees, host, community, policies),
  checkout (quote → hold → coupon → order), payment, bookings + order
  detail + cancel, QR tickets, saved, communities (detail, posts,
  member composer, chat, join/leave/mute/block/report), public user
  and host profiles, profile + settings + notifications + language,
  inbox, help center, support threads, static policy pages.
- **Host** (`/host`, role-gated): overview, event lifecycle lists,
  6-step creation wizard, event manage (tiers, agenda, team, policies,
  check-ins, analytics), reschedule/cancel, community creation +
  10-section manage hub, group chats, QR scanner (camera + manual +
  offline bundle + ≤500 sync), finance, analytics, verifications,
  host profile. Event staff reach only the scanner.
- **Super Admin** (`/admin`, `super_admin` only): overview, event
  review queue (approve/reject/suspend/remove), flagged hosts
  (warn/suspend/remove/verification), moderation queue, coupons,
  payouts, audit logs.
- Every data call uses exact documented endpoints — see
  [`docs/analysis/api-integration-map.md`](docs/analysis/api-integration-map.md).
  Missing backend capabilities and open questions live in
  [`docs/analysis/phase2-progress.md`](docs/analysis/phase2-progress.md)
  and [`docs/analysis/clarifications.md`](docs/analysis/clarifications.md).

Verified: `vitest` 48/48 · `tsc --noEmit` clean ·
`eslint src tests` clean · `next build` succeeds (55+ routes).
Accessibility: skip link, labelled controls, dialog focus trap +
Escape, `aria-live` toasts/chat, keyboard-visible focus throughout.

## Architecture

- `src/app/(auth)` — centered shell for sign-in / sign-up / OTP (Phase 3)
- `src/app/(attendee)` — public + attendee portal (`/`, `/home`, …)
- `src/app/(host)` — host portal (`/host`, …), role-gated
- `src/app/(admin)` — super-admin portal (`/admin`, …), role-gated
- `src/app/api/[...path]` — backend-for-frontend proxy: attaches the
  access token server-side from httpOnly cookies, refreshes once on 401,
  never exposes tokens or backend cookies to the browser
- `src/proxy.ts` — UX-level route gating (Next 16 `proxy` convention;
  `middleware` is deprecated). Real authorization is enforced by server
  components (`requireSession`) and, authoritatively, by the backend
- `src/lib/api-client.ts` — centralized typed client: exact documented
  endpoints, §14 error mapping, single-flight refresh, idempotency keys
- `src/lib/api-types.ts` — hand-written backend contracts, no invented fields
- `src/components/ui` — design-system primitives; `src/components/layout` —
  header, footer, portal navigation

## Security notes

- Tokens live in httpOnly cookies (`pw_at`, `pw_rt`); the browser never
  holds them. Roles come from the backend user object, never user input.
- Host routes are owner-scoped per endpoint; admin routes require
  `super_admin`. Frontend guards are UX only — the backend re-checks.
- Money is integer paise end-to-end; the client only formats quote totals
  and never computes payables.
