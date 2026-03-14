# Client Delivery Notes

This repository no longer uses Create React App. It uses:

- Next.js web app at `apps/web`
- Legacy Vite source staged at `apps/web/src-legacy`
- pnpm workspaces for monorepo package management

## Quick start

```bash
# install all workspace dependencies
pnpm install

# run vite client
pnpm dev

# run server from workspace root
pnpm --filter @digital-portfolio/server dev

# run next migration client
pnpm --filter @digital-portfolio/web dev
```

## Build

```bash
# Vite client build
pnpm build

# Server typecheck
pnpm --filter @digital-portfolio/server typecheck
```

For current architecture and migration details, see:

- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/FRONTEND_REFACTOR.md`
