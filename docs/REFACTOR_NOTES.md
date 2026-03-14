# Refactor Notes (March 2026)

## What changed

- Extracted HTTP-specific middleware from `apps/server/app.ts` into dedicated modules:
  - `apps/server/middleware/http/corsPolicy.ts`
  - `apps/server/middleware/http/requestLogger.ts`
  - `apps/server/middleware/http/tokenNormalization.ts`
  - `apps/server/middleware/http/browserGuards.ts`
- Updated `apps/server/app.ts` to compose those modules instead of inline middleware blocks.
- Removed unused imports/types in `apps/server/routes/default.ts`.
- Cleaned unused variables and improved helper reuse in `apps/server/controllers/auth.ts`.
- Removed unused `Request` type import in `apps/server/controllers/portfolio.ts`.

## Why this improves organization

- Single-responsibility middleware files are easier to test and reason about.
- `app.ts` is now a readable bootstrap/assembly file.
- Route/controller files have less dead code and fewer typecheck warnings.

## Validation performed

- `pnpm --filter @digital-portfolio/server typecheck` passes.

## Suggested follow-up tasks

1. Split `apps/server/controllers/activities.ts` into multiple focused modules.
2. Add API-level tests for auth, join/invite, and grading.
3. Standardize import aliases across root and server typechecks.
4. Move `/users/students` route handler to a dedicated controller method if you want separate behavior from `/users/sections`.
