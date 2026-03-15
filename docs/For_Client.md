# Client Delivery Notes

This repository no longer uses Create React App. It uses:

- Next.js web app at `apps/web`
- pnpm workspaces for monorepo package management

## Quick start

```bash
# install all workspace dependencies
pnpm install

# run web + server from root scripts
pnpm dev

# run server from workspace root
pnpm --filter @digital-portfolio/server dev

# run Next client only
pnpm --filter @digital-portfolio/web dev
```

## Build

```bash
# workspace build
pnpm build

# Server typecheck
pnpm --filter @digital-portfolio/server typecheck
```

## Vercel deployment (web + server)

Deploy this monorepo as **two Vercel projects**:

1. Web project (Next.js)
2. Server project (Express API)

### 1. Web project setup

- Import repository in Vercel.
- Set **Root Directory** to `apps/web`.
- Framework preset: `Next.js`.
- Build command: default (`next build`) is fine.

Set environment variables for the web project:

- `NEXT_PUBLIC_API_BASE_URL=https://<your-server-project>.vercel.app`
- `NEXT_PUBLIC_API_BASE_LOCAL=https://<your-server-project>.vercel.app`

### 2. Server project setup

- Import the same repository in Vercel as a second project.
- Set **Root Directory** to `apps/server`.
- The server uses `apps/server/vercel.json` and `apps/server/api/index.ts`.

Set environment variables for the server project:

- `NODE_ENV=production`
- `CLIENT_ORIGIN=https://<your-web-project>.vercel.app`
- `JWT_SECRET=<secure-random-secret>`
- `DB_PROVIDER=supabase` (or your chosen provider)
- `SUPABASE_ONLY=true` (if using Supabase-only mode)
- `SUPABASE_URL=<...>`
- `SUPABASE_SERVICE_ROLE_KEY=<...>`
- `SUPABASE_PROJECT_ID=<...>`
- `EMAIL_USER=<...>`
- `EMAIL_PASS=<...>`
- `ADMIN_EMAILS=<comma-separated-admin-emails>` (optional)
- `ADMIN_USERNAMES=<comma-separated-admin-usernames>` (optional)
- `ADMIN_USER_IDS=<comma-separated-admin-user-ids>` (optional)

### 3. Cross-project checks

- Confirm `CLIENT_ORIGIN` on server exactly matches web URL.
- Confirm web API env vars point to deployed server URL.
- Re-login once after deploy so session payload includes latest `isAdmin` flag.

### 4. Smoke test after deploy

- Web loads at `/login` and authenticates.
- API routes respond from server domain (`/auth/session`, `/admin/students` for admins).
- Teacher admin account sees `Admin Panel` and can open `/admin`.

For current architecture and migration details, see:

- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/FRONTEND_REFACTOR.md`
