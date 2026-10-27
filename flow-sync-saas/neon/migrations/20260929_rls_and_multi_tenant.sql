-- ==============================================================================
-- CapaSolve Enterprise Multi-Tenancy & Row-Level Security (RLS) Schema Migration
-- Migration ID: 20260929_rls_and_multi_tenant.sql
-- ==============================================================================

-- 1. Organizations & Organization Membership
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    subscription_tier TEXT NOT NULL DEFAULT 'STARTER', -- STARTER, PRO, ENTERPRISE
    subscription_status TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, PAST_DUE, CANCELED
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure columns exist if table was created in prior migration
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'STARTER';
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'ACTIVE';

CREATE TABLE IF NOT EXISTS public.organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'OPERATOR', -- ADMIN, DEVELOPER, PLANNER, OPERATOR, VIEWER, GUEST
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (org_id, user_id)
);

-- Update role constraint if present from earlier migration
DO $$ 
BEGIN
    ALTER TABLE public.organization_members DROP CONSTRAINT IF EXISTS organization_members_role_check;
    ALTER TABLE public.organization_members ADD CONSTRAINT organization_members_role_check 
        CHECK (role IN ('ADMIN', 'DEVELOPER', 'PLANNER', 'OPERATOR', 'VIEWER', 'GUEST'));
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- 2. API Keys for External Integration Gateway
CREATE TABLE IF NOT EXISTS public.api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    key_hash TEXT NOT NULL UNIQUE,
    prefix TEXT NOT NULL,
    scopes TEXT[] DEFAULT ARRAY['read', 'write', 'solve'],
    is_revoked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ
);

-- 3. Production Schedules & Active Floor Snapshot
CREATE TABLE IF NOT EXISTS public.schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.schedule_data (
    schedule_id UUID PRIMARY KEY REFERENCES public.schedules(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Shop Floor Execution & Scrap Audit Trail
CREATE TABLE IF NOT EXISTS public.execution_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    process_id TEXT NOT NULL,
    order_id TEXT NOT NULL,
    machine_id TEXT NOT NULL,
    status TEXT NOT NULL,
    completed_qty INTEGER DEFAULT 0,
    scrap_qty INTEGER DEFAULT 0,
    hold_reason TEXT,
    scrap_reason TEXT,
    notes TEXT,
    operator_id UUID REFERENCES auth.users(id),
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- RLS Helper Security Definer Functions
-- ==============================================================================

-- Extract active organization ID for the authenticated JWT user
CREATE OR REPLACE FUNCTION public.get_auth_org_id()
RETURNS UUID AS $$
  SELECT org_id
  FROM public.organization_members
  WHERE user_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Check if user is an ADMIN or DEVELOPER in their current organization
CREATE OR REPLACE FUNCTION public.is_org_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE user_id = auth.uid()
      AND role IN ('ADMIN', 'DEVELOPER')
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ==============================================================================
-- Enable Row Level Security (RLS) & Define Strict Policies
-- ==============================================================================

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.execution_logs ENABLE ROW LEVEL SECURITY;

-- Organizations Policy: Users can only see their own organization
CREATE POLICY "Users can view their organization"
ON public.organizations
FOR SELECT
USING (id = public.get_auth_org_id());

-- Organization Members Policy: Members can view team members in same org
CREATE POLICY "Members can view peers in same org"
ON public.organization_members
FOR SELECT
USING (org_id = public.get_auth_org_id());

CREATE POLICY "Admins can manage organization members"
ON public.organization_members
FOR ALL
USING (org_id = public.get_auth_org_id() AND public.is_org_admin());

-- API Keys Policy: Admins can view and manage API keys for their org
CREATE POLICY "Admins can manage api keys"
ON public.api_keys
FOR ALL
USING (org_id = public.get_auth_org_id() AND public.is_org_admin());

-- Schedules Policies
CREATE POLICY "Org members can view schedules"
ON public.schedules
FOR SELECT
USING (org_id = public.get_auth_org_id());

CREATE POLICY "Planners and Admins can create and update schedules"
ON public.schedules
FOR ALL
USING (org_id = public.get_auth_org_id());

-- Schedule Data Policies
CREATE POLICY "Org members can view schedule data"
ON public.schedule_data
FOR SELECT
USING (org_id = public.get_auth_org_id());

CREATE POLICY "Planners and Floor Operators can update schedule data"
ON public.schedule_data
FOR ALL
USING (org_id = public.get_auth_org_id());

-- Execution Logs Policies
CREATE POLICY "Org members can view execution logs"
ON public.execution_logs
FOR SELECT
USING (org_id = public.get_auth_org_id());

CREATE POLICY "Floor operators and planners can insert execution logs"
ON public.execution_logs
FOR INSERT
WITH CHECK (org_id = public.get_auth_org_id());

-- ==============================================================================
-- Realtime Replication Setup
-- ==============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.schedule_data;
ALTER PUBLICATION supabase_realtime ADD TABLE public.execution_logs;
