# Web App (Next.js)

This folder contains a parallel Next.js frontend for incremental migration from the existing Vite app.

## Why parallel migration

- Avoids breaking production Vite routes while migration is in progress.
- Lets you move pages feature-by-feature.
- Keeps the same backend server and auth cookie model.

## Setup

```bash
cd ..
pnpm install
cd apps/web
cp .env.example .env.local
pnpm dev
```

## Environment

- `NEXT_PUBLIC_API_BASE_URL`: Express backend base URL (for example `http://localhost:5000`)
- `NEXT_PUBLIC_API_BASE_LOCAL`: Optional local fallback URL for development

## Current migrated surfaces

- `/`: migration landing page
- `/login`: server-backed login
- `/dashboard`: protected page using `/auth/session`

## Migration strategy

1. Move shared UI atoms/components to `apps/web/components`.
2. Port route pages one by one from `src/pages`.
3. Replace React Router navigation with Next App Router (`next/navigation`).
4. Keep all API calls routed to existing Express endpoints.
5. After full parity, retire Vite app.
