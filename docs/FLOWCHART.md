# Digital Portfolio Flowcharts

This file contains Mermaid diagrams for the most important backend and app flows.

## 1. Authentication and session restore

```mermaid
flowchart TD
  A[User opens app] --> B{Has cookie token?}
  B -- No --> C[Show public auth page]
  B -- Yes --> D[GET /auth/session]

  D --> E{Token valid + user exists?}
  E -- No --> F[Clear auth state]
  F --> C
  E -- Yes --> G[Set authenticated user]
  G --> H[Set tabAuth in sessionStorage]
  H --> I[Enter protected routes]

  I --> J{Navigation event: popstate/pageshow/focus}
  J --> K{tabAuth exists?}
  K -- No --> L[Force redirect to /login]
  K -- Yes --> M[Re-check /auth/session]
  M --> E
```

## 2. Classroom invite and join flow

```mermaid
flowchart TD
  T[Teacher] --> A[POST /classrooms/:code/invite]
  A --> B{Student already invited/member?}
  B -- Yes --> C[409 conflict]
  B -- No --> D[Insert pending classroom_members]
  D --> E[Create invite notification]
  E --> F[Student sees invite]

  F --> G{Student action}
  G -- Accept invite --> H[POST /classrooms/invites/:inviteId/accept]
  G -- Join by code --> I[POST /classrooms/join]

  H --> J[Set membership accepted]
  I --> K{Pending invite exists?}
  K -- Yes --> J
  K -- No --> L[Insert accepted membership]

  J --> M[Cleanup hidden invite rows]
  L --> M
  M --> N[Student gains classroom access]
```

## 3. Activity submission and grading flow

```mermaid
flowchart TD
  S[Student opens activity] --> A[GET /activity/:id]
  A --> B{Authorized member?}
  B -- No --> C[403 forbidden]
  B -- Yes --> D[View instructions + details]

  D --> E[POST /activity/:id/submit with file]
  E --> F{File valid type + <= 5MB?}
  F -- No --> G[Validation error]
  F -- Yes --> H[Create or update submission]
  H --> I[Submission visible to teacher]

  T[Teacher opens submissions] --> J[GET /activity/:id/submissions]
  J --> K[Review student entries]
  K --> L[PATCH /activity/:id/submissions/:submissionId/score]
  L --> M[Persist score + graded_at]
  M --> N[Student portfolio status becomes graded]
```

## 4. Backend HTTP pipeline

```mermaid
flowchart LR
  A[Incoming request] --> B[CORS policy]
  B --> C[Request logger]
  C --> D[JSON + cookie parser]
  D --> E[Token normalization]
  E --> F[DB availability check]
  F --> G[Router + requireDb guard]
  G --> H[Controller]
  H --> I[Response]
  H --> J[Global error handler]
```
