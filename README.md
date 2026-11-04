# CapaSolve — Industrial Production Scheduling and Capacity Planning SaaS

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.2-61dafb.svg?style=flat-square&logo=react)](https://react.dev/)
[![TanStack Start](https://img.shields.io/badge/TanStack_Start-1.168-ff4154.svg?style=flat-square)](https://tanstack.com/start)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.2-38bdf8.svg?style=flat-square&logo=tailwindcss)](https://tailwindcss.com/)
[![Neon Database](https://img.shields.io/badge/Neon-Serverless_PostgreSQL_%26_Auth-00E599.svg?style=flat-square&logo=postgresql)](https://neon.tech/)
[![Vitest](https://img.shields.io/badge/Vitest-59%2F59_Passing-brightgreen.svg?style=flat-square&logo=vitest)](https://vitest.dev/)

CapaSolve is an advanced, full-stack Manufacturing Execution and Finite Capacity Scheduling SaaS platform. It enables discrete manufacturers, machine shops, CNC centers, and industrial plants to ingest ERP work orders, clean dirty production data, simulate bottleneck scenarios, optimize machine schedules, and dispatch shop-floor operations with sub-minute precision.

---

## Table of Contents

- [Key Capabilities and Modules](#key-capabilities-and-modules)
- [System Architecture](#system-architecture)
- [Technology Stack](#technology-stack)
- [Repository Structure](#repository-structure)
- [Quick Start Guide](#quick-start-guide)
- [Environment Configuration](#environment-configuration)
- [Database Schema and Migrations](#database-schema-and-migrations)
- [Team Management and Invitations](#team-management-and-invitations)
- [REST API Reference](#rest-api-reference)
- [Architecture Deep-Dive](docs/code_architecture.md)
- [Production Deployment](#production-deployment)
- [Security Architecture](#security-architecture)

---

## Key Capabilities and Modules

### 1. Finite Capacity Scheduling Engine
- **Heuristic Optimization Modes**: Full optimization, Pre-scheduling, and Workstation-level scheduling.
- **Resource Constraints**: Distinct modeling for **dedicated setup technicians (Setters)** vs. **machine operators**, preventing over-utilization during tool changeovers.
- **SOP Deadline Adherence**: Automatic preponement window calculations and late order flags.
- **Sequence Dependencies**: Enforces strict operation ordering ($10 \rightarrow 20 \rightarrow 30$) while allowing concurrent non-conflicting machine lines.

### 2. Industrial AI Assistant and What-If Simulations
- **Root Cause and Bottleneck Diagnostics**: Powered by Mistral AI via secure server functions (`createServerFn`), with automatic fallback to an offline heuristic analyzer.
- **Dynamic Scenario Simulations**:
  - Unplanned Machine Breakdown (downtime shift and rerouting).
  - Staffing Shortage (automatic switch to Operator Self-Setup mode).
  - Rush Order Insertion (pre-emption and priority fast-tracking).
  - Shift and Overtime Extensions.

### 3. Visual Timeline and Interactive Gantt Chart
- Drag-and-drop interactive dispatching with real-time collision detection.
- Multi-machine group views with day, week, and monthly zoom granularities.
- Work center capacity heatmaps and bottleneck indicators.

### 4. ERP Data Cleaning and Ingestion Hub
- Intelligent CSV and Excel format parser with auto-column mapping (supports SAP, ProAlpha, JobBOSS, Infor, and custom ERP exports).
- Multi-language column header detection (English and German manufacturing terms).
- Real-time validation checks for negative cycle times, missing materials, and duplicate process steps.

### 5. Setup Changeover Matrix
- Sequence-dependent changeover rules based on material and tooling transitions.
- Minimizes non-productive setup downtime by batching compatible work orders.

### 6. Shop Floor Execution and OEE Tracking
- Work order execution logging: actual completed units vs. defect/scrap units.
- Actual setup and runtime recording to compute true **Overall Equipment Effectiveness (OEE)**.

---

## System Architecture

```mermaid
graph TD
    User(["Factory Planner / Operator"]) -->|"HTTPS / Browser"| WebApp["TanStack Start SSR Frontend"]
    WebApp -->|"Zustand & WebWorker"| LocalSolver["Client Heuristic Scheduler (60 FPS)"]
    WebApp -->|"Server Functions"| ServerAPI["Nitro Serverless Backend"]
    ServerAPI -->|"Secure Server AI"| MistralAI["Mistral AI API"]
    ServerAPI -->|"S3 Protocol"| NeonS3["Neon S3 Object Storage"]
    ServerAPI -->|"Multi-Tenant Postgres"| NeonDB[("Neon Serverless PostgreSQL")]
    WebApp -->|"Proxy /api/auth"| NeonAuth["Neon Auth / Better Auth"]
    ExternalERP["External ERP / MES"] -->|"REST API v1"| APIRouter["API Router /api/v1/*"]
    APIRouter --> NeonDB
```

---

## Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend Framework** | [React 19](https://react.dev/), [TanStack Start](https://tanstack.com/start), [TanStack Router](https://tanstack.com/router), [TanStack Query](https://tanstack.com/query) |
| **Styling and Components**| [Tailwind CSS v4](https://tailwindcss.com/), [Radix UI](https://www.radix-ui.com/), [Lucide Icons](https://lucide.dev/), [Sonner](https://sonner.emilkowal.ski/) |
| **Data and State** | [Zustand](https://github.com/pmndrs/zustand), [PapaParse](https://www.papaparse.com/), [Date-fns](https://date-fns.org/) |
| **Server and Bundling** | [Vite 7](https://vitejs.dev/), [Nitro Serverless](https://nitro.unjs.io/) |
| **Backend and DB** | [Neon](https://neon.tech/) (PostgreSQL 16, Autoscaling Serverless Driver, Auth, S3-Compatible Storage) |
| **AI Integration** | [Mistral AI](https://mistral.ai/) via secure server-side execution |
| **Testing** | [Vitest 4.1](https://vitest.dev/) (59 unit tests passing) |

---

## Repository Structure

```
CapaSolve/
├── docs/
│   └── code_architecture.md                           # Comprehensive scheduler & system architecture guide
├── capasolve/                                         # Main Fullstack Web Application Workspace
│   ├── datasets/                                      # Realistic discrete manufacturing CSV sample datasets
│   ├── scripts/
│   │   ├── migrate-neon.mjs                           # Automated DB migration and trigger runner
│   │   ├── deep-functional-tests.mjs                  # Deep functional integration test suite
│   │   └── test-neon-services.mjs                     # Neon Cloud service verification
│   ├── src/
│   │   ├── api/                                       # REST API endpoints (/api/v1/*)
│   │   │   ├── capacity/                              # Workstation capacity APIs
│   │   │   ├── machines/                              # Machine group registry APIs
│   │   │   ├── schedules/                             # Solve and dispatch APIs
│   │   │   └── router.ts                              # API key middleware and rate limiter
│   │   ├── components/                                # Reusable UI, Gantt, and Modal components
│   │   │   ├── modals/                                # Work order, scrap, and simulation modals
│   │   │   ├── ui/                                    # Radix UI component primitives
│   │   │   ├── AppLayout.tsx                          # Dashboard navigation shell
│   │   │   ├── TeamManagement.tsx                     # Team members and invitation interface
│   │   │   ├── DataCleaningHub.tsx                    # ERP CSV transformation interface
│   │   │   ├── GanttTimelineView.tsx                  # Interactive timeline canvas
│   │   │   └── ThemeProvider.tsx                      # Light / Dark theme controller
│   │   ├── lib/                                       # Core Business Logic and Solvers
│   │   │   ├── auth-service.ts                        # Auth session and profile management
│   │   │   ├── auth.server.ts                         # Server-side OAuth session reconciler
│   │   │   ├── neon-auth.ts                           # Neon Auth / Better Auth client
│   │   │   ├── neon.ts                                # Serverless SQL client and queries
│   │   │   ├── dataCleaner.ts                         # Heuristic CSV anomaly cleaner
│   │   │   ├── scheduler.ts                           # Finite capacity scheduling algorithms
│   │   │   ├── solver.worker.ts                       # Web Worker for non-blocking solving
│   │   │   └── store.ts                               # Global Zustand application store
│   │   ├── routes/                                    # TanStack Router file-based routes
│   │   │   ├── __root.tsx                             # Root shell and auth guards
│   │   │   ├── login.tsx                              # Sign In (Password and Google OAuth)
│   │   │   ├── signup.tsx                             # Plant signup and invite onboarding
│   │   │   ├── forgot-password.tsx                    # Native password reset request
│   │   │   ├── reset-password.tsx                     # Password update confirmation
│   │   │   ├── auth.callback.tsx                      # Google OAuth callback handler
│   │   │   ├── dashboard.tsx                          # Main KPIs and schedule workspace
│   │   │   ├── capacity.tsx                           # Machine utilization and workcenter loads
│   │   │   ├── monthly.tsx                            # Monthly master calendar
│   │   │   ├── pivot.tsx                              # Multi-dimensional analytics pivot
│   │   │   ├── sandbox.tsx                            # What-If scenario simulation lab
│   │   │   └── settings.tsx                           # Company profile, setup matrix, team
│   │   ├── styles.css                                 # Tailwind CSS tokens
│   │   └── server.ts                                  # Nitro SSR production entrypoint
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts                                 # Production Vite + Nitro build config
└── README.md
```

---

## Quick Start Guide

### Prerequisites
- **Node.js**: v20.0.0 or higher
- **Package Manager**: `npm` or `pnpm`
- **Neon Postgres Account**: [neon.tech](https://neon.tech)

### 1. Clone the Repository
```bash
git clone https://github.com/rajeetcodeN/CapaSolve.git
cd CapaSolve/capasolve
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Populate your Neon connection string, Neon Auth URL, and Mistral API key (see [Environment Configuration](#environment-configuration)).

### 4. Run Database Migrations
```bash
npm run db:migrate
```

### 5. Run Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Environment Configuration

Create `.env` in `capasolve/`:

```ini
# Neon Database Connection
DATABASE_URL="postgresql://neondb_owner:password@ep-hidden-fog-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require"
DATABASE_URL_UNPOOLED="postgresql://neondb_owner:password@ep-hidden-fog.us-east-2.aws.neon.tech/neondb?sslmode=require"
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
VITE_DATABASE_URL="postgresql://neondb_owner:password@ep-hidden-fog-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require"
VITE_NEON_AUTH_BASE_URL=https://ep-hidden-fog.neonauth.us-east-2.aws.neon.tech/neondb/auth
VITE_AWS_ENDPOINT_URL_S3=https://br-branch-id.storage.us-east-2.aws.neon.tech
VITE_AWS_REGION=us-east-2
VITE_NEON_BUCKET_NAME=assets

# Mistral AI (Server-side secret)
MISTRAL_API_KEY=your-mistral-api-key
MISTRAL_MODEL=mistral-small-latest

# Environment
NODE_ENV=development
```

---

## Database Schema and Migrations

CapaSolve runs on Neon Serverless Postgres with automatic foreign key cascades and triggers:
- **`neon_auth`**: Better Auth managed schema for users, accounts, sessions.
- **`public`**: Multi-tenant organizations, members, schedules, machine master data, and sequence changeover matrices.
- **Triggers**: `trg_sync_neon_auth_user` automatically synchronizes new auth users to `auth.users` and `public.profiles`.

Run all migrations with:
```bash
npm run db:migrate
# Or directly: node --env-file=.env scripts/migrate-neon.mjs
```

---

## Team Management and Invitations

- **Admin Controls**: Plant Admins can invite team members via **Settings -> Team Members & Plant Access**.
- **Role Assignment**: Assign `ADMIN` (Full Access), `DEVELOPER` (Planner/Scheduler), or `GUEST` (Floor Operator).
- **Secure Token Links**: Invitations generate a 7-day token link with a single-click clipboard copying button.
- **Seamless Acceptance**: Colleagues accept invitations via Email/Password or Google OAuth, automatically joining the existing plant organization without creating duplicate tenants.

---

## REST API Reference

The backend provides authenticated REST API endpoints for external ERP/MES integrations:

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/v1/schedules/solve` | Dispatches orders through the solver engine and returns optimized timeline slots. |
| `GET` | `/api/v1/orders` | Retrieves active work orders in queue. |
| `POST` | `/api/v1/orders` | Ingests new work orders into the queue. |
| `DELETE` | `/api/v1/orders/:id` | Cancels or removes an active work order. |
| `GET` | `/api/v1/machines` | Returns registered machines and current utilization. |

**Authentication Header**:
```http
Authorization: Bearer cap_live_your_api_key_here
```

---

## Production Deployment

### Building for Production
```bash
npm run build
```
Builds client assets and Nitro serverless output under `.vercel/output`.

### Deploying to Vercel
1. Push changes to GitHub.
2. Import project in **Vercel** with Root Directory set to `capasolve`.
3. Configure environment variables matching `.env`.
4. Add your production domain in **Neon Console -> Auth -> Domains**.

---

## Security Architecture

- **Row-Level Security (RLS)**: Enforces tenant isolation so organizations cannot view or modify other plants' schedules.
- **Same-Origin Proxy and OAuth Reconciler**: First-party cookie proxying at `/api/auth` plus server-side fallback (`verifyOAuthCallbackServerFn`) ensures resilient authentication even with third-party cookie restrictions.
- **Server Functions**: Sensitive operations (AI calls, cloud persistence, DB mutations) run strictly within isolated `createServerFn` server handlers.

---

## Testing and Validation

```bash
# Run unit test suite (59 tests)
npm run test

# Run static TypeScript typecheck
npm run typecheck

# Run linter
npm run lint
```

---

## License

Proprietary — All rights reserved. Designed for discrete manufacturing scheduling and shop-floor execution by Digital Biz Tech.
