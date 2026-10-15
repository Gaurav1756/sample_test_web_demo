

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


