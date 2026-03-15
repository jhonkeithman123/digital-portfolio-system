# Server Features and Operations

This document is a concise operational summary of the backend in `apps/server/`.

## Core capabilities

- Authentication: login/signup/session restore/logout/password reset
- Classroom domain: create class, invite students, accept/hide invites, join by code
- Activity domain: create activities, comments/replies, submit work, grade submissions
- Portfolio domain: student and teacher activity summaries and details
- Notifications: fetch/read/delete notification workflows
- Security intake: CSP and tamper logs
- Upload serving: static access under `/uploads/activities/*`

## Route groups

- `/auth`
  - session check, profile info, account updates, verification and password reset
- `/classrooms`
  - teacher classroom lifecycle and student enrollment lifecycle
- `/activity`
  - activity retrieval + submissions + comments + instructions
- `/portfolio`
  - aggregated activity views and specific activity/submission details
- `/security`
  - CSP and tamper report ingestion
- `/showcase`
  - authenticated showcase endpoint
- `/`
  - notification and section-management endpoints from `routes/default.ts`

## Request pipeline

1. CORS policy middleware
2. Static file serving (`apps/server/public`)
3. Request logging + debug request metadata
4. JSON parser + cookie parser
5. Token normalization from cookie/query to auth header
6. Database availability check middleware
7. Domain routers (with `requireDb` + `verifyToken` where needed)
8. Global error handler

## Security model

- JWT verification in `middleware/auth.ts`
- Cookie helpers in `utils/authCookies.ts`
- Browser HTML route guard for API misuse reduction
- External redirect endpoint with allowlist validation
- Basic request logging for audit/debug support

## Upload constraints

- Accepted file types: `pdf`, `doc`, `docx`, `jpeg`, `png`
- Max upload size: 5 MB
- Stored under `apps/server/uploads/activities`

## Environment variables (server)

- `PORT`
- `CLIENT_ORIGIN`
- `ALLOWED_ORIGINS`
- `JWT_SECRET`
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME`
- `ACCENT_COLOR` (landing page)

## Diagnostics and checks

- Compile check:

```bash
cd apps/server
pnpm typecheck
```

- Dev server:

```bash
cd apps/server
pnpm dev
```

## Related docs

- `docs/ARCHITECTURE.md`
- `docs/FLOWCHART.md`
- `docs/REFACTOR_NOTES.md`

---

## API Endpoints Summary

### Authentication

- POST /auth/login
- POST /auth/signup
- POST /auth/logout
- GET /auth/session
- POST /auth/forgot-password
- POST /auth/reset-password

### Classrooms

- POST /classrooms/create
- GET /classrooms/:code
- POST /classrooms/:code/join
- GET /classrooms/:code/members
- DELETE /classrooms/:code/members/:studentId
- POST /classrooms/:code/invite

### Activities

- POST /activity/create
- GET /activity/:id
- DELETE /activity/:id
- GET /activity/classroom/:code
- POST /activity/:id/submit
- GET /activity/:id/submissions
- PATCH /activity/:id/submissions/:submissionId/score
- GET /activity/:id/my-submission
- GET /activity/:id/comments
- POST /activity/:id/comments
- DELETE /activity/:id/comments/:commentId
- POST /activity/:id/comments/:commentId/replies
- DELETE /activity/:id/comments/:commentId/replies/:replyId

### Portfolio (NEW)

- GET /api/portfolio/activities
- GET /api/portfolio/activities/:id
- GET /api/portfolio/activities/:id/submission

### Security

- GET /security/verify-invite

---

## Next small improvements

- Add a simple GET /health endpoint returning DB status and uptime.
- Add a server-side session revoke feature for stronger logout across devices.
- Add basic rate limits to sensitive endpoints (login, join, invite).
- Add pagination to portfolio activities endpoint
- Add activity type classification (quiz, assignment, project)
- Add portfolio export to PDF functionality
- Add date range filtering for portfolio
- Improve classroom, quizzes, and activities features per notes above.
