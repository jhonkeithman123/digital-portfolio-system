# Digital Portfolio Architecture

## Purpose

This document describes the current architecture of the `client-vite` monorepo.

## High-level system

- Frontend: Next.js 16 + React 19 + TypeScript (`apps/web`)
- Backend: Express 5 + TypeScript (`apps/server`)
- Database mode: Supabase-first with optional MySQL compatibility mode
- Auth model: JWT in httpOnly cookies, validated on protected endpoints
- Deployment model:
  - Server: Render (`render.yaml`)
  - Web: independent frontend hosting (can remain on Vercel or other)

## Repository layout

```text
client-vite/
  render.yaml                 # Render blueprint for server deployment
  pnpm-workspace.yaml         # Workspace package boundaries

  apps/
    web/                      # Next.js web app (port 5173)
      app/                    # App Router pages
      src/
        components/
        screens/
        hooks/
        utils/
        security/
        contexts/

    server/                   # Express backend
      app.ts                  # Server bootstrap + route mounting
      api/                    # Serverless adapter entry (kept for compatibility)
      routes/                 # Route definitions by domain
      controllers/            # Request handlers/business logic
      middleware/
        auth.ts               # JWT verification
        dbCheck.ts            # DB availability guard
        http/                 # HTTP-level middleware
      config/
        db.ts                 # Supabase/MySQL mode-aware DB entry
        helpers/              # DB/session/token helper functions
      supabase/               # Supabase client + ping + generated types
      public/                 # API landing static assets
      uploads/                # Uploaded activity files

  packages/
    contracts/                # Shared contracts for web + server

  docs/
    ARCHITECTURE.md
    FLOWCHART.md
```

## Backend request lifecycle

1. `createCorsPolicy` applies CORS headers and handles preflight.
2. Static assets under `apps/server/public` are served.
3. `requestLogger` and debug logger record request metadata.
4. `normalizeTokenSource` populates `Authorization` from cookie/query when missing.
5. In MySQL mode, `checkDbAvailability` annotates request with DB state.
6. In MySQL mode, `requireDb` blocks protected routes while DB is down.
7. Domain routers call controllers via `wrapAsync`.
8. `browserHtmlRedirectGuard` redirects direct browser hits to `/` for non-root paths.
9. Global error handler returns standardized 500 responses for unhandled failures.

## Frontend runtime model

1. `apps/web/src/App.tsx` defines route-level guards via `ProtectedRoute`.
2. Protected routes call `/auth/session` via `apiFetch`.
3. Session success renders authenticated screens (`/home`, `/dash`, `/admin`, `/create`, `/join`, `/portfolio`, `/activity/:id/view`).
4. Session failure redirects users to `/login`.
5. `apiClient` resolves API base URL from `NEXT_PUBLIC_*` environment variables and includes credentials for cookie auth.

## API surface (grouped)

- `/auth`: login, signup, session check, password reset, username change
- `/classrooms`: create/join/invite/member checks
- `/activity`: activity CRUD, comments/replies, submissions, grading
- `/portfolio`: student and teacher portfolio views and details
- `/security`: CSP/tamper event intake
- `/showcase`: authenticated showcase data
- `/supabase/health`: Supabase connectivity status endpoint
- `/uploads/activities/*`: static access for uploaded activity files
- `/`: notifications + user section/admin student management routes from `routes/default.ts`

## Data providers and mode selection

- Provider selection happens in `apps/server/config/db.ts` using `DB_PROVIDER` and `SUPABASE_ONLY`.
- Supabase mode:
  - Uses `@supabase/supabase-js` client (`apps/server/supabase/client.ts`).
  - Bypasses MySQL availability checks and `requireDb` gating.
- MySQL mode:
  - Uses `mysql2/promise` pool in `config/db.ts`.
  - Enables DB availability middleware before route execution.

## Current architectural strengths

- Separation of routers and controllers by domain
- Clear Supabase/MySQL runtime branching without duplicating route registration
- Single async wrapper for route handlers
- JWT guard used consistently on protected routes
- CORS policy now supports localhost aliases plus configured production origins

## Known architectural debt

- Some controllers are very large (`activities.ts`, `activitiesSupabase.ts`) and can be split by sub-domain.
- Notification and user management routes are grouped under `/` and would be clearer under explicit `/notifications` and `/users` prefixes.
- The web app still uses a compatibility router layer while running inside a Next.js project.
- API response envelopes vary slightly by controller and should be standardized.

## Recommended next refactor phases

1. Split `apps/server/controllers/activities*.ts` into focused modules (`core`, `comments`, `submissions`, `grading`).
2. Move `routes/default.ts` endpoints into explicit grouped routes (`/notifications`, `/users`, `/admin`).
3. Introduce shared response helpers for consistent `{ success, message, data }` envelopes.
4. Add integration tests for auth/session, classroom join/invite, and submission grading.
5. Continue converging web routing to pure Next App Router patterns.

## Deployment architecture

- Server deployment target: Render Blueprint (`render.yaml`)
  - Build: installs with pnpm via Corepack and runs `pnpm --filter @digital-portfolio/server build`
  - Start: `pnpm --filter @digital-portfolio/server start`
  - Health check: `/supabase/health`
- Web deployment target: independent frontend host (currently separate from server deployment)
- CORS alignment requirement:
  - `CLIENT_ORIGIN` should match the canonical frontend domain
  - `ALLOWED_ORIGINS` may include additional approved origins

## Runbook

### Local setup

```bash
# root
pnpm install
```

### Start development

```bash
# terminal 1 (server)
pnpm --filter @digital-portfolio/server dev

# terminal 2 (web)
pnpm --filter @digital-portfolio/web dev

# optional: run both through turbo
pnpm dev
```

### Verify builds and typechecks

```bash
pnpm --filter @digital-portfolio/server typecheck
pnpm --filter @digital-portfolio/web typecheck
```
