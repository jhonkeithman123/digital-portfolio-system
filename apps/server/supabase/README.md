# Supabase Migration Layout

This folder contains the PostgreSQL/Supabase migration starter converted from `config/digital_portfolio_system.sql`.

## Structure

- `migrations/`: SQL migrations for Supabase/Postgres
- `types.generated.ts`: generated database types from Supabase CLI
- `zod/generated.ts`: generated Zod schemas from Supazod
- `zod/manual.ts`: hand-authored validation schemas for key entities

## Commands

```bash
# generate DB types from your Supabase project
pnpm --filter @digital-portfolio/server supabase:types

# generate zod schemas from DB types
pnpm --filter @digital-portfolio/server supazod

# ping your live Supabase connection
pnpm --filter @digital-portfolio/server supabase:ping
```

Required env vars:

- `SUPABASE_PROJECT_ID`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Env loading note:

- The server reads both `apps/server/.env` and the repository root `.env`.

## Runtime health endpoint

The server exposes a health probe for Supabase connectivity:

`GET /supabase/health`

It performs a lightweight Supabase connectivity probe and returns `200` on success, `503` otherwise.
It prefers Auth Admin checks when available, and falls back to a key-authenticated REST probe for limited keys.
