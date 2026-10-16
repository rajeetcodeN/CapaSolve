-- CapaSolve SaaS Next-Level Features Migration Script
-- Migration: 20260802_next_level_features.sql
-- Description: Adds tables for Setup Matrices, What-If Scenarios, Shift Calendars, Maintenance, Material Stock, BOM Components, Execution Logs, and Audit Trail.

-- ============================================================================
-- 1. SETUP CHANGEOVER MATRICES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.setup_changeover_matrices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
    from_material TEXT NOT NULL,
    to_material TEXT NOT NULL,
    machine_group_id TEXT,
    changeover_mins NUMERIC(10, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unq_setup_matrix_org_mat UNIQUE (org_id, from_material, to_material, machine_group_id)
);

ALTER TABLE public.setup_changeover_matrices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view setup matrix in their org" ON public.setup_changeover_matrices
    FOR SELECT USING (public.is_org_member(org_id, auth.uid()));

CREATE POLICY "Planners/Admins can modify setup matrix" ON public.setup_changeover_matrices
    FOR ALL USING (
        public.get_user_role_in_org(org_id, auth.uid()) IN ('ADMIN', 'DEVELOPER')
    );

-- ============================================================================
-- 2. WHAT-IF SCHEDULE SCENARIOS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.schedule_scenarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    is_master BOOLEAN DEFAULT false NOT NULL,
    scenario_data JSONB NOT NULL,
    kpi_metrics JSONB,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.schedule_scenarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view scenarios in their org" ON public.schedule_scenarios
    FOR SELECT USING (public.is_org_member(org_id, auth.uid()));

CREATE POLICY "Planners/Admins can manage scenarios" ON public.schedule_scenarios
    FOR ALL USING (
        public.get_user_role_in_org(org_id, auth.uid()) IN ('ADMIN', 'DEVELOPER')
    );

-- ============================================================================
-- 3. SHIFT CALENDARS & MAINTENANCE WINDOWS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.shift_calendars (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
    machine_group_id TEXT,
    shift_name TEXT NOT NULL,
    start_hour INTEGER NOT NULL CHECK (start_hour >= 0 AND start_hour <= 23),
    end_hour INTEGER NOT NULL CHECK (end_hour >= 0 AND end_hour <= 24),
    working_days INTEGER[] DEFAULT '{1,2,3,4,5}' NOT NULL, -- 1=Monday, 7=Sunday
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.shift_calendars ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view shift calendars in org" ON public.shift_calendars
    FOR SELECT USING (public.is_org_member(org_id, auth.uid()));

CREATE POLICY "Admins manage shift calendars" ON public.shift_calendars
    FOR ALL USING (
        public.get_user_role_in_org(org_id, auth.uid()) IN ('ADMIN', 'DEVELOPER')
    );

CREATE TABLE IF NOT EXISTS public.maintenance_windows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
    machine_id TEXT NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.maintenance_windows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view maintenance in org" ON public.maintenance_windows
    FOR SELECT USING (public.is_org_member(org_id, auth.uid()));

CREATE POLICY "Admins manage maintenance" ON public.maintenance_windows
    FOR ALL USING (
        public.get_user_role_in_org(org_id, auth.uid()) IN ('ADMIN', 'DEVELOPER')
    );

-- ============================================================================
-- 4. RAW MATERIAL STOCK & BOM COMPONENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.material_stock (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
    sku TEXT NOT NULL,
    description TEXT,
    available_qty NUMERIC(12, 4) DEFAULT 0 NOT NULL,
    reserved_qty NUMERIC(12, 4) DEFAULT 0 NOT NULL,
    lead_time_days INTEGER DEFAULT 0 NOT NULL,
    expected_arrival TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unq_material_org_sku UNIQUE (org_id, sku)
);

ALTER TABLE public.material_stock ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view material stock in org" ON public.material_stock
    FOR SELECT USING (public.is_org_member(org_id, auth.uid()));

CREATE POLICY "Planners/Admins manage material stock" ON public.material_stock
    FOR ALL USING (
        public.get_user_role_in_org(org_id, auth.uid()) IN ('ADMIN', 'DEVELOPER')
    );

-- ============================================================================
-- 5. PROCESS EXECUTION LOGS & SCRAP TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.process_execution_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
    process_id TEXT NOT NULL,
    completed_qty NUMERIC(10, 2) NOT NULL DEFAULT 0,
    scrap_qty NUMERIC(10, 2) NOT NULL DEFAULT 0,
    actual_setup_mins NUMERIC(10, 2),
    actual_process_mins NUMERIC(10, 2),
    logged_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.process_execution_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view execution logs in org" ON public.process_execution_logs
    FOR SELECT USING (public.is_org_member(org_id, auth.uid()));

CREATE POLICY "Users insert execution logs in org" ON public.process_execution_logs
    FOR INSERT WITH CHECK (public.is_org_member(org_id, auth.uid()));

-- ============================================================================
-- 6. SYSTEM AUDIT TRAIL LOGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view audit logs in org" ON public.audit_logs
    FOR SELECT USING (public.is_org_member(org_id, auth.uid()));

CREATE POLICY "System insert audit logs" ON public.audit_logs
    FOR INSERT WITH CHECK (public.is_org_member(org_id, auth.uid()));

-- ============================================================================
-- 7. PERFORMANCE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_setup_matrix_org ON public.setup_changeover_matrices(org_id, from_material, to_material);
CREATE INDEX IF NOT EXISTS idx_scenarios_org ON public.schedule_scenarios(org_id, is_master);
CREATE INDEX IF NOT EXISTS idx_maintenance_org_mach ON public.maintenance_windows(org_id, machine_id);
CREATE INDEX IF NOT EXISTS idx_material_stock_sku ON public.material_stock(org_id, sku);
CREATE INDEX IF NOT EXISTS idx_execution_logs_proc ON public.process_execution_logs(org_id, process_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_date ON public.audit_logs(org_id, created_at DESC);
