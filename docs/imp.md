 CapaSolve SaaS — Beta-Readiness Gap Audit & Complete Production Checklist

> After a deep audit of every file in `d:\schedulersaas\flow-sync-saas`, this document maps **what exists ✅**, **what's partially done ⚠️**, and **what's completely missing ❌** — organized into 14 categories with **~180 actionable items** needed to go from current state to a shippable beta.

---

## Executive Summary: Current State vs. Beta-Ready

| Area | Status | Verdict |
|---|---|---|
| Solver Engine (scheduler.ts) | ✅ Solid | 1127 lines, 2-pass, setup matrix, priority, scenario engine |
| Auth (signup/login/forgot/reset) | ✅ Built | Supabase Auth, OAuth stubs, password reset, org provisioning |
| Database Schema & RLS | ✅ Mostly done | 3 migration files, RLS on all tables, org-scoped |
| API Layer (v1 endpoints) | ⚠️ Partial | `/schedule/solve` + `/orders` CRUD exist, but no real HTTP server routes — all client-side dispatched |
| UI Pages (~27 routes) | ✅ Built | Dashboard, Orders, Status, Sandbox, Shifts, Analytics, Settings, etc. |
| Gantt Timeline | ⚠️ Redirect stub | `gantt.tsx` is a 9-line redirect to `/status`. GanttTimelineView.tsx exists as component only |
| Plan Limits & Tiers | ✅ Built | FREE/PRO/ENTERPRISE with limits enforcement |
| PWA (manifest + sw.js) | ⚠️ Minimal | Basic cache-first SW, missing proper icon set, offline fallback page |
| WebWorker Solver | ✅ Built | `solver.worker.ts` offloads scheduling off main thread |
| **Testing** | ❌ Zero | No test files, no test runner, no CI |
| **Billing/Stripe** | ❌ Zero | Pricing page exists but no payment integration |
| **Error Monitoring** | ❌ Zero | No Sentry, no LogRocket, no error boundary components |
| **CI/CD Pipeline** | ❌ Zero | No GitHub Actions, no Dockerfile |
| **MFA / 2FA** | ❌ Zero | Referenced in plan but not implemented |
| **Realtime (WebSockets)** | ❌ Zero | No Supabase Realtime subscriptions |
| **Email Templates** | ❌ Zero | Using Supabase defaults (generic) |
| **Rate Limiting** | ⚠️ In-memory only | `rateLimitMap` in router.ts resets on deploy |
| **RBAC UI Guards** | ⚠️ Role stored but not enforced in UI |
| **Data Export (Excel/PDF)** | ⚠️ CSV only | No XLSX or PDF generation libraries |

---

## CATEGORY 1: Authentication & Security 🔐

