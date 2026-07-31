-- CapaSolve SaaS Master Database Schema Migration
-- Project: CapaSolve / SchedulerSaaS
-- Run this complete script in your Supabase SQL Editor (https://supabase.com/dashboard/project/ymvdbaexgtxjjrpodiwf/sql/new)

-- ============================================================================
-- 1. BASE TABLES: ORGANIZATIONS & MEMBERSHIPS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    plan TEXT NOT NULL DEFAULT 'FREE' CHECK (plan IN ('FREE', 'PRO', 'ENTERPRISE')),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('ADMIN', 'DEVELOPER', 'GUEST')),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unq_org_members_org_user UNIQUE (org_id, user_id)
);

ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. USER PROFILES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    avatar_url TEXT,
    job_title TEXT,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. HELPER SECURITY FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_user_role_in_org(org_id UUID, user_id UUID)
RETURNS TEXT AS $$
    SELECT role FROM public.organization_members
    WHERE org_id = $1 AND user_id = $2;
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_org_member(org_id UUID, user_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE org_id = $1 AND user_id = $2
    );
$$ LANGUAGE sql SECURITY DEFINER;

-- ============================================================================
-- 4. BASE RLS POLICIES
-- ============================================================================

CREATE POLICY "Users can view their own organizations" ON public.organizations
    FOR SELECT USING (public.is_org_member(id, auth.uid()));

CREATE POLICY "Admins can update their organizations" ON public.organizations
    FOR UPDATE USING (public.get_user_role_in_org(id, auth.uid()) = 'ADMIN');

CREATE POLICY "Users can view members of their organizations" ON public.organization_members
    FOR SELECT USING (public.is_org_member(org_id, auth.uid()));

CREATE POLICY "Admins can invite/add members" ON public.organization_members
    FOR INSERT WITH CHECK (public.get_user_role_in_org(org_id, auth.uid()) = 'ADMIN');

CREATE POLICY "Admins can update members role" ON public.organization_members
    FOR UPDATE USING (public.get_user_role_in_org(org_id, auth.uid()) = 'ADMIN');

CREATE POLICY "Admins can remove members" ON public.organization_members
    FOR DELETE USING (public.get_user_role_in_org(org_id, auth.uid()) = 'ADMIN');

CREATE POLICY "Users can view profile info in their org" ON public.profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.organization_members my_om
            JOIN public.organization_members other_om ON my_om.org_id = other_om.org_id
            WHERE my_om.user_id = auth.uid() AND other_om.user_id = public.profiles.id
        )
    );

CREATE POLICY "Users can update their own profile" ON public.profiles
    FOR UPDATE USING (id = auth.uid());

CREATE POLICY "Users insert profile on signup" ON public.profiles
    FOR INSERT WITH CHECK (id = auth.uid());

-- ============================================================================
-- 5. SCHEDULES & SCHEDULE DATA
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view schedules" ON public.schedules
    FOR SELECT USING (public.is_org_member(org_id, auth.uid()));

CREATE POLICY "Developers and Admins insert schedules" ON public.schedules
    FOR INSERT WITH CHECK (
        public.is_org_member(org_id, auth.uid()) AND
        public.get_user_role_in_org(org_id, auth.uid()) IN ('ADMIN', 'DEVELOPER')
    );

CREATE POLICY "Developers and Admins update schedules" ON public.schedules
    FOR UPDATE USING (
        public.is_org_member(org_id, auth.uid()) AND
        public.get_user_role_in_org(org_id, auth.uid()) IN ('ADMIN', 'DEVELOPER')
    );

CREATE POLICY "Admins delete schedules" ON public.schedules
    FOR DELETE USING (
        public.is_org_member(org_id, auth.uid()) AND
        public.get_user_role_in_org(org_id, auth.uid()) = 'ADMIN'
    );

CREATE TABLE IF NOT EXISTS public.schedule_data (
    schedule_id UUID PRIMARY KEY REFERENCES public.schedules(id) ON DELETE CASCADE,
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.schedule_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view schedule data" ON public.schedule_data
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.schedules
            WHERE id = schedule_id AND public.is_org_member(org_id, auth.uid())
        )
    );

