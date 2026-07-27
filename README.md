# MultiBrandHub — Frontend

Angular 21 frontend for **MultiBrandHub**, a management system for a multi-brand retail store. The store Admin owns the place and their own brand, and rents rack space to other entrepreneur brands (BrandManagers); Sellers run the front-desk POS. The app handles inventory, unified sales (a single ticket can mix items from multiple brands), per-brand settlements, cash register closes, reports, and tasks. No real payments are processed — the system records sales and computes amounts to be transferred.

The full product spec lives in [`SPEC.md`](SPEC.md). The phased delivery plan lives in [`PLAN.md`](PLAN.md). The operating manual for any AI agent working on this repo is [`CLAUDE.md`](CLAUDE.md) — read that first if you're an agent.

## Tech stack

- **Angular 21** (standalone components + signals, no NgModule)
- **Tailwind CSS v4** + `tailwindcss-primeui` plugin
- **PrimeNG 21** (styled mode, Aura preset)
- **Backend:** .NET 10 + SQL Server (separate repo at `../../Backend/MultiBrandHub`)

## Prerequisites

- Node.js 20+
- npm 10+
- Backend running locally at `https://localhost:7260` (see `src/environments/environment.ts` and the backend repo).
- In production, tenant resolution comes from each customer's domain/subdomain. The frontend should not send tenant headers in production.

## Setup

```bash
npm install
```

## Development

```bash
npm start
```

Opens at `http://localhost:4200`. Unauthenticated visits are redirected to `/login`. After successful login, the user lands on the route appropriate to their role:

- `Admin` (and `SuperAdmin`) → `/admin`
- `BrandManager` → `/brand-manager`
- `Seller` → `/seller`

### Testing another dev tenant locally

Production tenants are resolved by the customer domain/subdomain. For local development only, when the frontend is still running from `localhost:4200` but you want the API to resolve another seeded tenant, set a dev override in the browser console of the running frontend tab:

```js
localStorage.setItem('mbh.devTenantHost', 'aurora.localhost');
```

Then log in normally. Remove it to return to the default localhost tenant:

```js
localStorage.removeItem('mbh.devTenantHost');
```

### Testing MFA locally

MFA enrollment is disabled by default. To enable it **only for the local backend process**,
open PowerShell from this frontend repository and run:

```powershell
Push-Location ..\..\Backend\MultiBrandHub
$env:Mfa__EnrollmentEnabled = 'true'
dotnet run --project MultiBrandHub.API --launch-profile https
```

This environment variable does not edit backend files and does not change the Azure setting.
Remove it from the current shell after testing with:

```powershell
$env:Mfa__EnrollmentEnabled = $null
Pop-Location
```

Run the frontend separately with `npm start`. The default `localhost` development tenant seeds
these administrative accounts with password `Password!123mbh`:

- Admin: `admin@multibrand.com`
- SuperAdmin: `superadmin-ninos-demo@multibrandhub.com`

Recommended manual verification:

1. Log in as Admin and open `Configuración → Seguridad`.
2. Activate MFA, scan the local QR with Google Authenticator, Microsoft Authenticator, or another
   TOTP app, then confirm a six-digit code.
3. Copy or download all ten recovery codes, acknowledge that they were saved, and verify that the
   app returns to login.
4. Log in once with the Authenticator and once with a recovery code. A used recovery code must not
   work again.
5. Regenerate recovery codes and confirm the current session stays open and the counter refreshes.
6. Log in as SuperAdmin and use `Configuración → Equipo → Administradores y MFA` to reset the
   Admin's MFA with an audit reason. Self-reset must remain disabled.
7. Re-enroll the Admin, disable MFA, and confirm the previous session is cleared immediately.
8. Restart the backend without the environment override. A non-enrolled account must show that new
   activations are unavailable; an already-enrolled account must still require and manage MFA.

Challenges, setup keys, QR object URLs, TOTP values, and recovery codes should never appear in
browser storage, route URLs, console output, or network requests other than their documented MFA
endpoint bodies.

## Build

```bash
npm run build
```

Artifacts go to `dist/`.

## Tests

```bash
npm test
```

(Vitest.)

For a single non-watch run, use:

```bash
npm run test:ci
```

Mocked browser smoke tests run the Angular app in Chromium, inject a valid fake session,
mock the backend at the browser boundary, and fail on uncaught runtime errors,
`console.error`, blank routed screens, or unexpected API calls:

First-time local setup:

```bash
npx playwright install chromium
```

```bash
npm run smoke
```

For CI-style smoke tests:

```bash
npm run smoke:ci
```

To run both layers locally:

```bash
npm run test:all
```

## Folder structure

```
src/
├── environments/              API base URL per environment
└── app/
    ├── core/                  app-wide singletons
    │   ├── auth/              AuthService, guards, auth interceptor, types
    │   ├── http/              error interceptor (toast + 401 logout)
    │   ├── notifications/     wrapper around PrimeNG MessageService
    │   └── loading/           signal-based global loading counter
    ├── shared/
    │   └── layouts/           AdminLayout, BrandManagerLayout, SellerLayout
    ├── features/
    │   ├── auth/login/        login screen
    │   ├── admin/             7 placeholder feature components
    │   ├── brand-manager/     4 placeholder feature components
    │   └── seller/            4 placeholder feature components
    ├── app.config.ts          providers (HttpClient, router, PrimeNG, app initializer)
    ├── app.routes.ts          role-guarded routing tree
    └── app.{ts,html,css}      root shell (toast + global loading bar + outlet)
```

## Conventions

- Standalone components, signals for state, functional guards/interceptors. No `NgModule`. No `*ngIf`/`*ngFor` — use `@if`/`@for`. See [`CLAUDE.md`](CLAUDE.md) for the full set of rules.
- **Code/identifiers/comments in English. UI text in Spanish (Rioplatense).**
- PrimeNG components stay themed via the Aura preset; Tailwind utilities (including `bg-primary`, `text-surface-*` from `tailwindcss-primeui`) handle layout and your own markup. Override PrimeNG via the preset / `dt` / `pt` props before reaching for `!`-prefixed utilities.

## Reference docs

- [`SPEC.md`](SPEC.md) — product specification (screens, roles, business rules)
- [`PLAN.md`](PLAN.md) — delivery plan with checklist by phase
- [`TESTING_PLAN.md`](TESTING_PLAN.md) — behavior-focused frontend testing strategy
- [`CLAUDE.md`](CLAUDE.md) — agent operating manual
