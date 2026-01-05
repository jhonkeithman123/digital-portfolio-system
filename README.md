# Digital Portfolio — Client (Vite)

This is the Vite + React client for the Digital Portfolio project. It was built for my client and served as an experience for me to grow as a software and web developer.

## Summary

- Project type: Vite + React + TypeScript
- Purpose: Frontend for the Digital Portfolio system
- Goal: Deliver a production-ready client and practice real-world full‑stack development

## Features

- Vite dev server and fast HMR
- Typed code with TypeScript
- Configured to communicate with a separate backend API server
- Ready for deployment to GitHub Pages (builds go to `dist/`)

## Local development

1. Install dependencies

```bash
# from repo root
npm install
cd server
npm install
cd ..
```

2. Start server (run in a separate terminal)

```bash
# if server is a separate repo/service, run it accordingly
cd server
npm run dev
```

3. Start client

```bash
# from repo root
npm run dev
```

4. Open the client in a browser (Will be updated in the future):

```
Will be updated in the future
```

## Environment

- Client uses Vite env vars prefixed with `VITE_` (e.g. `VITE_API_URL`).
- Server keeps runtime secrets in environment variables (do not commit `.env`).
- Example server env keys:
  - DB_HOST, DB_PORT, DB_USER, DB_PASS, DB_NAME
  - JWT_SECRET
  - CLIENT_ORIGIN

## Deployment

- Client: build with `npm run build` and deploy to GitHub Pages or any static host. Ensure `base` is set in `vite.config.ts` for GH Pages.
- Server: deploy to a Node host (Render, Railway, Heroku, Vercel serverless). Use a managed database reachable by the server (do not point to a local XAMPP instance from the host).

## Notes

- The server is maintained as a separate repository / submodule.
- The client and server communicate via REST; the server may serve a small landing page at `/` indicating it is an API service.

## Contact

- This repository was created as a deliverable for a client and a learning project to level up skills in full‑stack web development.