CREATE POLICY "Developers and Admins write schedule data" ON public.schedule_data
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.schedules
            WHERE id = schedule_id AND 
                  public.is_org_member(org_id, auth.uid()) AND
                  public.get_user_role_in_org(org_id, auth.uid()) IN ('ADMIN', 'DEVELOPER')
        )
    );

-- ============================================================================
-- 6. AUDIT LOGS & INVITATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    details TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view audit logs" ON public.audit_logs
    FOR SELECT USING (public.is_org_member(org_id, auth.uid()));

CREATE POLICY "System inserts audit logs" ON public.audit_logs
    FOR INSERT WITH CHECK (public.is_org_member(org_id, auth.uid()));

CREATE TABLE IF NOT EXISTS public.invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
    email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('ADMIN', 'DEVELOPER', 'GUEST')),
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    accepted_at TIMESTAMPTZ
);

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage invitations" ON public.invitations
    FOR ALL USING (public.get_user_role_in_org(org_id, auth.uid()) = 'ADMIN');

CREATE POLICY "Invitees view invite by token" ON public.invitations
    FOR SELECT USING (true);

-- ============================================================================
-- 7. MACHINES & MACHINE GROUPS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.machine_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unq_machine_groups_org_code UNIQUE (org_id, code)
);

ALTER TABLE public.machine_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members manage machine_groups" ON public.machine_groups
    FOR ALL USING (public.is_org_member(org_id, auth.uid()));

CREATE TABLE IF NOT EXISTS public.machines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
    machine_group_id UUID REFERENCES public.machine_groups(id) ON DELETE CASCADE NOT NULL,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unq_machines_org_code UNIQUE (org_id, code)
);

ALTER TABLE public.machines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members manage machines" ON public.machines
    FOR ALL USING (public.is_org_member(org_id, auth.uid()));

-- ============================================================================
-- 8. CAPACITY PROFILES & OVERRIDES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.capacity_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL DEFAULT 'Default Profile',
    setter_capacity_pct INTEGER NOT NULL DEFAULT 100 CHECK (setter_capacity_pct BETWEEN 10 AND 1000),
    operator_capacity_pct INTEGER NOT NULL DEFAULT 200 CHECK (operator_capacity_pct BETWEEN 10 AND 1000),
    working_hours_start INTEGER NOT NULL DEFAULT 6 CHECK (working_hours_start BETWEEN 0 AND 23),
    working_hours_end INTEGER NOT NULL DEFAULT 20 CHECK (working_hours_end BETWEEN 1 AND 24),
    is_default BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.capacity_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members manage capacity_profiles" ON public.capacity_profiles
    FOR ALL USING (public.is_org_member(org_id, auth.uid()));

CREATE TABLE IF NOT EXISTS public.daily_capacity_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES public.capacity_profiles(id) ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL,
    setter_capacity_pct INTEGER,
    operator_capacity_pct INTEGER,
    is_holiday BOOLEAN DEFAULT false NOT NULL,
    note TEXT,
    CONSTRAINT unq_daily_override_profile_date UNIQUE (profile_id, date)
);

ALTER TABLE public.daily_capacity_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members manage daily_capacity_overrides" ON public.daily_capacity_overrides
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.capacity_profiles cp
            WHERE cp.id = profile_id AND public.is_org_member(cp.org_id, auth.uid())
        )
    );

-- ============================================================================
-- 9. SCHEDULER CONFIGS, EXECUTION LOGS & SUBSCRIPTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.scheduler_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID REFERENCES public.schedules(id) ON DELETE CASCADE NOT NULL UNIQUE,
    optimization_mode TEXT NOT NULL DEFAULT 'full' CHECK (optimization_mode IN ('pre', 'workstation', 'full')),
    group_serialization BOOLEAN DEFAULT false NOT NULL,
    allow_process_overlap BOOLEAN DEFAULT true NOT NULL,
    allow_sop_override BOOLEAN DEFAULT true NOT NULL,
    max_utilize_resources BOOLEAN DEFAULT true NOT NULL,
    max_prepone_weeks INTEGER DEFAULT 0 NOT NULL,
    capacity_profile_id UUID REFERENCES public.capacity_profiles(id) ON DELETE SET NULL
);

