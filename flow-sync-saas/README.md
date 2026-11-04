# FlowSync CapaSolve — Industrial Production Scheduling Engine

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8.3-blue.svg?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.2.0-61dafb.svg?style=flat-square&logo=react)](https://react.dev/)
[![TanStack Start](https://img.shields.io/badge/TanStack_Start-1.168-ff4154.svg?style=flat-square)](https://tanstack.com/start)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.2.1-38bdf8.svg?style=flat-square&logo=tailwindcss)](https://tailwindcss.com/)
[![Neon Database](https://img.shields.io/badge/Neon-Serverless_PostgreSQL-00E599.svg?style=flat-square&logo=postgresql)](https://neon.tech/)
[![Vitest](https://img.shields.io/badge/Vitest-59%2F59_Passing-brightgreen.svg?style=flat-square&logo=vitest)](https://vitest.dev/)

FlowSync CapaSolve is an enterprise-grade Manufacturing Execution System (MES) and Finite Capacity Scheduling SaaS platform. Designed specifically for discrete manufacturing plants, machine shops, CNC centers, stamping, injection molding, and assembly facilities, FlowSync CapaSolve eliminates manual scheduling bottlenecks by providing sub-minute timeline dispatching, sequence-dependent setup time optimization, what-if simulations, and automated ERP CSV data reconciliation.

---

## Table of Contents

1. [Executive Summary and Capabilities](#executive-summary-and-capabilities)
2. [System Architecture](#system-architecture)
3. [Core Operational Modules](#core-operational-modules)
4. [Authentication and Team Governance (RBAC)](#authentication-and-team-governance-rbac)
5. [Step-by-Step Getting Started Guide](#step-by-step-getting-started-guide)
6. [Database Schema and Migrations](#database-schema-and-migrations)
7. [REST API and ERP Integration](#rest-api-and-erp-integration)
8. [Testing and Quality Assurance](#testing-and-quality-assurance)
9. [Production Deployment Guide](#production-deployment-guide)
10. [Troubleshooting and Operational FAQ](#troubleshooting-and-operational-faq)

---

## Executive Summary and Capabilities

Discrete manufacturing plants often face operational losses from uncoordinated tool changeovers, unexpected machine breakdowns, and outdated ERP production schedules. CapaSolve bridges the gap between top-floor ERP planning and shop-floor execution:

- **Finite Capacity Optimization**: Prevents unachievable infinite-capacity schedules by strictly enforcing workcenter machine limits and operator availability.
- **Dedicated Setter vs. Operator Modeling**: Recognizes that tool changeovers require specialized setup technicians (Setters), distinct from machine operators.
- **Sequence-Dependent Changeover Matrix**: Automatically batches compatible materials and tooling setups, reducing idle tool changeover downtime by up to 30%.
- **What-If Scenario Sandbox**: Run non-destructive simulations of machine failures, staffing cuts, overtime shifts, and rush order injections without disrupting live master dispatch.
- **ERP Data Cleaning Hub**: Intelligent fuzzy parser mapping dirty CSV/Excel exports from SAP, ProAlpha, JobBOSS, Infor, and custom legacy systems with automated unit conversion.
- **Multi-Tenant Team Management**: Built-in colleague invitation system with 7-day secure tokens, role-based access control, and self-healing organization workspace provisioning.

---

## System Architecture

```mermaid
graph TD
    User(["Plant Planner / Operator"]) -->|"HTTPS / Browser"| WebApp["TanStack Start SSR / React 19 Frontend"]
    
    subgraph Client Runtime
        WebApp -->|"Offloaded Worker"| SolverWorker["Web Worker Heuristic Solver (60 FPS)"]
        WebApp -->|"Zustand State"| Store["Client State Cache & Optimistic UI"]
    end

    subgraph Serverless Edge Backend
        WebApp -->|"Server Functions / Nitro"| ServerFn["TanStack Server Functions"]
        ServerFn -->|"REST API v1"| APIRouter["API Router /api/v1/* with API Keys"]
        ServerFn -->|"Mistral Client"| MistralAI["Mistral AI Bottleneck Diagnostics"]
    end

    subgraph Neon Cloud Infrastructure
        ServerFn -->|"SQL Connection Pool"| NeonDB[("Neon Serverless Postgres 16")]
        ServerFn -->|"S3 Protocol"| NeonS3["Neon S3 Object Storage"]
        WebApp -->|"Same-Origin Proxy /api/auth"| NeonAuth["Neon Auth / Managed Better Auth"]
        NeonAuth -.->|"Trg Sync Trigger"| NeonDB
    end
```

### Technology Stack Overview

| Layer | Technologies | Key Rationale |
| :--- | :--- | :--- |
| **Frontend Core** | [React 19](https://react.dev/), [TypeScript 5.8](https://www.typescriptlang.org/) | Concurrent rendering, type safety across entire data contract. |
| **Framework & SSR** | [TanStack Start](https://tanstack.com/start), [TanStack Router](https://tanstack.com/router), [TanStack Query](https://tanstack.com/query) | First-class fullstack server functions (`createServerFn`), type-safe route trees. |
| **Styling & UI** | [Tailwind CSS v4](https://tailwindcss.com/), [Radix UI](https://www.radix-ui.com/), [Lucide](https://lucide.dev/), [Sonner](https://sonner.emilkowal.ski/) | Zero-runtime CSS engine, accessible components, fluid micro-interactions. |
| **Database & Cloud** | [Neon Lakebase Postgres](https://neon.tech/), [`@neondatabase/serverless`](https://github.com/neondatabase/serverless) | Instant branching, serverless autoscaling, sub-10ms query times over WebSockets. |
| **Authentication** | [Neon Auth](https://neon.tech/docs/guides/neon-auth) / [Better Auth](https://www.better-auth.com/) | Google OAuth, secure session cookies (`HttpOnly`, `SameSite`), JWT validation. |
| **Object Storage** | [Neon S3-Compatible Storage](https://neon.tech/) (`@aws-sdk/client-s3`) | Storing full schedule snapshots, backups, and audit logs. |
| **Background Solver** | Web Worker ([`solver.worker.ts`](file:///d:/schedulersaas/flow-sync-saas/src/lib/solver.worker.ts)) | Offloads 10,000+ operation heuristics off the main thread. |
| **Testing Engine** | [Vitest 4.1](https://vitest.dev/), [Testing Library](https://testing-library.com/) | 59 unit tests covering schedulers, API routers, webhooks, and state stores. |

---

## Core Operational Modules

### 1. Interactive Gantt Timeline and Master Dispatch ([`/dashboard`](file:///d:/schedulersaas/flow-sync-saas/src/routes/dashboard.tsx))
- **Drag-and-Drop Dispatching**: Reschedule operations directly on the Gantt canvas with automatic collision detection and snapping.
- **Visual Distinction**: Blue run-time blocks versus amber tool setup blocks allow planners to immediately spot changeover overheads.
- **Timeline Zoom Levels**: Seamless toggles between Day, Week, and Month granularities.
- **Machine Group Collapsing**: Group machines by production cells (such as CNC Milling, 5-Axis Turning, Injection Molding, or Manual Assembly).

### 2. Finite Capacity and Workcenter Controls ([`/capacity`](file:///d:/schedulersaas/flow-sync-saas/src/routes/capacity.tsx))
- **Daily Capacity Ceilings**: Set operational hours per day (for example, 16h double shift versus 24h continuous).
- **Technician vs. Operator Staffing**: Configure maximum concurrent setup technicians to prevent scheduling more tool changes than available plant staff can handle.
- **Overtime and Shift Overrides**: Apply temporary extra shifts to specific workstations to eliminate delivery bottlenecks.

### 3. Sequence-Dependent Setup Matrix ([`/settings`](file:///d:/schedulersaas/flow-sync-saas/src/routes/settings.tsx))
- **Changeover Rules**: Specify transition penalties when switching between materials (for example, Steel 316 to Aluminum 6061 requires 45 min cleanout; Steel 316 to Steel 304 requires only 10 min).
- **Wildcard Matching**: Default fallbacks (`*` to `*`) ensure deterministic setup estimations for novel parts.
- **Batching Heuristics**: The scheduler automatically arranges work orders in queue to minimize total setup downtime.

### 4. What-If Scenario Lab ([`/sandbox`](file:///d:/schedulersaas/flow-sync-saas/src/routes/sandbox.tsx))
- **Zero-Risk Simulation**: An isolated clone of the master schedule allowing planners to stress-test scenarios before committing to production:
  - Machine Breakdown: Select a machine and downtime window; observe the engine rerouting operations to secondary machines.
  - Staffing Shortage: Reduce setter availability and observe the impact on completion dates.
  - Rush Order Insertion: Fast-track VIP customer work orders and inspect the pre-emption penalty on standard orders.
- **One-Click Commit**: Apply the simulated schedule directly to master production if the results meet plant targets.

### 5. ERP Data Cleaning Hub ([`/orders`](file:///d:/schedulersaas/flow-sync-saas/src/routes/orders.tsx))
- **Auto-Column Mapping**: Automatically maps headers like Auftrag, Fertigungsauftrag, Work Order, Machine, Maschine, Dauer, and Setup Time.
- **Anomaly Detection**: Highlights negative cycle times, missing material references, invalid date formats, and duplicate operation sequences.
- **One-Click Corrections**: Batch fix dirty datasets before submitting them to the scheduling solver.

### 6. Shop Floor MES Execution and OEE Tracking
- **Work Order Status**: Real-time transitions: Pending to In-Progress to Hold to Completed.
- **Scrap Logging**: Record defect counts with standard reason codes (Tool Wear, Material Flaw, Operator Error, Power Outage).
- **OEE Metrics**: Computes Availability, Performance, and Quality yield rates.

### 7. Industrial AI Bottleneck Copilot
- **Mistral AI Integration**: Analyzes machine workloads and operation timelines to generate natural-language explanations of plant bottlenecks.
- **Offline Heuristic Fallback**: Continues providing actionable recommendations even if external AI APIs are unreachable.

---

## Authentication and Team Governance (RBAC)

CapaSolve features a multi-tenant authentication and team invitation architecture:

```
┌───────────────────────────────────────────────────────────┐
│                     Plant Administrator                   │
│             (Full Access & Organization Billing)          │
└──────────────┬─────────────────────────────┬──────────────┘
               │                             │
               ▼                             ▼
┌───────────────────────────────┐  ┌─────────────────────────┐
│     Planner / Developer       │  │    Floor Operator       │
│  (Schedules, Matrix, AI Labs) │  │  (View Only & MES Exec) │
└───────────────────────────────┘  └─────────────────────────┘
```

### User Roles and Permissions

| Role | Permissions | Typical User |
| :--- | :--- | :--- |
| **`ADMIN`** | Full plant access, organization settings, team member invitations, member removal, plan upgrades, system backups. | Plant Manager, Operations Director |
| **`DEVELOPER`** | Schedule optimization, scenario sandbox, setup matrix configuration, CSV ingestion, what-if simulations. | Production Planner, Industrial Engineer |
| **`GUEST`** | View-only dashboard access, shop-floor execution reporting (complete operations, log scrap units). | Machine Operator, Quality Inspector |

### Colleague Invitation Workflow
1. Plant Administrator navigates to **Settings -> Team Members & Plant Access**.
2. Enters colleague email (`planner@factory.com`) and selects assigned role.
3. CapaSolve generates a cryptographically secure token (`inv_...`) stored in `public.invitations` with a 7-day expiration.
4. Generates an instant share link (`https://app.capasolve.com/signup?invite=TOKEN`) with a **Copy Link** button.
5. When the colleague opens the link:
   - Organization name and role are locked to the inviter's workspace.
   - Colleague signs up via **Email/Password** or **Google OAuth**.
   - The user is automatically attached to the company workspace without creating duplicate organizations.

### Cross-Domain Cookie Proxy and OAuth Reconciler
- In local development (`localhost:5173`) and custom production domains, third-party cookies from remote auth providers can be blocked by browser privacy policies.
- CapaSolve resolves this with:
  1. **Vite Same-Origin Proxy**: `/api/auth` proxies directly to the Neon Auth server with `changeOrigin: true` and `cookieDomainRewrite: ""`.
  2. **Server-Side Session Fallback** ([`auth.server.ts`](file:///d:/schedulersaas/flow-sync-saas/src/lib/auth.server.ts)): If browser cookies are suppressed, `verifyOAuthCallbackServerFn` verifies the freshly created session directly from `neon_auth.session` in Postgres and reconciles it immediately.

---

## Step-by-Step Getting Started Guide

### 1. Prerequisites
- **Node.js**: `v20.x` or `v22.x` (LTS recommended)
- **Package Manager**: `npm` (bundled with Node) or `pnpm`
- **Neon Account**: Serverless Postgres database from [neon.tech](https://neon.tech)

### 2. Clone and Install
```bash
git clone https://github.com/rajeetcodeN/CapaSolve.git
cd CapaSolve/flow-sync-saas
npm install
```

### 3. Environment Variable Setup
Copy the environment template:
```bash
cp .env.example .env
```

Open `.env` and fill in your Neon credentials:

```ini
# Neon Lakebase Database (Serverless Driver)
DATABASE_URL="postgresql://neondb_owner:YOUR_PASSWORD@ep-hidden-fog-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require"
DATABASE_URL_UNPOOLED="postgresql://neondb_owner:YOUR_PASSWORD@ep-hidden-fog.us-east-2.aws.neon.tech/neondb?sslmode=require"
NEON_BRANCH=production

# Neon Auth Service
NEON_AUTH_BASE_URL=https://ep-hidden-fog.neonauth.us-east-2.aws.neon.tech/neondb/auth
NEON_AUTH_JWKS_URL=https://ep-hidden-fog.neonauth.us-east-2.aws.neon.tech/neondb/auth/.well-known/jwks.json

# Neon S3-Compatible Object Storage
AWS_ACCESS_KEY_ID=your-neon-storage-access-key
AWS_SECRET_ACCESS_KEY=your-neon-storage-secret-key
AWS_ENDPOINT_URL_S3=https://br-branch-id.storage.us-east-2.aws.neon.tech
AWS_REGION=us-east-2
NEON_BUCKET_NAME=assets

# Client-Side Exposed Environment (Vite)
VITE_DATABASE_URL="postgresql://neondb_owner:YOUR_PASSWORD@ep-hidden-fog-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require"
VITE_NEON_AUTH_BASE_URL=https://ep-hidden-fog.neonauth.us-east-2.aws.neon.tech/neondb/auth
VITE_AWS_ENDPOINT_URL_S3=https://br-branch-id.storage.us-east-2.aws.neon.tech
VITE_AWS_REGION=us-east-2
VITE_NEON_BUCKET_NAME=assets

# Mistral AI (Kept secure on server)
MISTRAL_API_KEY=your-mistral-api-key
MISTRAL_MODEL=mistral-small-latest

# Application Runtime Configuration
NODE_ENV=development
```

### 4. Run Database Migrations
Synchronize all required tables, triggers, and foreign keys into Neon Postgres:
```bash
npm run db:migrate
# Or directly: node --env-file=.env scripts/migrate-neon.mjs
```

### 5. Launch Development Server
```bash
npm run dev
```
Navigate to [http://localhost:5173](http://localhost:5173). The application will launch with full hot-module reloading (HMR).

---

## Database Schema and Migrations

CapaSolve runs on a multi-schema Neon PostgreSQL architecture:
- **`neon_auth` Schema**: Managed by Neon Auth (Better Auth) containing `user`, `session`, `account`, and `verification`.
- **`public` Schema**: Application tables containing `organizations`, `organization_members`, `profiles`, `schedules`, `schedule_data`, `machines`, `machine_groups`, `invitations`, `setup_matrix_rules`, and `api_keys`.
- **Automated Sync Trigger (`trg_sync_neon_auth_user`)**: Mirrors new Neon Auth accounts into `auth.users` and `public.profiles` automatically, guaranteeing foreign key consistency with cascading updates and deletes.

### Running Schema Updates
To run or re-apply schema migrations:
```bash
npm run db:migrate
# Or directly: node --env-file=.env scripts/migrate-neon.mjs
```

---

## REST API and ERP Integration

CapaSolve exposes authenticated REST APIs under `/api/v1/*` for automated bi-directional synchronization with SAP, Oracle, Microsoft Dynamics, JobBOSS, or custom MES:

### Authentication
Authenticate requests by passing an Enterprise API key in the `Authorization` or `X-API-Key` header:
```http
Authorization: Bearer cap_live_9f83b2a1c0d4...
```

### Endpoints Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/v1/schedules/solve` | Dispatches orders through the solver engine and returns optimized timeline slots. |
| `GET` | `/api/v1/orders` | Retrieves active work orders in the queue. |
| `POST` | `/api/v1/orders` | Ingests new work orders directly from ERP. |
| `DELETE` | `/api/v1/orders/:id` | Cancels or archives a work order. |
| `GET` | `/api/v1/machines` | Returns current machine registry and utilization stats. |
| `POST` | `/api/v1/webhooks/erp` | Ingests real-time ERP production updates. |

---

## Testing and Quality Assurance

CapaSolve maintains strict quality controls with 100% test pass rates and zero TypeScript errors:

| Check | Command | Description |
| :--- | :--- | :--- |
| **Unit and Integration Tests** | `npm run test` | Runs 59 Vitest tests covering solver heuristics, API routers, data cleaning, and stores. |
| **Watch Mode** | `npm run test:watch` | Runs tests interactively during development. |
| **Static Typecheck** | `npm run typecheck` | Compiles entire project with `tsc --noEmit` to verify type safety. |
| **Linting** | `npm run lint` | Runs ESLint 9 checks. |
| **Code Formatting** | `npm run format` | Enforces Prettier formatting rules across all files. |

---

## Production Deployment Guide

CapaSolve is optimized for serverless deployment on **Vercel** via the Nitro Vercel preset (`preset: "vercel"` in [`vite.config.ts`](file:///d:/schedulersaas/flow-sync-saas/vite.config.ts)).

### Deploying to Vercel
1. Push your code to GitHub.
2. Log in to [Vercel](https://vercel.com) and click **Add New Project**.
3. Import your CapaSolve repository.
4. Set **Root Directory** to `flow-sync-saas`.
5. Under **Environment Variables**, paste all production values from your `.env` file.
6. Click **Deploy**. Vercel will run `vite build`, producing serverless functions in `.vercel/output`.

### Neon Console Configuration Checklist
1. Open your project on [console.neon.tech](https://console.neon.tech).
2. Go to **Auth -> Settings -> Domains**.
3. Add your production domain:
   - Example: `https://app.capasolve.com`
   - For local testing: `http://localhost:5173`
4. Under **OAuth Providers**, ensure **Google** is enabled with authorized redirect URIs.

---

## Troubleshooting and Operational FAQ

### Q: Why did Google sign-in fail with "Unable to verify an active user session"?
**A**: Ensure your origin is whitelisted in the Neon Console under **Auth -> Domains** (such as `http://localhost:5173`). CapaSolve also includes `verifyOAuthCallbackServerFn` in [`auth.server.ts`](file:///d:/schedulersaas/flow-sync-saas/src/lib/auth.server.ts) to automatically reconcile the session directly from Neon Postgres if third-party cookies are partitioned by your browser.

### Q: How do I invite a colleague who does not have an account yet?
**A**: Go to **Settings -> Team Members & Plant Access**, enter their email, choose a role (`DEVELOPER` or `GUEST`), and click **Create Invite**. Send them the generated invite link. When they sign up, their account automatically binds to your plant organization without creating a separate company.

### Q: How can I backup and restore my scheduling matrix and work order state?
**A**: Go to **Settings -> Backup & Restore**. Click **Download System Backup** to export a JSON snapshot. You can restore this file at any time to recover the full schedule state.

---

## License and Intellectual Property

Copyright (c) 2026 Digital Biz Tech. All Rights Reserved.  
Proprietary software designed for industrial finite capacity scheduling and shop-floor execution.
