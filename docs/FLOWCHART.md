# Digital Portfolio Flowcharts

This file documents end-to-end system flows for the current monorepo (`apps/web` + `apps/server`).

## 1. High-level system flow

```mermaid
flowchart LR
  U[User Browser] --> W[Web App: apps/web]
  W -->|Cookie auth calls| S[API Server: apps/server]
  S -->|Supabase mode| SB[(Supabase)]
  S -->|MySQL mode| DB[(MySQL)]
  S --> N[(Notifications)]
  W --> P[Protected screens: Home Dash Admin Activity Portfolio]
```

## 2. Web route + protected route flow

```mermaid
flowchart TD
  A[Open route in web app] --> B{Public route?}
  B -- Yes --> C[Render Login Signup Forgot RoleSelect]
  B -- No --> D[ProtectedRoute calls GET /auth/session]

  D --> E{Session success?}
  E -- No --> F[Show Unauthorized message]
  F --> G[Redirect to /login]
  E -- Yes --> H[Render protected screen]

  H --> I{Route target}
  I --> J[/home or /dash]
  I --> K[/admin]
  I --> L[/join or /create]
  I --> M[/activity/:id/view]
  I --> N[/portfolio]
```

## 3. Authentication lifecycle

```mermaid
flowchart TD
  A[User submits login signup verify reset] --> B[/auth endpoints]
  B --> C[Controller validates payload]
  C --> D{Valid credentials / code?}
  D -- No --> E[Error response]
  D -- Yes --> F[Generate JWT]
  F --> G[Set httpOnly auth cookie]
  G --> H[Client stores minimal user state]
  H --> I[Subsequent GET /auth/session checks]
  I --> J{Cookie still valid?}
  J -- Yes --> K[Keep authenticated]
  J -- No --> L[Clear local auth + force login]
```

## 4. Server request pipeline

```mermaid
flowchart TD
  A[Incoming HTTP request] --> B[createCorsPolicy]
  B --> C[requestLogger]
  C --> D[json parser + cookieParser]
  D --> E[requestDebugLogger]
  E --> F[normalizeTokenSource]
  F --> G{Supabase only mode?}
  G -- Yes --> H[Route handlers]
  G -- No --> I[checkDbAvailability]
  I --> J[requireDb-protected routes]
  J --> H
  H --> K[Controller]
  K --> L[JSON/redirect/static response]
  K --> M[Global error handler]
```

## 5. Classroom lifecycle

```mermaid
flowchart TD
  T[Teacher] --> A[Create classroom]
  A --> B[Classroom code generated]
  B --> C[Invite students]
  C --> D[Notification created]

  S[Student] --> E{Join path}
  E -- Invite accept --> F[Accept invitation]
  E -- Class code --> G[Join by code]

  F --> H[Membership set accepted]
  G --> I{Pending invite exists?}
  I -- Yes --> H
  I -- No --> J[Create accepted membership]

  H --> K[Student appears in classroom roster]
  J --> K
```

## 6. Activity lifecycle (teacher + student)

```mermaid
flowchart TD
  T[Teacher] --> A[Create activity]
  A --> B[Optional file upload]
  B --> C[Instructions / due date / max score]

  S[Student] --> D[Open activity view]
  D --> E{Authorized classroom member?}
  E -- No --> F[403/404]
  E -- Yes --> G[View activity + comments + submission state]

  G --> H[Submit activity file]
  H --> I{File type and size valid?}
  I -- No --> J[Validation error]
  I -- Yes --> K[Insert or update submission]

  T --> L[Open submissions]
  L --> M[Score submission]
  M --> N[Persist grade + graded metadata]
  N --> O[Student sees updated portfolio status]
```

## 7. Notifications flow

```mermaid
flowchart TD
  A[System event invite grade message] --> B[Insert notification]
  B --> C[Client fetches GET /notifications]
  C --> D[Render notification bell/menu]

  D --> E{User action}
  E -- Single read --> F[POST /notifications/:id/read]
  E -- Batch read --> G[POST /notifications/read-batch]
  E -- Mark all --> H[POST /notifications/mark-all-read]
  E -- Delete selected --> I[DELETE /notifications/delete-batch]
  E -- Delete all --> J[DELETE /notifications/delete-all]
```

## 8. Admin management flow

```mermaid
flowchart TD
  A[Teacher opens /admin] --> B[GET /auth/session]
  B --> C{isAdmin true?}
  C -- No --> D[Access denied in UI/API]
  C -- Yes --> E[Load admin student table]

  E --> F[GET /admin/students]
  F --> G[List students + online status]

  G --> H{Admin edit action}
  H --> I[PATCH student number]
  H --> J[PATCH section]
  H --> K[PATCH email]

  I --> L[Persist + refresh list]
  J --> L
  K --> L
```

## 9. Security/tamper reporting flow

```mermaid
flowchart TD
  A[Client detects tamper/security event] --> B[POST /security/tamper-log]
  B --> C[Server validates and records event]
  C --> D[Return success/failure]
  D --> E[Client may force logout if required]
```
