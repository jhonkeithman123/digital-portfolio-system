# Digital Portfolio System

Full-stack digital portfolio platform with a React client and Express API.

## Stack

- Client: React + Vite + TypeScript
- Server: Express + TypeScript + MySQL
- Auth: JWT + httpOnly cookie sessions

## Project layout

- `apps/web`: Next.js web app
- `apps/web/src-legacy`: Migrated legacy React Vite source for incremental porting
- `apps/server`: API server (routes, controllers, middleware, db helpers)
- `packages/contracts`: Shared type contracts for web and server
- `docs/`: Architecture, flowcharts, and refactor notes

## Documentation

- Architecture: `docs/ARCHITECTURE.md`
- Flowcharts: `docs/FLOWCHART.md`
- Refactor summary: `docs/REFACTOR_NOTES.md`
- Turborepo guide: `docs/TURBOREPO.md`
- Frontend refactor: `docs/FRONTEND_REFACTOR.md`
- Frontend flowcharts: `docs/FRONTEND_FLOWCHART.md`
- Server feature notes: `apps/server/Features.md`
- Web app guide: `apps/web/README.md`

## Local development

1. Install dependencies

```bash
# root
pnpm install

# server
cd apps/server
pnpm install
```

2. Run the server

```bash
cd apps/server
pnpm dev
```

3. Run the client

```bash
# from repository root
pnpm --filter @digital-portfolio/web dev
```

4. Run everything via Turborepo (with TUI)

```bash
# all app dev tasks in turbo UI
pnpm dev:tui
```

## Environment variables

Server (`apps/server/.env`)

- `PORT`
- `CLIENT_ORIGIN`
- `ALLOWED_ORIGINS`
- `JWT_SECRET`
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME`

Client (`.env`)

- `VITE_API_URL`

## Build and checks

```bash
# client build
pnpm build

# server typecheck
pnpm --filter @digital-portfolio/server typecheck
```

## Deployment notes

- Deploy client as static assets (`dist/`) on Vercel, Netlify, or GitHub Pages.
- Deploy server to a Node runtime with access to a managed MySQL database.
- Keep cookie and CORS origin settings aligned with deployed client domain.
