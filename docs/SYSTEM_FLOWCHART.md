# Digital Portfolio System - Architectural Flowchart

This document provides a comprehensive overview of the system architecture, detailing the interaction between the frontend, backend, and the hybrid database layer.

## System Overview

The Digital Portfolio System is built on a **monorepo architecture** using **Turborepo**, separating the concerns into a Next.js frontend (`apps/web`), an Express backend (`apps/server`), and shared contracts (`packages/contracts`). The system is designed with a **Hybrid Persistence Layer**, supporting both **Supabase (Cloud)** and **MySQL (Local/Remote)**.

```mermaid
graph TB
    %% --- Client Layer ---
    subgraph Client_Layer [Frontend: Next.js / React]
        direction TB
        UI[User Interface - React Components]
        Contexts[Auth / Theme Contexts]
        Hooks[Custom React Hooks]
        APILib[lib/api.ts - fetch wrapper]
        
        UI --> Contexts
        UI --> Hooks
        Hooks --> APILib
        Contexts --> APILib
    end

    %% --- Transport Layer ---
    subgraph Transport_Layer [HTTP/HTTPS Protocol]
        direction LR
        JSON[JSON Payloads]
        Cookies[httpOnly Secure Cookies / JWT]
        JSON <--> Cookies
    end
    
    APILib <==> Transport_Layer

    %% --- Backend Layer ---
    subgraph Backend_Layer [Backend: Express / Node.js]
        direction TB
        Entry[app.ts / api/index.ts]
        Middleware{Middleware Chain}
        Routes[Express Router]
        Controllers[Business Logic / Controllers]
        
        subgraph Middleware_Details [Middleware Components]
            CORS[CORS Policy]
            Logging[Request Logging]
            TokenNorm[Token Normalization]
            AuthGuard[JWT / Session Verification]
            DBCheck[Database Availability Check]
        end

        Entry --> Middleware
        Middleware --> Middleware_Details
        Middleware_Details --> Routes
        Routes --> Controllers
    end

    Transport_Layer <==> Entry

    %% --- Database Logic ---
    subgraph Database_Logic [Database Provider Selector]
        direction TB
        Config[db.isSupabaseOnlyMode()]
        Branch{Provider?}
        
        Controllers --> Config
        Config --> Branch
    end

    %% --- Persistence Layer ---
    subgraph Persistence_Layer [Persistence / Storage]
        direction LR
        subgraph Supabase_Stack [Supabase Provider]
            SBClient[Supabase JS Client]
            SBCloud[Supabase Cloud PostgreSQL]
            SBClient <--> SBCloud
        end
        
        subgraph MySQL_Stack [MySQL Provider]
            Pool[mysql2 Connection Pool]
            MySQLDB[MySQL Instance]
            Pool <--> MySQLDB
        end
    end

    Branch -- "true" --> Supabase_Stack
    Branch -- "false" --> MySQL_Stack

    %% --- Styles ---
    classDef client fill:#e1f5fe,stroke:#01579b,stroke-width:2px;
    classDef server fill:#fff3e0,stroke:#e65100,stroke-width:2px;
    classDef db fill:#e8f5e9,stroke:#1b5e20,stroke-width:2px;
    classDef trans fill:#f3e5f5,stroke:#4a148c,stroke-width:1px,stroke-dasharray: 5 5;

    class UI,Contexts,Hooks,APILib client;
    class Entry,Middleware,Routes,Controllers,Middleware_Details,CORS,Logging,TokenNorm,AuthGuard,DBCheck server;
    class SBClient,SBCloud,Pool,MySQLDB db;
    class Transport_Layer,JSON,Cookies trans;
```

## Logic and Process Flow

### 1. Request Lifecycle
When a user performs an action (e.g., submitting an activity), the following process occurs:
1. **Frontend**: The React component calls a custom hook (e.g., `useActivity`).
2. **API Wrapper**: `apiFetch` in `lib/api.ts` attaches the necessary `httpOnly` cookies and formats the body as JSON.
3. **Server Entry**: Express receives the request. The **CORS** middleware validates the origin.
4. **Middleware**: 
    - **Token Normalization** ensures the JWT is extracted from either cookies or the `Authorization` header.
    - **AuthGuard** verifies the JWT signature and attaches the user identity to the request object.
    - **DBCheck** (if in MySQL mode) verifies the connection pool is healthy.
5. **Routing**: The request is routed to the specific controller based on the URL (e.g., `/activity`).
6. **Controller Branching**: The controller checks the `SUPABASE_ONLY` flag:
    - If `true`: Invokes logic using `getSupabaseClient()`.
    - If `false`: Invokes logic using the MySQL `pool.execute()`.
7. **Response**: The result is serialized to JSON and sent back through the middleware chain to the client.

### 2. Database Synchronization & Selection
The system employs a unique dual-provider strategy:
- **MySQL Mode**: Used for local development or traditional hosting. Includes automatic failover from remote to local host if configured.
- **Supabase Mode**: Optimized for serverless environments (Vercel) and rapid scaling. Utilizes the Supabase Service Role for administrative bypass where necessary.

### 3. Security Model
- **Authentication**: JWT-based, stored in `httpOnly` cookies to prevent XSS (Cross-Site Scripting) attacks.
- **Redirection Guard**: `browserHtmlRedirectGuard` prevents users from directly accessing API endpoints via the browser URL bar, redirecting them back to the frontend.
- **Validation**: Input validation is handled via specialized middleware or zod schemas (in Supabase mode).
