# CapaSolve SaaS — Production Readiness Audit & Next-Level Features Master Plan

## Executive Overview

**CapaSolve SaaS** is designed as a zero-friction, affordable, finite-capacity production scheduling companion for SAP and discrete manufacturers. This document presents a comprehensive **SaaS Production Readiness Plan** covering both **Foundational Pillars** (Authentication, Database, APIs, Solver Infrastructure, UI Performance) and **10 Next-Level Feature Suites**. 

Each pillar and feature is paired with a **10-Task Action List**, creating a total of **150 actionable, step-by-step tasks** for full SaaS production deployment.

---

## Part 1: Foundational SaaS Infrastructure & Core Pillars (50 Tasks)

---

### Pillar 1: Supabase Authentication, Password Reset & Session Security
*Provides production-ready user auth via Supabase Auth, password reset workflows, email verification, and session token refreshment.*

#### 10-Task Action List:
1. **Task 1.1**: Integrate Supabase Auth password reset flow (`resetPasswordForEmail()`) in `auth-service.ts` ([auth-service.ts](file:///d:/schedulersaas/flow-sync-saas/src/lib/auth-service.ts)).
2. **Task 1.2**: Create `/forgot-password` and `/reset-password` UI routes in `src/routes/` with clean input forms and status feedback.
3. **Task 1.3**: Add email verification requirement hook on signup in `/signup` ([signup.tsx](file:///d:/schedulersaas/flow-sync-saas/src/routes/signup.tsx)).
4. **Task 1.4**: Implement automatic JWT token refreshment loop in `auth-guard.ts` ([auth-guard.ts](file:///d:/schedulersaas/flow-sync-saas/src/lib/auth-guard.ts)) to prevent session timeouts.
5. **Task 1.5**: Implement tenant-scoped user metadata (`tenant_id`, `role`, `company_name`) attached directly to Supabase Auth `user_metadata`.
6. **Task 1.6**: Add Supabase OAuth login providers (Google and Microsoft 365 Entra ID SSO) to `/login` ([login.tsx](file:///d:/schedulersaas/flow-sync-saas/src/routes/login.tsx)).
7. **Task 1.7**: Create user profile management section under `/settings` ([settings.tsx](file:///d:/schedulersaas/flow-sync-saas/src/routes/settings.tsx)) for changing email, password, and avatar.
8. **Task 1.8**: Implement multi-factor authentication (TOTP 2FA) option via Supabase MFA APIs.
9. **Task 1.9**: Add secure `logout()` action with complete Zustand store cache flushing and local storage cleanup.
10. **Task 1.10**: Test complete auth lifecycle: Signup $\rightarrow$ Email confirmation $\rightarrow$ Login $\rightarrow$ Forgot Password $\rightarrow$ Reset Link $\rightarrow$ Password Update $\rightarrow$ Re-login.

---

### Pillar 2: Database Schema, Multi-Tenant Isolation & Migration Engine
*Enforces database integrity, tenant RLS isolation, index optimization, and automated migration scripts.*

#### 10-Task Action List:
1. **Task 2.1**: Write combined SQL migration script `supabase/migrations/20260802_next_level_features.sql` defining all new tables.
2. **Task 2.2**: Enable Row-Level Security (RLS) on all tables (`work_orders`, `order_processes`, `setup_matrix`, `scenarios`, `shift_calendars`, `material_stock`).
3. **Task 2.3**: Create RLS policies ensuring users can only read/write rows matching `auth.uid()` tenant ID: `USING (tenant_id = (SELECT tenant_id FROM user_profiles WHERE id = auth.uid()))`.
4. **Task 2.4**: Add B-tree composite indexes on high-frequency columns: `(tenant_id, order_id)`, `(tenant_id, machine_id)`, and `(tenant_id, scheduled_start)`.
5. **Task 2.5**: Write database trigger to auto-update `updated_at` timestamps on row modifications.
6. **Task 2.6**: Implement cascading deletion rules on parent order removal to prevent orphan process rows.
7. **Task 2.7**: Create `db-service.ts` data access layer functions for fetching and upserting orders, processes, and solver configurations.
8. **Task 2.8**: Implement offline fallback queue in IndexedDB via `idb-keyval` when network connectivity drops.
9. **Task 2.9**: Configure Supabase automated daily database backups and point-in-time recovery (PITR) settings.
10. **Task 2.10**: Verify RLS isolation by executing cross-tenant access queries and confirming zero data leakage across tenants.

---

### Pillar 3: API Architecture, Webhooks & Rate Limiting Infrastructure
*Builds serverless API endpoints, rate limiters, webhooks, and OpenAPI documentation for external integrations.*

#### 10-Task Action List:
1. **Task 3.1**: Structure Hono REST API router under `src/api/` for clean modular route handling.
2. **Task 3.2**: Add API authentication middleware (`apiKeyAuthMiddleware`) validating tenant API keys passed in `X-API-Key` headers.
3. **Task 3.3**: Implement sliding-window rate limiting (100 requests / min per IP/Tenant) using Hono rate-limit middleware.
4. **Task 3.4**: Create `/api/v1/schedule/solve` serverless endpoint to trigger finite capacity optimization via REST POST requests.
5. **Task 3.5**: Create `/api/v1/orders` endpoint supporting GET, POST, PUT, DELETE for ERP external integrations.
6. **Task 3.6**: Implement Webhook Dispatcher sending HTTP POST payloads to configured customer URLs on schedule changes or job delays.
7. **Task 3.7**: Generate dynamic OpenAPI 3.0 / Swagger schema specification exposed at `/api-reference` ([api-reference.tsx](file:///d:/schedulersaas/flow-sync-saas/src/routes/api-reference.tsx)).
8. **Task 3.8**: Implement standardized API error response formatter (`{ success: false, error: { code, message, details } }`).
9. **Task 3.9**: Add request payload validation schemas using `zod` for all incoming REST endpoints.
10. **Task 3.10**: Test API endpoints with Postman / cURL scripts, verifying 200 OK responses, 401 Unauthorized handling, and rate limit enforcement.

---

### Pillar 4: Finite Capacity Solver Core Engine & Asynchronous Worker Extensions
*Upgrades core algorithm, memory management, and asynchronous web-worker execution for ultra-fast schedule solving.*

#### 10-Task Action List:
1. **Task 4.1**: Refactor 2-pass solver in `scheduler.ts` ([scheduler.ts](file:///d:/schedulersaas/flow-sync-saas/src/lib/scheduler.ts)) into pure functional module without side effects.
2. **Task 4.2**: Implement WebWorker solver thread (`solver.worker.ts`) to offload heavy schedule calculations off the UI main thread.
3. **Task 4.3**: Add memory optimization pooling for candidate hour slot searching, reducing garbage collection pauses on 10,000+ step datasets.
4. **Task 4.4**: Extend 5-Layer Constraint Stack with extensible plugin handler architecture.
5. **Task 4.5**: Add solver progress feedback emitter reporting % completion during multi-pass optimization runs.
6. **Task 4.6**: Implement configurable solver objective targets (Minimize Makespan, Maximize Machine Utilization, Minimize Setup Time, Prioritize SOP Target Date).
7. **Task 4.7**: Add cycle detection algorithm preventing infinite loops when processing circular step dependencies.
8. **Task 4.8**: Build schedule validation auditor verifying zero machine double-booking or operator capacity overruns post-solve.
9. **Task 4.9**: Add performance benchmarking logger tracking solver execution time in milliseconds.
10. **Task 4.10**: Run stress tests on 5,000 work order steps, verifying sub-second solve execution time without UI freezing.

---

### Pillar 5: UI/UX Architecture, Component Virtualization & PWA Support
*Delivers extreme responsiveness, high-density visualization, mobile PWA capabilities, and dark/light themes.*

#### 10-Task Action List:
1. **Task 5.1**: Implement virtual windowing (`react-window` / `@tanstack/react-virtual`) in Gantt chart ([gantt.tsx](file:///d:/schedulersaas/flow-sync-saas/src/routes/gantt.tsx)) to render 10,000+ timeline slots effortlessly.
2. **Task 5.2**: Add Progressive Web App (PWA) manifest and service worker configuration for offline access on shop floor tablets.
3. **Task 5.3**: Optimize global layout structure ([AppLayout.tsx](file:///d:/schedulersaas/flow-sync-saas/src/components/AppLayout.tsx)) with responsive sidebar, collapsible menus, and mobile bottom navigation.
4. **Task 5.4**: Refine design system with Tailwind CSS CSS variables, glassmorphism card surfaces, and dark/light mode toggle.
5. **Task 5.5**: Add skeleton loading states ([SkeletonLoaders.tsx](file:///d:/schedulersaas/flow-sync-saas/src/components/SkeletonLoaders.tsx)) during data fetch and scheduler computation.
6. **Task 5.6**: Build unified toast notification engine ([NotificationCenter.tsx](file:///d:/schedulersaas/flow-sync-saas/src/components/NotificationCenter.tsx)) for real-time status alerts.
7. **Task 5.7**: Add keyboard accessibility shortcuts (e.g., `Ctrl+K` for Command Palette, `Space` to run solver, `Esc` to close modals).
8. **Task 5.8**: Create high-density compact table toggle on `/orders`, `/pivot`, and `/capacity` views.
9. **Task 5.9**: Implement responsive touch-drag polyfill for tablet touchscreens.
10. **Task 5.10**: Audit UI performance with Google Lighthouse, ensuring 90+ scores for Performance, Accessibility, and Best Practices.

---

## Part 2: 10 Next-Level Feature Suites (100 Tasks)

---

### Feature 1: Manual Work Order & Step Creator Modal Suite (CRUD & Order Management)
*Empowers planners to add, edit, and clone work orders and operations directly from the UI without needing CSV re-uploads.*

#### 10-Task Action List:
1. **Task 1.1**: Create `CreateOrderModal.tsx` in `src/components/modals/` with form fields: `Order ID`, `Material/SKU`, `SOP Start Date`, and `Order Quantity`.
2. **Task 1.2**: Create `CreateStepModal.tsx` in `src/components/modals/` with fields: `Step ID`, `Workcenter/Machine`, `Setup Time (min)`, `Process Time (min)`, and `Manpower %`.
3. **Task 1.3**: Add `addOrder()` and `addProcess()` actions to `useAppStore` in [store.ts](file:///d:/schedulersaas/flow-sync-saas/src/lib/store.ts#L557), automatically recalculating `totalTimeMin` and triggering `runScheduler()`.
4. **Task 1.4**: Add `editOrder()` and `updateProcessDetails()` to `store.ts` for inline table updates on `/orders`.
5. **Task 1.5**: Implement `deleteOrder()` and `deleteProcess()` with confirmation dialogs and cascading slot cleanup.
6. **Task 1.6**: Add "Clone Order" feature to rapidly duplicate high-volume recurring jobs with a new SOP date.
7. **Task 1.7**: Add real-time field validation (e.g., non-negative setup times, valid date formats, non-empty SKU codes).
8. **Task 1.8**: Integrate `CreateOrderModal` launch buttons in `/orders`, `/gantt`, and the global header command palette ([CommandPalette.tsx](file:///d:/schedulersaas/flow-sync-saas/src/components/CommandPalette.tsx)).
9. **Task 1.9**: Add Supabase persistence bindings in `db-service.ts` to sync manually created orders to the `work_orders` PostgreSQL table.
10. **Task 1.10**: Write unit tests for manual order addition and verify scheduler slot generation in [scheduler.ts](file:///d:/schedulersaas/flow-sync-saas/src/lib/scheduler.ts).

---

### Feature 2: Daily Shop Floor Work Dispatch & Status Tracking Matrix (`/status` & `/kiosk`)
*Provides machine operators and shop floor supervisors with a real-time dispatch list filtered by workcenter and shift.*

#### 10-Task Action List:
1. **Task 2.1**: Refine `/status` route ([status.tsx](file:///d:/schedulersaas/flow-sync-saas/src/routes/status.tsx)) into a high-visibility, card-based shop floor dashboard.
2. **Task 2.2**: Build a dedicated touch-friendly Operator Kiosk view (`/kiosk`) optimized for shop floor tablets and industrial touchscreens.
3. **Task 2.3**: Define formal step status state machine: `PLANNED` $\rightarrow$ `IN_PROGRESS` $\rightarrow$ `PAUSED` $\rightarrow$ `COMPLETED` / `DELAYED`.
4. **Task 2.4**: Implement 1-click status quick-toggle buttons on machine dispatch cards.
5. **Task 2.5**: Add workcenter/machine filter dropdown allowing operators to view only their assigned machine's dispatch queue.
6. **Task 2.6**: Implement color-coded visual indicator badges (Green = Completed, Amber = In Progress, Blue = Planned, Red = Delayed).
7. **Task 2.7**: Add Barcode / QR Code scanner component to instantly select jobs by scanning printed order travelers.
8. **Task 2.8**: Create real-time WebSockets / Supabase Realtime subscription listener in `status.tsx` for multi-terminal sync across shop floor devices.
9. **Task 2.9**: Build automated delayed-job warning banner when actual elapsed time exceeds scheduled duration.
10. **Task 2.10**: Verify status updates reflect instantly on the Gantt chart ([gantt.tsx](file:///d:/schedulersaas/flow-sync-saas/src/routes/gantt.tsx)) and Capacity planner ([capacity.tsx](file:///d:/schedulersaas/flow-sync-saas/src/routes/capacity.tsx)).

---

### Feature 3: Operator "Work Done", Scrap & Actual Hours Logger (MES Progress Engine)
*Captures shop floor execution feedback to calculate real-time completion %, scrap rates, and schedule adjustments.*

#### 10-Task Action List:
1. **Task 3.1**: Create `LogWorkDoneModal.tsx` modal component for logging completed quantity, scrap count, and actual hours spent.
2. **Task 3.2**: Add `progressQty`, `scrapQty`, `actualSetupMins`, and `actualProcessMins` fields to `OrderProcess` interface in [types.ts](file:///d:/schedulersaas/flow-sync-saas/src/lib/types.ts).
3. **Task 3.3**: Implement dynamic completion percentage calculator: `completionPct = (progressQty / orderQty) * 100`.
4. **Task 3.4**: Add `logProcessProgress()` store action in `store.ts` to adjust remaining process time (`remainingTimeMin`) dynamically.
5. **Task 3.5**: Update scheduler engine ([scheduler.ts](file:///d:/schedulersaas/flow-sync-saas/src/lib/scheduler.ts)) to dynamically reduce allocated slots for partially completed jobs.
6. **Task 3.6**: Create progress bar visualizer component embedded inside Gantt chart bars and order rows.
7. **Task 3.7**: Build scrap analysis breakdown chart in Analytics ([analytics.tsx](file:///d:/schedulersaas/flow-sync-saas/src/routes/analytics.tsx)) tracking scrap % per machine and material SKU.
8. **Task 3.8**: Add operator shift log export (CSV / PDF) for supervisor end-of-shift reporting.
9. **Task 3.9**: Store historical execution logs in `process_execution_logs` Supabase table for machine cycle-time accuracy analysis.
10. **Task 3.10**: Test full cycle: Log 50% completed on Step 10 $\rightarrow$ verify Gantt reschedules remaining 50% without altering finished slots.

---

### Feature 4: Dynamic Sequence-Dependent Setup Matrix (Changeover Time Optimizer)
*Optimizes setup changeover times based on sequence transition rules between different materials, colors, or tooling.*

#### 10-Task Action List:
1. **Task 4.1**: Create `SetupMatrixConfig.tsx` management component under `/settings` to define material family changeover rules.
2. **Task 4.2**: Add `SetupMatrixRule` interface to `types.ts` (`fromMaterial`, `toMaterial`, `machineGroupId`, `changeoverMins`).
3. **Task 4.3**: Add `setupMatrix: SetupMatrixRule[]` state array to `useAppStore` in `store.ts`.
4. **Task 4.4**: Implement dynamic setup calculator function `calculateSetupTime(prevProc, currentProc, matrix)` in `scheduler.ts`.
5. **Task 4.5**: Upgrade `generateSchedule()` in [scheduler.ts](file:///d:/schedulersaas/flow-sync-saas/src/lib/scheduler.ts#L379) to look up prior scheduled job on candidate machine and apply dynamic setup times.
6. **Task 4.6**: Add heuristic sorting option in scheduler: "Group by Material SKU" to sequence identical product families together.
7. **Task 4.7**: Calculate "Setup Hours Saved" KPI metric comparing unoptimized CSV setup times against matrix-optimized schedule.
8. **Task 4.8**: Display dynamic setup breakdown (Base Setup + Changeover Delta) in Gantt slot tooltips.
9. **Task 4.9**: Add Supabase persistence for setup matrix rules in `setup_changeover_matrices` PostgreSQL table.
10. **Task 4.10**: Run benchmark tests on 500-order dataset comparing standard setup vs. matrix-optimized makespan.

---

### Feature 5: Interactive Drag-and-Drop Gantt Timeline & Visual Rescheduling (Gantt Engine)
*Delivers zero-latency, drag-and-drop rescheduling across hours, days, and machines with immediate collision snapping.*

#### 10-Task Action List:
1. **Task 5.1**: Enhance HTML5 Drag-and-Drop handlers in [gantt.tsx](file:///d:/schedulersaas/flow-sync-saas/src/routes/gantt.tsx) for horizontal (time shift) and vertical (machine reassignment) dragging.
2. **Task 5.2**: Add visual drag ghost image and target-cell highlight box during active drag operations.
3. **Task 5.3**: Implement `updateSlotSchedule()` action in `store.ts` to pin dragged processes (`isManual = true`) at target machine, date, and hour.
4. **Task 5.4**: Integrate automatic conflict detection: highlight target cell in red if machine group serialization or operator limits are violated.
5. **Task 5.5**: Add "Pin / Unpin" indicator icon on Gantt process blocks to distinguish manually locked jobs from solver-scheduled jobs.
6. **Task 5.6**: Build "Undo / Redo" action stack in `store.ts` to reverse accidental drag-and-drop moves.
7. **Task 5.7**: Implement multi-select drag: hold `Shift` to drag entire multi-step order chains simultaneously.
8. **Task 5.8**: Add Gantt view scaling controls: Year, Month, Week, Day, and Hour zoom levels with smooth scrolling.
9. **Task 5.9**: Optimize Gantt rendering performance using React `useMemo` and virtual windowing for 5,000+ slots.
10. **Task 5.10**: Test drag-and-drop workflow on mobile touch devices and desktop web browsers.

---

### Feature 6: AI "What-If" Scenario Simulation Sandbox & Side-by-Side KPI Compare (`/sandbox`)
*Allows planners to create isolated schedule branches to simulate rush orders, machine breakdowns, or shift changes without affecting production.*

#### 10-Task Action List:
1. **Task 6.1**: Create dedicated `/sandbox` route and page component (`src/routes/sandbox.tsx`).
2. **Task 6.2**: Add `scenarios` state model in `types.ts` (`id`, `name`, `description`, `orders`, `processes`, `slots`, `kpis`).
3. **Task 6.3**: Implement "Create Scenario Branch" modal (e.g., "Branch from Master", "Insert Rush Order #99401", "Simulate Machine M1 Breakdown").
4. **Task 6.4**: Build side-by-side KPI comparison widget evaluating:
   - Total Makespan (Completion Date)
   - Total Setup Hours
   - Workcenter Utilization %
   - On-Time Delivery (OTD %)
   - Operator Capacity Overload Counts
5. **Task 6.5**: Implement dual split-screen Gantt view comparing Baseline vs. Scenario branch visuals.
6. **Task 6.6**: Add "Promote to Master Schedule" action button with confirmation modal to replace active live schedule with simulated branch.
7. **Task 6.7**: Add scenario export (Excel / JSON) for management review and production planning meetings.
8. **Task 6.8**: Save scenario snapshots to `schedule_scenarios` Supabase table.
9. **Task 6.9**: Implement AI Co-Pilot scenario insights generator summarizing trade-offs (e.g., *"Scenario B finishes Rush Order 2 days earlier but adds 4.5 hours of setup time"*).
10. **Task 6.10**: Verify scenario operations operate in complete isolation without mutating `useAppStore` live master state.

---

### Feature 7: Custom Shift Calendars, Work Roster & Maintenance Overrides (`/shifts`)
*Supports multi-shift operations, weekend work rules, and planned preventative maintenance windows per machine group.*

#### 10-Task Action List:
1. **Task 7.1**: Create `/shifts` route and shift management UI component (`src/routes/shifts.tsx`).
2. **Task 7.2**: Define `ShiftCalendar` interface in `types.ts`: 1-shift (08:00–16:00), 2-shift (06:00–22:00), 3-shift (24 Hours), and weekend rosters.
3. **Task 7.3**: Build Maintenance Window creator allowing planners to lock specific workcenters as offline for scheduled repairs.
4. **Task 7.4**: Store shift calendars and maintenance blocks in `dailyCapacities` state in `store.ts`.
5. **Task 7.5**: Update Layer 0 constraint checker in `scheduler.ts` ([scheduler.ts:379](file:///d:/schedulersaas/flow-sync-saas/src/lib/scheduler.ts#L379)) to enforce non-working shift hours and maintenance blocks.
6. **Task 7.6**: Render greyed-out maintenance diagonal stripe pattern on Gantt chart timeline for offline machine hours.
7. **Task 7.7**: Add machine group level assignment: assign Shift Profile A to CNC Machining and Shift Profile B to SMT Lines.
8. **Task 7.8**: Implement holiday calendar importer (iCal / CSV) to auto-populate national manufacturing holidays.
9. **Task 7.9**: Store shift profiles in `shift_calendars` and `maintenance_windows` Supabase tables.
10. **Task 7.10**: Verify solver automatically routes orders around 8-hour maintenance downtime windows without schedule corruption.

---

### Feature 8: SAP PP Round-Trip Integration Pack (LSMW / BDC / COOIS CSV Parser & Exporter)
*Delivers seamless round-trip data integration with SAP PP (COOIS / CM25 / LSMW / BDC / SAP Fiori Upload).*

#### 10-Task Action List:
1. **Task 8.1**: Expand SAP column detection dictionary in [dataCleaner.ts](file:///d:/schedulersaas/flow-sync-saas/src/lib/dataCleaner.ts) for German and English SAP PP tables (`Auftrag`, `Vorgang`, `Material`, `Arbeitsplatz`, `Startdatum`, `Menge`).
2. **Task 8.2**: Create `SapIntegrationModal.tsx` wizard in `DataCleaningHub.tsx` ([DataCleaningHub.tsx](file:///d:/schedulersaas/flow-sync-saas/src/components/DataCleaningHub.tsx)).
3. **Task 8.3**: Add preset configuration for standard SAP `COOIS` layout exports.
4. **Task 8.4**: Build **"Export for SAP LSMW"** button generating clean CSV dispatch tables ready for Legacy System Migration Workbench import.
5. **Task 8.5**: Build **"Export for SAP BDC"** table layout with formatted start/end dates (`YYYYMMDD` and `HHMMSS`).
6. **Task 8.6**: Create visual "SAP Round-Trip Change Log Audit" table displaying original SAP dates vs. CapaSolve optimized dates before export.
7. **Task 8.7**: Add LSMW field mapping editor UI allowing custom SAP field aliases (`AUFNR`, `VORNR`, `ARBPL`, `GSTRS`).
8. **Task 8.8**: Build automated REST endpoint `/api/v1/sap/sync` for direct SAP RFC / BAPI middleware connectors.
9. **Task 8.9**: Provide sample SAP test files (`test_german_sap_fertigung.csv`) for instant 1-click demo evaluation.
10. **Task 8.10**: Test full round-trip: Import `COOIS` CSV $\rightarrow$ Run Finite Solver $\rightarrow$ Export LSMW CSV $\rightarrow$ Validate date format compatibility.

---

### Feature 9: Raw Material Availability & BOM Line-Shortage Warning Engine
*Prevents scheduling operations when raw materials or sub-components are unavailable or delayed.*

#### 10-Task Action List:
1. **Task 9.1**: Create `MaterialInventoryModal.tsx` and Add `MaterialStock` interface to `types.ts` (`sku`, `description`, `availableQty`, `reservedQty`, `leadTimeDays`).
2. **Task 9.2**: Add `materials` inventory state store to `useAppStore` in `store.ts`.
3. **Task 9.3**: Implement Bill of Materials (BOM) requirement parser calculating required raw material quantity per order: `requiredQty = orderQty * bomRatio`.
4. **Task 9.4**: Add Material Constraint Layer to scheduler solver ([scheduler.ts](file:///d:/schedulersaas/flow-sync-saas/src/lib/scheduler.ts)): delay job start date if `availableQty < requiredQty` until material lead time arrival date.
5. **Task 9.5**: Build "Raw Material Shortage Alert" badge on Gantt process blocks and Order table rows.
6. **Task 9.6**: Create Material Shortage Digest table listing all blocked orders, missing component SKUs, and estimated unblock dates.
7. **Task 9.7**: Add CSV importer for raw material inventory snapshots (SKU, On-Hand Qty, Expected Arrival Date).
8. **Task 9.8**: Build Purchase Order (PO) expedite suggestion generator recommending required PO delivery dates to meet SOP schedule.
9. **Task 9.9**: Store inventory and BOM tables in `material_stock` and `order_bom_components` Supabase tables.
10. **Task 9.10**: Validate that injecting a 5-day material shortage automatically shifts dependent machine operations without crashing solver.

---

### Feature 10: Multi-Tenant Supabase Cloud Sync, RBAC Security & Enterprise Analytics (Supabase Auth/DB & OEE)
*Ensures SaaS production readiness with strict tenant isolation, role-based permissions, automated cloud backups, and OEE analytics.*

#### 10-Task Action List:
1. **Task 10.1**: Update Supabase Row-Level Security (RLS) policies in `20260727_master_schema.sql` ensuring strict `tenant_id` isolation across all tables.
2. **Task 10.2**: Implement Role-Based Access Control (RBAC) roles: `SuperAdmin`, `PlantManager`, `Planner`, `ShopFloorOperator`, and `Auditor`.
3. **Task 10.3**: Add UI permission guards concealing edit/delete buttons for `ShopFloorOperator` and `Auditor` roles.
4. **Task 10.4**: Implement multi-tenant workspace switcher dropdown in app header layout ([AppLayout.tsx](file:///d:/schedulersaas/flow-sync-saas/src/components/AppLayout.tsx)).
5. **Task 10.5**: Build background cloud auto-save sync worker in `store.ts` with online/offline status indicators.
6. **Task 10.6**: Upgrade OEE Analytics dashboard ([analytics.tsx](file:///d:/schedulersaas/flow-sync-saas/src/routes/analytics.tsx)) with Availability %, Performance %, and Quality % KPI gauges.
7. **Task 10.7**: Implement automated PDF & PNG report generator for weekly schedule dispatch summary and OEE executive reports.
8. **Task 10.8**: Add audit log tracking system recording all user actions (schedule solving, manual overrides, status changes) in `audit_logs` table.
9. **Task 10.9**: Configure production build optimizations, bundle splitting, and environment variables validation in `vite.config.ts`.
10. **Task 10.10**: Execute end-to-end multi-tenant isolation tests confirming User A (Tenant A) cannot access or modify User B's (Tenant B) production schedules.

---

## Summary of File Modifications

### Existing Files to Modify:
- [src/lib/auth-service.ts](file:///d:/schedulersaas/flow-sync-saas/src/lib/auth-service.ts): Add password reset, OAuth SSO, and MFA bindings.
- [src/lib/auth-guard.ts](file:///d:/schedulersaas/flow-sync-saas/src/lib/auth-guard.ts): Implement automatic token refreshment.
- [src/lib/types.ts](file:///d:/schedulersaas/flow-sync-saas/src/lib/types.ts): Add interfaces for all 10 features.
- [src/lib/store.ts](file:///d:/schedulersaas/flow-sync-saas/src/lib/store.ts): Extend Zustand store with full CRUD, scenario branching, and persistence.
- [src/lib/scheduler.ts](file:///d:/schedulersaas/flow-sync-saas/src/lib/scheduler.ts): Integrate setup matrix, material availability, and shift calendar masks.
- [src/routes/gantt.tsx](file:///d:/schedulersaas/flow-sync-saas/src/routes/gantt.tsx): Add virtual windowing, drag-drop polyfills, and maintenance overlays.
- [src/routes/status.tsx](file:///d:/schedulersaas/flow-sync-saas/src/routes/status.tsx): Convert into card-based shop floor execution tracker.
- [src/routes/analytics.tsx](file:///d:/schedulersaas/flow-sync-saas/src/routes/analytics.tsx): Add OEE gauge widgets and scrap breakdown charts.

### New Components & Routes to Create:
- `src/routes/forgot-password.tsx` & `src/routes/reset-password.tsx`: Password recovery UI.
- `src/routes/kiosk.tsx`: Shop Floor Touchscreen Operator Kiosk view.
- `src/routes/sandbox.tsx`: AI "What-If" Scenario Simulation Sandbox page.
- `src/routes/shifts.tsx`: Custom Shift Calendar and Maintenance Manager.
- `src/api/v1/`: Serverless Hono API endpoints and OpenAPI schemas.
- `supabase/migrations/20260802_next_level_features.sql`: PostgreSQL database migration file.

---

## Verification & Testing Plan

### Automated Tests:
- **Auth & Password Reset**: Verify `resetPasswordForEmail()` and OAuth redirect callbacks.
- **State Store & Scheduler Tests**: Run unit tests on `addOrder()`, `logProcessProgress()`, and scenario branching in `store.ts`.
- **TypeScript Compliance**: Run `npx tsc --noEmit` to verify type checking across all 150 tasks.

### Manual Verification Steps:
1. **Password Reset Flow**: Request password reset email from `/forgot-password`, follow link to `/reset-password`, enter new password, verify successful login.
2. **Database RLS Verification**: Query Supabase PostgreSQL tables using Tenant A session $\rightarrow$ confirm zero access to Tenant B records.
3. **API Rate Limiting**: Send 105 rapid requests to `/api/v1/schedule/solve` $\rightarrow$ verify 429 Too Many Requests response on request #101.
4. **Shop Floor Kiosk**: Open `/kiosk` on mobile/tablet screen, log 50 units completed $\rightarrow$ verify Gantt chart updates in real-time.
5. **Scenario Sandbox**: Create "Rush Order Scenario" branch in `/sandbox`, compare KPIs side-by-side with Baseline, promote to Master schedule.
