# Frontend Refactor and Migration Guide

## Scope completed

- Added monorepo shared contracts package at `packages/contracts`.
- Replaced duplicated API/session types with shared contracts re-exports.
- Added safe JSON storage helpers in `src/utils/storage.ts`.
- Refactored `src/App.tsx` route guard to use typed session responses.
- Refactored `src/components/Activity-components/ActivityView.tsx` to reduce `any` usage and simplify load flow.
- Cleaned stray code in `src/components/auth/tokenGuard.tsx`.
- Scoped `tsconfig.app.json` to frontend sources only.

## New frontend organization (current)

```text
packages/
  contracts/
    src/index.ts      # Shared API/session contracts

src/
  components/
  hooks/
  pages/
  security/
  types/
    activity.d.ts
    api.ts            # Re-exports from @digital-portfolio/contracts
    models.ts
  utils/
    apiClient.ts      # Refactored typed API result
    storage.ts        # New: local/session storage helpers
```

## Next.js upgrade path (parallel app)

A migration app now lives at `apps/web` to avoid breaking feature delivery while migrating.

```text
apps/web/
  app/
    layout.tsx
    page.tsx
    login/page.tsx
    dashboard/page.tsx
  lib/
    api.ts
  types/
    api.ts            # Re-exports from @digital-portfolio/contracts
  package.json
  tsconfig.json
  next.config.ts
```

## How backend communication is preserved

- Both Vite and Next clients call the same Express API.
- Next client uses `NEXT_PUBLIC_API_URL` and `credentials: "include"`.
- Session restore still uses `/auth/session`.
- Login still uses `/auth/login`.

## Runbook

### Existing Vite app

```bash
pnpm dev
```

### New web app

```bash
cd apps/web
pnpm install
cp .env.example .env.local
pnpm dev
```

## Suggested next migration steps

1. Port `RoleSelect`, `Login`, and `Dashboard` UI parity to `apps/web` routes.
2. Move shared UI atoms from `apps/web/src-legacy/components/Component-elements` to `apps/web/components`.
3. Port classroom and activity pages in sequence.
4. Add route-level guards in Next middleware or server components.
5. After parity and tests, switch deployment from Vite to Next.
