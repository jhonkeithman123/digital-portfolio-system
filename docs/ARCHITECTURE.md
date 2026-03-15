# Digital Portfolio Architecture

## Purpose

This document describes the current architecture of the `client-vite` workspace after the server refactor.

## High-level system

- Frontend: Next.js + TypeScript (`apps/web`)
- Backend: Express + TypeScript + MySQL (`apps/server`)
- Auth model: JWT in httpOnly cookie, verified via middleware
- Deployment model: static client build + separately hosted Node server

## Repository layout

```text
client-vite/
  apps/
    web/                      # Next.js web app
      app/                    # App Router pages

    server/                   # Express backend
      app.ts                  # Server bootstrap + route mounting
      routes/                 # Route definitions by domain
      controllers/            # Request handlers/business logic
      middleware/
        auth.ts               # JWT verification
        dbCheck.ts            # DB availability guard
        http/                 # HTTP-level middleware
      config/
        db.ts                 # MySQL pool setup
        helpers/              # DB/session/token helper functions
      supabase/               # Supabase migration scaffolding
        migrations/
        zod/

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
5. `checkDbAvailability` annotates request with DB state.
6. Route-specific `requireDb` blocks API handling when DB is unavailable.
7. Domain routers call controllers via `wrapAsync`.
8. Global error handler returns standardized 500 on unhandled failures.

## API surface (grouped)

- `/auth`: login, signup, session check, password reset, username change
- `/classrooms`: create/join/invite/member checks
- `/activity`: activity CRUD, comments/replies, submissions, grading
- `/portfolio`: student and teacher portfolio views and details
- `/security`: CSP/tamper event intake
- `/showcase`: authenticated showcase data
- `/uploads/activities/*`: static access for uploaded activity files
- `/`: notifications + user section management routes from `routes/default.ts`

## Current architectural strengths

- Separation of routers and controllers by domain
- DB fallback support with explicit availability checks
- Single async wrapper for route handlers
- JWT guard used consistently on protected routes

## Known architectural debt

- Some controllers are very large (`activities.ts`, `Dashboard.tsx`) and can be split by feature.
- Import alias usage is inconsistent between client and server typechecks.
- Notification and user management routes are grouped under `/` and would be clearer under `/api` or `/notifications`.
- Route comments are extensive in some files; a generated API spec would reduce maintenance overhead.

## Recommended next refactor phases

1. Split `apps/server/controllers/activities.ts` into `activity.core`, `activity.comments`, `activity.submissions`, `activity.instructions`.
2. Move default routes to explicit prefixes (`/notifications`, `/users`) for easier API governance.
3. Introduce shared response helpers for consistent error envelope shape.
4. Add integration tests for auth/session, join/invite, and submission grading flows.
5. Define one canonical tsconfig strategy for workspace-level typechecks.

## Runbook

### Local setup

```bash
# root
pnpm install

# server dependencies
cd apps/server
pnpm install
```

### Start development

```bash
# terminal 1 (server)
cd apps/server
pnpm dev

# terminal 2 (web)
pnpm --filter @digital-portfolio/web dev
```

### Verify server compile

```bash
pnpm --filter @digital-portfolio/server typecheck
```