### ✅ Already Built
- Supabase Auth integration (signup, login, password reset email, OAuth stubs)
- Session sync with Zustand store
- Auth state listener (`onAuthStateChange`)
- Public/private route classification in [auth-guard.ts](file:///d:/schedulersaas/flow-sync-saas/src/lib/auth-guard.ts)
- Organization self-provisioning on first login

### ❌ Missing for Beta

| # | Task | Priority | Effort |
|---|---|---|---|
| 1.1 | **Email verification enforcement** — Signup allows unverified emails. Add `emailConfirmedAt` check before granting dashboard access. | 🔴 Critical | 2h |
| 1.2 | **MFA / TOTP 2FA** — No `supabase.auth.mfa.enroll()` or `supabase.auth.mfa.verify()` calls anywhere. Add MFA setup in `/settings`. | 🟡 Medium | 8h |
| 1.3 | **Session token auto-refresh loop** — `autoRefreshToken: true` is set in Supabase config, but there's no explicit refresh-before-expiry interval or UI session timeout warning. | 🟡 Medium | 3h |
| 1.4 | **Secure logout with full cache flush** — `signOutUser()` clears 3 state fields but doesn't clear: `localStorage`, `sessionStorage`, `IndexedDB`, service worker cache, or `zustand/persist` hydration. | 🔴 Critical | 2h |
| 1.5 | **CSRF protection headers** — No `X-Frame-Options`, `Content-Security-Policy`, or `X-Content-Type-Options` headers configured on server responses. | 🔴 Critical | 2h |
| 1.6 | **API key management UI** — API keys are validated (`cs_live_*`, `cs_test_*`) but there's no UI to generate, rotate, or revoke keys. Keys aren't stored in DB. | 🟡 Medium | 6h |
| 1.7 | **OAuth provider configuration** — `signInWithOAuthProvider` accepts "google" and "azure" but Supabase project needs actual Google OAuth Client ID and Azure AD app registration. | 🟡 Medium | 4h |
| 1.8 | **Password strength validation** — No minimum length, complexity, or breach-check on signup/reset-password forms. | 🟡 Medium | 2h |
| 1.9 | **Brute-force login protection** — No account lockout after N failed login attempts. Supabase has built-in rate limiting but custom lockout messaging is missing. | 🟡 Medium | 3h |
| 1.10 | **Signed webhook HMAC signatures** — `X-CapaSolve-Signature` sends the raw secret, not an HMAC-SHA256 signature of the payload. | 🔴 Critical | 3h |

---

## CATEGORY 2: Database & Data Integrity 🗄️

### ✅ Already Built
- 3 migration files with proper schemas
- RLS enabled on all tables with `is_org_member()` / `get_user_role_in_org()` policies
- Composite indexes on high-frequency columns
- Audit logs + execution logs tables
- Setup matrix, scenarios, shift calendars, material stock tables

### ❌ Missing for Beta

| # | Task | Priority | Effort |
|---|---|---|---|
| 2.1 | **`updated_at` auto-trigger** — No PostgreSQL trigger to auto-update `updated_at` on row modifications. Plan mentions it (Task 2.5) but migration doesn't include `CREATE TRIGGER`. | 🟡 Medium | 1h |
| 2.2 | **Cascading deletion rules** — No explicit `ON DELETE CASCADE` on `order_processes` → `work_orders` relationship (the JSON blob approach in `schedule_data` means orphan data could persist). | 🟡 Medium | 2h |
| 2.3 | **Cross-tenant RLS isolation test** — No automated SQL test script to verify Tenant A cannot read Tenant B data. | 🔴 Critical | 3h |
| 2.4 | **Database backup verification** — PITR (Point-in-Time Recovery) needs to be explicitly enabled in Supabase Dashboard (requires Pro plan). No backup restore test procedure documented. | 🟡 Medium | 2h |
| 2.5 | **Migration version ordering** — Files use inconsistent naming (`20260723000000_init_schema.sql` vs `20260727_master_schema.sql` vs `20260802_next_level_features.sql`). Standardize to `YYYYMMDDHHMMSS` format. | 🟢 Low | 1h |
| 2.6 | **Data retention policy** — No automatic cleanup of old `audit_logs` or `process_execution_logs`. Will grow unbounded. Add retention policy (e.g., 90-day TTL). | 🟡 Medium | 2h |
| 2.7 | **Soft-delete pattern** — All deletes are hard deletes. For SaaS, implement `deleted_at` soft-delete on `work_orders` and `schedules` to allow undo/recovery. | 🟡 Medium | 4h |
| 2.8 | **Connection pooling** — Supabase client creates direct connections. For production, configure PgBouncer connection pooling in Supabase settings. | 🟡 Medium | 1h |

---

## CATEGORY 3: API Layer & Server Infrastructure 🌐

### ✅ Already Built
- API router with auth middleware, rate limiter, error formatter
- `/api/v1/schedule/solve` (POST) and `/api/v1/orders` (GET/POST/DELETE)
- Hono-style routing structure

### ❌ Missing for Beta

| # | Task | Priority | Effort |
|---|---|---|---|
| 3.1 | **API routes are client-side only** — `handleApiRouteRequest()` in [router.ts](file:///d:/schedulersaas/flow-sync-saas/src/api/router.ts) is never registered as actual HTTP server endpoints. The Nitro/TanStack Start server doesn't mount these as real API routes. External REST calls won't work. | 🔴 Critical | 8h |
| 3.2 | **Rate limiter is in-memory** — `rateLimitMap` is a JavaScript `Map`. It resets on every serverless cold start/deploy. Replace with Redis (Upstash) or Supabase-backed rate limiter. | 🔴 Critical | 4h |
| 3.3 | **API key storage in database** — Keys are validated by prefix pattern (`cs_live_*`) but never actually stored or looked up in a DB table. Need `api_keys` table with hashed keys + tenant mapping. | 🔴 Critical | 6h |
| 3.4 | **OpenAPI / Swagger spec** — [api-reference.tsx](file:///d:/schedulersaas/flow-sync-saas/src/routes/api-reference.tsx) exists as a page but there's no actual `openapi.json` schema generated from the endpoints. | 🟡 Medium | 4h |
| 3.5 | **API versioning strategy** — `/v1/` prefix exists but no deprecation headers or version negotiation. | 🟢 Low | 2h |
| 3.6 | **Request payload validation** — `zod` is installed but no validation schemas are applied to incoming API request bodies. | 🔴 Critical | 4h |
| 3.7 | **CORS configuration** — No CORS headers configured for external API consumers. | 🔴 Critical | 1h |
| 3.8 | **Webhook retry with exponential backoff** — Webhook dispatcher fires once and gives up. Need 3-retry queue with exponential backoff (1s → 5s → 30s). | 🟡 Medium | 4h |
| 3.9 | **API response pagination** — `GET /orders` returns all orders. No `page`, `limit`, `offset` query params. | 🟡 Medium | 3h |
| 3.10 | **Request/response logging** — No API request logging for debugging or audit trail. | 🟡 Medium | 3h |

---


## CATEGORY 5: Testing & Quality Assurance 🧪

### ❌ Completely Missing (Zero test files found in entire codebase)

| # | Task | Priority | Effort |
|---|---|---|---|
| 5.1 | **Install test runner** — Add `vitest` + `@testing-library/react` + `jsdom` to devDependencies. Add `"test": "vitest"` script to package.json. | 🔴 Critical | 2h |
| 5.2 | **Scheduler unit tests** — Test `generateSchedule()` with: empty input, single order, priority ordering, SOP date conflicts, setup matrix application, capacity overflow, scenario simulation. Minimum 15 test cases. | 🔴 Critical | 12h |
| 5.3 | **Data cleaner unit tests** — Test `dataCleaner.ts` column mapping with SAP German/English headers, malformed CSVs, missing columns, special characters. | 🔴 Critical | 6h |
| 5.4 | **Auth flow integration tests** — Test signup → email verify → login → session sync → logout → re-login cycle. | 🟡 Medium | 6h |
| 5.5 | **Store action unit tests** — Test `addOrder()`, `deleteOrder()`, `runScheduler()`, `logProcessProgress()`, scenario branching in Zustand store. | 🔴 Critical | 8h |
| 5.6 | **API endpoint tests** — Test `/api/v1/schedule/solve` with valid/invalid payloads, auth failures, rate limiting. | 🟡 Medium | 4h |
| 5.7 | **Plan limits enforcement tests** — Verify FREE plan rejects 51st order, PRO plan allows 500, ENTERPRISE allows 10K. | 🟡 Medium | 2h |
| 5.8 | **CSV import regression tests** — Test all 13 CSV test files (`test_aerospace_precision_fab.csv`, `test_cnc_milling_workshop.csv`, etc.) parse correctly end-to-end. | 🔴 Critical | 4h |
| 5.9 | **E2E browser tests** — Add Playwright for critical user flows: Login → Upload CSV → Run Solver → View Gantt → Export. | 🟡 Medium | 12h |
| 5.10 | **Performance benchmark tests** — Automated solver benchmark: 100, 500, 1000, 5000 orders. Track regression in solve time. | 🟡 Medium | 4h |

---

## CATEGORY 6: Error Handling, Monitoring & Observability 📊

### ❌ Completely Missing

| # | Task | Priority | Effort |
|---|---|---|---|
| 6.1 | **React Error Boundary** — No `ErrorBoundary` component. A single unhandled exception crashes the entire app. Add error boundary wrapping the root layout. | 🔴 Critical | 3h |
| 6.2 | **Sentry / error monitoring setup** — Install `@sentry/react` and `@sentry/node`. Configure DSN. Capture unhandled exceptions, rejected promises, and API errors. | 🔴 Critical | 4h |
| 6.3 | **User-facing error pages** — `error-page.ts` exists but is minimal. Need proper styled 404, 500, and offline fallback pages. | 🟡 Medium | 3h |
| 6.4 | **API error alerting** — When solver crashes or DB write fails, send Slack/email alert to team. | 🟡 Medium | 4h |
| 6.5 | **Health check endpoint** — `/api/health` returning `{ status: "ok", version: "1.0.0", supabase: "connected" }` for uptime monitoring (UptimeRobot / Better Uptime). | 🔴 Critical | 2h |
| 6.6 | **Performance monitoring** — Track Core Web Vitals (LCP, FID, CLS) with `web-vitals` library or Vercel Analytics. | 🟡 Medium | 2h |
| 6.7 | **Server-side logging** — No structured logging. Add `pino` or `winston` for server-side request/error logging with JSON format. | 🟡 Medium | 3h |
| 6.8 | **Client-side error toast** — Unhandled `fetch` failures silently fail. Wrap all Supabase calls with try/catch → sonner toast notification. | 🟡 Medium | 4h |
| 6.9 | **Solver crash recovery** — If WebWorker crashes mid-solve, UI hangs with no feedback. Add timeout watchdog (solver timeout from plan-limits.ts) and auto-recovery. | 🔴 Critical | 4h |
| 6.10 | **Deployment status page** — Public status page (e.g., Statuspage.io or custom `/status-page`) showing system health. | 🟢 Low | 4h |

---

## CATEGORY 7: CI/CD, Build & Deployment 🚀

### ✅ Already Built
- Vercel deployment config in `vite.config.ts` (Nitro preset)
- `.vercel/output` directory structure
- Build scripts (`npm run build`)

### ❌ Missing for Beta

| # | Task | Priority | Effort |
|---|---|---|---|
| 7.1 | **GitHub Actions CI pipeline** — No `.github/workflows/ci.yml`. Need: lint → type-check → test → build on every PR. | 🔴 Critical | 4h |
| 7.2 | **Production build verification** — Run `npm run build` and fix any TypeScript/build errors before deploying. | 🔴 Critical | 4h |
| 7.3 | **Environment variable validation** — No build-time check that `VITE_SUPABASE_PROJECT_ID` and `VITE_SUPABASE_ANON_KEY` are set. Build succeeds with empty keys → runtime crash. | 🔴 Critical | 2h |
| 7.4 | **Preview deployments** — Configure Vercel to auto-deploy PR preview URLs for stakeholder review. | 🟡 Medium | 1h |
| 7.5 | **Database migration CI** — Run Supabase migration diffs automatically on deploy. `supabase db push` or `supabase migration up` in CI. | 🟡 Medium | 4h |
| 7.6 | **Bundle size monitoring** — No bundle analysis. Add `rollup-plugin-visualizer` or Vercel's bundle analyzer to track JS size. Target < 300KB first-load. | 🟡 Medium | 2h |
| 7.7 | **Staging environment** — No staging/dev environment. All development goes directly to production Supabase project. Need separate Supabase project for staging. | 🔴 Critical | 4h |
| 7.8 | **Feature flags** — No feature flag system for gradual rollout of beta features. Consider LaunchDarkly, Flagsmith, or simple env-var flags. | 🟢 Low | 4h |
| 7.9 | **Release versioning** — No version tracking. Add `package.json` version bumping with semantic versioning + CHANGELOG.md. | 🟡 Medium | 2h |
| 7.10 | **Rollback procedure** — No documented rollback process. Vercel supports instant rollback but procedure needs to be documented. | 🟡 Medium | 1h |

---

## CATEGORY 8: RBAC & Multi-Tenancy 👥

### ✅ Already Built
- Organization model with `org_id` isolation
- Role stored in `organization_members.role`
- `UserRole` type with role assignment on signup
- RLS policies using `get_user_role_in_org()`

### ❌ Missing for Beta

| # | Task | Priority | Effort |
|---|---|---|---|
| 8.1 | **UI permission guards** — Role is stored but NEVER checked in UI. All buttons (delete order, edit settings, run solver) are visible to all roles. Add `usePermission()` hook. | 🔴 Critical | 8h |
| 8.2 | **Complete RBAC role matrix** — Define explicit permission matrix: Which roles can: upload CSV? Run solver? Delete orders? Manage team? View analytics? Export data? | 🔴 Critical | 3h |
| 8.3 | **Team member invitation flow** — No invite mechanism. Need `/settings/team` with email invite, pending invitation list, role assignment. | 🟡 Medium | 8h |
| 8.4 | **Team member management** — No ability to remove members, change roles, or transfer ownership. | 🟡 Medium | 6h |
| 8.5 | **Multi-tenant workspace switcher** — Plan mentions it (Task 10.4) but not implemented. Users belonging to multiple orgs can't switch contexts. | 🟡 Medium | 6h |
| 8.6 | **Server-side RBAC enforcement** — RLS policies check org membership but don't enforce role-level restrictions (e.g., ShopFloorOperator shouldn't be able to DELETE from `schedules`). | 🔴 Critical | 4h |
| 8.7 | **Role-based API key scoping** — API keys should inherit the role permissions of the creating user. | 🟢 Low | 4h |

---

## CATEGORY 9: UI/UX Polish & Accessibility ♿

### ✅ Already Built
- 47 Radix UI components (comprehensive design system)
- Dark/light theme via ThemeProvider
- Skeleton loaders, command palette, notification center
- Onboarding tour component
- Responsive sidebar layout with mobile detection hook

### ❌ Missing for Beta

| # | Task | Priority | Effort |
|---|---|---|---|
| 9.1 | **Gantt chart is a stub** — [gantt.tsx](file:///d:/schedulersaas/flow-sync-saas/src/routes/gantt.tsx) is a **9-line redirect** to `/status`. The Gantt Timeline View exists only as a component ([GanttTimelineView.tsx](file:///d:/schedulersaas/flow-sync-saas/src/components/GanttTimelineView.tsx)) but isn't mounted on its own route. If Gantt is a core selling point, it needs a proper dedicated page. | 🔴 Critical | 4h |
| 9.2 | **Keyboard accessibility audit** — No ARIA labels on custom interactive elements. No focus management on modal open/close. No skip-to-content link. | 🟡 Medium | 6h |
| 9.3 | **Empty state illustrations** — When a new user signs up, `/orders`, `/status`, `/analytics` show blank pages. Need empty-state illustrations with "Upload your first CSV" CTAs. | 🟡 Medium | 4h |
| 9.4 | **Loading state for solver** — WebWorker sends a `PROGRESS: 10%` message but there's no visible progress bar/spinner on the UI during solve. | 🟡 Medium | 3h |
| 9.5 | **Mobile responsive audit** — Side navigation may not collapse properly on all screen sizes. Test on 320px, 375px, 768px, 1024px viewports. | 🟡 Medium | 4h |
| 9.6 | **Internationalization (i18n)** — `translations.ts` exists (13KB) but unclear if all UI strings are translated. Need full EN/DE coverage audit. | 🟡 Medium | 8h |
| 9.7 | **Print stylesheet** — Manufacturing planners frequently print schedules. No `@media print` styles exist. | 🟡 Medium | 4h |
| 9.8 | **Color contrast WCAG AA** — Verify all text/background combinations meet 4.5:1 contrast ratio. | 🟡 Medium | 2h |
| 9.9 | **Touch-friendly sizing** — Button/link touch targets on `/status` and `/kiosk` views should be minimum 44×44px for shop floor tablet use. | 🟡 Medium | 3h |
| 9.10 | **Browser compatibility testing** — Test on Chrome, Firefox, Safari, Edge. Service worker behavior differs across browsers. | 🟡 Medium | 4h |

---

## CATEGORY 10: Data Export & Reporting 📄

### ✅ Already Built
- [ExportButton.tsx](file:///d:/schedulersaas/flow-sync-saas/src/components/ExportButton.tsx) — CSV export
- SAP LSMW/BDC export format detection in dataCleaner.ts

### ❌ Missing for Beta

| # | Task | Priority | Effort |
|---|---|---|---|
| 10.1 | **Excel (XLSX) export** — No `xlsx` or `exceljs` library. Plan mentions Excel export but only CSV is implemented. Manufacturing planners expect `.xlsx` with formatted headers. | 🔴 Critical | 4h |
| 10.2 | **PDF report generation** — No `jspdf`, `puppeteer`, or `react-pdf` library. Plan mentions PDF export for weekly summaries and OEE reports. | 🟡 Medium | 8h |
| 10.3 | **Scheduled email reports** — No automated weekly/daily email digest for planners. Need Supabase Edge Function or cron job. | 🟢 Low | 8h |
| 10.4 | **SAP BDC export formatting** — Plan mentions `YYYYMMDD` and `HHMMSS` format for SAP BDC but actual export button doesn't exist on any page. | 🟡 Medium | 4h |
| 10.5 | **Gantt chart PNG/SVG export** — Planners want to paste schedule views into PowerPoint. Need `html2canvas` or SVG export. | 🟡 Medium | 4h |
| 10.6 | **Schedule comparison report** — Export side-by-side KPI comparison from Sandbox scenarios as formatted PDF/Excel. | 🟢 Low | 6h |

---

## CATEGORY 11: Performance & Scalability ⚡

### ✅ Already Built
- WebWorker solver thread (non-blocking main thread)
- Memory-conscious slot allocation in scheduler.ts

### ❌ Missing for Beta

| # | Task | Priority | Effort |
|---|---|---|---|
| 11.1 | **Virtual scrolling on large tables** — `/orders` and `/status` render ALL rows in DOM. With 5000+ orders, this will freeze. Add `@tanstack/react-virtual`. | 🔴 Critical | 6h |
| 11.2 | **Gantt virtual windowing** — GanttTimelineView.tsx (92KB!) renders potentially thousands of cells. Needs virtual horizontal + vertical scrolling. | 🔴 Critical | 8h |
| 11.3 | **React.memo / useMemo audit** — No evidence of memoization in large components like `capacity.tsx` (95KB), `monthly.tsx` (99KB), `sandbox.tsx` (106KB). These re-render on every state change. | 🟡 Medium | 6h |
| 11.4 | **Code splitting / lazy loading** — All 27 routes are likely bundled together. Add `React.lazy()` on heavy routes (`sandbox.tsx`, `capacity.tsx`, `monthly.tsx`). TanStack Router supports this natively. | 🟡 Medium | 4h |
| 11.5 | **Supabase query optimization** — `fetchScheduleFromSupabaseDB()` loads entire JSON blob. For large datasets, this will be slow. Consider paginated or streaming approach. | 🟡 Medium | 6h |
| 11.6 | **Bundle size audit** — No bundle analysis performed. Recharts alone can be 200KB+ gzipped. Identify and tree-shake unused imports. | 🟡 Medium | 4h |
| 11.7 | **Image optimization** — Logo is a 8KB JPEG used as both 192px and 512px icon. Need proper PNG icons in multiple sizes + WebP format. | 🟢 Low | 2h |
| 11.8 | **Lighthouse audit** — Run Google Lighthouse and target 90+ for Performance, Accessibility, Best Practices, SEO. | 🟡 Medium | 4h |

---

## CATEGORY 12: Legal, Compliance & Privacy 📜

### ✅ Already Built
- [privacy.tsx](file:///d:/schedulersaas/flow-sync-saas/src/routes/privacy.tsx) — Privacy policy page
- [security.tsx](file:///d:/schedulersaas/flow-sync-saas/src/routes/security.tsx) — Security page

### ❌ Missing for Beta

| # | Task | Priority | Effort |
|---|---|---|---|
| 12.1 | **Terms of Service page** — No `/terms` route. Required for any SaaS product accepting payments. | 🔴 Critical | 4h |
| 12.2 | **Cookie consent banner** — No cookie consent mechanism. Required under GDPR for EU customers (your target market: SAP/German manufacturers). | 🔴 Critical | 4h |
| 12.3 | **Data Processing Agreement (DPA)** — Enterprise customers will require a signed DPA before uploading production data. Need downloadable DPA template. | 🟡 Medium | 4h |
| 12.4 | **GDPR data export/deletion** — No "Download My Data" or "Delete My Account" functionality. GDPR Article 17 (Right to Erasure) requires this. | 🔴 Critical | 6h |
| 12.5 | **Data residency documentation** — Where is data stored? (Supabase region). Document for enterprise compliance reviews. | 🟡 Medium | 2h |
| 12.6 | **SOC 2 readiness assessment** — Enterprise manufacturing clients may require SOC 2 Type II compliance evidence. Audit current security posture. | 🟢 Low | 8h |
| 12.7 | **Acceptable Use Policy** — Define prohibited uses, abuse handling, and account termination procedures. | 🟢 Low | 3h |

---

## CATEGORY 13: Realtime, Notifications & Communication 🔔

### ✅ Already Built
- [NotificationCenter.tsx](file:///d:/schedulersaas/flow-sync-saas/src/components/NotificationCenter.tsx) — Toast notification component
- Sonner library for toast notifications

### ❌ Missing for Beta

| # | Task | Priority | Effort |
|---|---|---|---|
| 13.1 | **Supabase Realtime subscriptions** — Zero Realtime channel subscriptions. Shop floor multi-device sync requires `supabase.channel().on('postgres_changes', ...)`. | 🔴 Critical | 8h |
| 13.2 | **In-app notification center** — NotificationCenter.tsx is 4KB and likely just toasts. Need persistent notification bell with history (unread count, notification list). | 🟡 Medium | 6h |
| 13.3 | **Email notifications** — No transactional email for: schedule completed, job delayed, plan upgrade confirmation. Set up Supabase Edge Functions + Resend/SendGrid. | 🟡 Medium | 8h |
| 13.4 | **Custom email templates** — Supabase Auth uses default email templates for password reset, email confirmation. Brand these with CapaSolve styling. | 🟡 Medium | 3h |
| 13.5 | **Browser push notifications** — PWA is set up but no push notification subscription. Useful for "Schedule solve completed" alerts when user is on another tab. | 🟢 Low | 6h |
| 13.6 | **Webhook delivery logs** — Webhook dispatcher sends events but doesn't log delivery status. Need webhook event delivery history table + UI. | 🟡 Medium | 4h |

---

## CATEGORY 14: Documentation & Onboarding 📚

### ✅ Already Built
- [documentation.tsx](file:///d:/schedulersaas/flow-sync-saas/src/routes/documentation.tsx) — 23KB docs page
- [OnboardingTour.tsx](file:///d:/schedulersaas/flow-sync-saas/src/components/OnboardingTour.tsx) — 9KB onboarding
- [about.tsx](file:///d:/schedulersaas/flow-sync-saas/src/routes/about.tsx), [contact.tsx](file:///d:/schedulersaas/flow-sync-saas/src/routes/contact.tsx), [support.tsx](file:///d:/schedulersaas/flow-sync-saas/src/routes/support.tsx)
- README.md + code_architecture.md

### ❌ Missing for Beta

| # | Task | Priority | Effort |
|---|---|---|---|
| 14.1 | **Interactive onboarding wizard** — OnboardingTour exists but does it actually run on first login? Verify trigger mechanism and step-by-step flow. | 🟡 Medium | 3h |
| 14.2 | **Sample data auto-load** — New signup should auto-populate a demo dataset so users immediately see value. `sampleCsvDatasets.ts` (30KB) exists — wire it to onboarding. | 🟡 Medium | 4h |
| 14.3 | **API documentation** — `/api-reference` page exists but needs actual endpoint documentation with request/response examples, not just OpenAPI placeholder. | 🟡 Medium | 6h |
| 14.4 | **Video tutorials** — Record 3 key flows: (1) CSV Upload → Schedule, (2) Manual Order Creation, (3) Scenario Sandbox. Embed in docs. | 🟢 Low | 8h |
| 14.5 | **Changelog** — No `/changelog` page. Users need to see what's new in each release. | 🟡 Medium | 3h |
| 14.6 | **In-app help tooltips** — [InfoTooltip.tsx](file:///d:/schedulersaas/flow-sync-saas/src/components/InfoTooltip.tsx) exists (1.4KB) but unclear if it's used on key UI elements. | 🟢 Low | 2h |
| 14.7 | **Support ticket system** — `/support` page exists but needs integration with a real support system (Intercom, Crisp, or email ticketing). | 🟡 Medium | 4h |
| 14.8 | **Developer API quickstart guide** — For customers integrating via REST API: Getting your API key → First API call → Webhook setup. | 🟡 Medium | 4h |

---

## Prioritized Beta Launch Roadmap