ALTER TABLE public.scheduler_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members manage scheduler_configs" ON public.scheduler_configs
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.schedules s
            WHERE s.id = schedule_id AND public.is_org_member(s.org_id, auth.uid())
        )
    );

CREATE TABLE IF NOT EXISTS public.schedule_execution_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID REFERENCES public.schedules(id) ON DELETE CASCADE NOT NULL,
    org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
    triggered_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    order_count INTEGER NOT NULL,
    process_count INTEGER NOT NULL,
    duration_ms INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('SUCCESS', 'WARNING', 'FAILED')),
    warning_count INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.schedule_execution_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view execution logs" ON public.schedule_execution_logs
    FOR SELECT USING (public.is_org_member(org_id, auth.uid()));

CREATE TABLE IF NOT EXISTS public.api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
    key_hash TEXT NOT NULL UNIQUE,
    prefix TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT 'Default API Key',
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    last_used_at TIMESTAMPTZ
);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage api_keys" ON public.api_keys
    FOR ALL USING (public.get_user_role_in_org(org_id, auth.uid()) = 'ADMIN');

CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL UNIQUE,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    plan TEXT NOT NULL DEFAULT 'FREE' CHECK (plan IN ('FREE', 'PRO', 'ENTERPRISE')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'canceled', 'trialing')),
    trial_ends_at TIMESTAMPTZ,
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage subscriptions" ON public.subscriptions
    FOR ALL USING (public.get_user_role_in_org(org_id, auth.uid()) = 'ADMIN');

-- ============================================================================
-- 10. INDEXES FOR HIGH PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_org_members_user ON public.organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_schedules_org ON public.schedules(org_id);
CREATE INDEX IF NOT EXISTS idx_machine_groups_org ON public.machine_groups(org_id);
CREATE INDEX IF NOT EXISTS idx_machines_org_group ON public.machines(org_id, machine_group_id);
CREATE INDEX IF NOT EXISTS idx_capacity_profiles_org ON public.capacity_profiles(org_id);
CREATE INDEX IF NOT EXISTS idx_daily_override_lookup ON public.daily_capacity_overrides(profile_id, date);
CREATE INDEX IF NOT EXISTS idx_exec_logs_org_created ON public.schedule_execution_logs(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON public.api_keys(key_hash);

-- ============================================================================
-- 11. AUTOMATED SIGNUP & PROVISIONING TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user_signup()
RETURNS TRIGGER AS $$
DECLARE
    new_org_id UUID;
    org_name TEXT;
    user_name TEXT;
BEGIN
    user_name := COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1));
    org_name := COALESCE(NEW.raw_user_meta_data->>'org_name', user_name || ' Factory');
    
    -- Insert Profile
    INSERT INTO public.profiles (id, full_name)
    VALUES (NEW.id, user_name)
    ON CONFLICT (id) DO NOTHING;

    -- Create Organization
    INSERT INTO public.organizations (name, slug, plan)
    VALUES (org_name, 'org-' || SUBSTRING(NEW.id::text, 1, 8), 'FREE')
    RETURNING id INTO new_org_id;

    -- Assign ADMIN role to user in organization
    INSERT INTO public.organization_members (org_id, user_id, role)
    VALUES (new_org_id, NEW.id, 'ADMIN');

    -- Create default capacity profile
    INSERT INTO public.capacity_profiles (org_id, name, setter_capacity_pct, operator_capacity_pct, is_default)
    VALUES (new_org_id, 'Default Capacity Profile', 100, 200, true);

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Prevent signup failure if org creation encounters duplicate slug
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_signup();
