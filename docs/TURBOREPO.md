# Turborepo Workflow

This monorepo uses Turborepo with pnpm workspaces.

## Workspace layout

- `apps/web`: Next.js app
- `apps/server`: Express API
- `packages/contracts`: Shared type contracts

## Root scripts

```bash
# run all dev tasks in parallel
pnpm dev

# run all dev tasks with turbo terminal UI
pnpm dev:tui

# run all available build scripts
pnpm build

# run all available typechecks
pnpm typecheck
```

## Targeted package commands

```bash
pnpm --filter @digital-portfolio/web dev
pnpm --filter @digital-portfolio/web build
pnpm --filter @digital-portfolio/server dev
pnpm --filter @digital-portfolio/server typecheck

# cross-platform clean (autodetect)
# default is deep cleanup
pnpm clean

# standard artifact-only cleanup
pnpm clean:standard

# explicit deep cleanup
pnpm clean:deep
```

## Notes

- `turbo.json` controls task graph and caching behavior.
- `dev` tasks are non-cached and persistent.
- `build` outputs include Next `.next` and static `dist` artifacts when available.
