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

For current architecture and migration details, see:

- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/FRONTEND_REFACTOR.md`
