# MultiBrandHub Frontend Testing Plan

This plan covers the Angular frontend behavior that exists today. Placeholder screens such as POS, cash register, settlements, dashboards, reports, and tasks should not receive detailed tests until their workflows are implemented.

## Strategy

- Keep the current Angular 21 unit-test builder with Vitest/jsdom; do not add another runner yet.
- Use Angular testing APIs for the matching risk surface:
  - `TestBed` for services and standalone components.
  - `provideHttpClient()` before `provideHttpClientTesting()` plus `HttpTestingController` for HTTP contracts and interceptors.
  - `RouterTestingHarness` for functional guards and role redirects.
- Prefer behavior tests over coverage-padding tests:
  - Pure unit tests for deterministic helpers, validation, payload builders, labels, formatters, and permission helpers.
  - Service tests for endpoint paths, query params, request bodies, signal state changes, optimistic updates, and error cleanup.
  - Component tests for form behavior, permission gates, emitted outputs, and user-visible state.
- Defer browser/E2E tests until the POS and cash-register flows exist; those will be the first workflows worth testing end-to-end.

## Highest-Value Coverage

- Auth and routing:
  - Restore only valid, non-expired, claim-matching sessions.
  - Clear invalid/tampered sessions.
  - Normalize numeric and string roles.
  - Redirect unauthenticated users to `/login`.
  - Map `SuperAdmin` to Admin UI routes and redirect disallowed roles to their own home.
  - Attach bearer tokens except for `/auth/login`.
  - Surface 401/400/403/generic errors through the global interceptor behavior.
- Inventory services:
  - Product searches send the correct filters, repeated `stockStatuses`, sorting, `includeInactive`, and brand scope.
  - Product create/update/archive/reactivate/delete mutate local signal state correctly.
  - Product import sends `FormData`; template download requests a blob.
  - Stock movement search and creation update movement state, product stock deltas, and refresh ticks.
  - Category lists are cached unless force-reloaded.
- Inventory components:
  - Admin/Seller get create/import/archive/movement permissions.
  - BrandManager gets metadata edit only, scoped to their brand.
  - Product forms respect backend defaults for create, disable stock/SKU/brand in edit mode, and generate/validate SKUs.
  - Movement forms reject zero quantity and non-adjustment negatives before hitting the backend.
  - Import forms validate file extension/size and show backend row errors.
- Settings and account management:
  - Admin can create Sellers and BrandManagers; BrandManagers require a brand.
  - SuperAdmin is hidden from Equipo lists.
  - Admin cannot edit/deactivate/reset other Admin/SuperAdmin users.
  - Brand rows detect missing associated active users and can open BrandManager creation with defaults.
  - Brand contract payloads normalize commission/rent values by contract type.
  - BrandManagers/Sellers only receive self-service password configuration.
- Shared app behavior:
  - Store profile clears on logout and tracks loading/saving signals.
  - General settings trim nullable fields and gate edits to Admin/SuperAdmin.
  - Utility tests cover stock status, image fallback, Uruguay date formatting, movement labels/severity, currency formatting, SKU generation, and loading counter behavior.

## Maintenance Rules

- Add tests alongside the feature they protect, plus shared test builders under `src/testing/`.
- When a backend contract changes, update the frontend type/service and its HTTP service spec in the same change.
- When a business rule changes, update `SPEC.md` first, then adjust tests to protect the new rule.
- Run `npm run test:ci` before merging frontend feature work.
