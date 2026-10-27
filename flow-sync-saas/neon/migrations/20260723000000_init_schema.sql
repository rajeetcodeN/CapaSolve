-- Create Organizations Table
CREATE TABLE public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    plan TEXT NOT NULL DEFAULT 'FREE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for organizations
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Create Organization Memberships Table
CREATE TABLE public.organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('ADMIN', 'DEVELOPER', 'GUEST')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (org_id, user_id)
);

-- Enable RLS for organization memberships
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- Helper Function to check organization membership role
CREATE OR REPLACE FUNCTION public.get_user_role_in_org(org_id UUID, user_id UUID)
RETURNS TEXT AS $$
    SELECT role FROM public.organization_members
    WHERE org_id = $1 AND user_id = $2;
$$ LANGUAGE sql SECURITY DEFINER;

-- Helper Function to check if user is in organization
CREATE OR REPLACE FUNCTION public.is_org_member(org_id UUID, user_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE org_id = $1 AND user_id = $2
    );
$$ LANGUAGE sql SECURITY DEFINER;

-- RLS Policies for Organizations
CREATE POLICY "Users can view their own organizations" ON public.organizations
    FOR SELECT USING (public.is_org_member(id, auth.uid()));

CREATE POLICY "Admins can update their organizations" ON public.organizations
    FOR UPDATE USING (public.get_user_role_in_org(id, auth.uid()) = 'ADMIN');

-- RLS Policies for Organization Members
CREATE POLICY "Users can view members of their organizations" ON public.organization_members
    FOR SELECT USING (public.is_org_member(org_id, auth.uid()));

CREATE POLICY "Admins can invite/add members to their organizations" ON public.organization_members
    FOR INSERT WITH CHECK (public.get_user_role_in_org(org_id, auth.uid()) = 'ADMIN');

CREATE POLICY "Admins can update members role in their organizations" ON public.organization_members
    FOR UPDATE USING (public.get_user_role_in_org(org_id, auth.uid()) = 'ADMIN');

CREATE POLICY "Admins can remove members from their organizations" ON public.organization_members
    FOR DELETE USING (public.get_user_role_in_org(org_id, auth.uid()) = 'ADMIN');

-- Create Schedules Table
CREATE TABLE public.schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for schedules
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Schedules
CREATE POLICY "Users can view schedules of their organizations" ON public.schedules
    FOR SELECT USING (public.is_org_member(org_id, auth.uid()));

CREATE POLICY "Developers and Admins can insert schedules for their organizations" ON public.schedules
    FOR INSERT WITH CHECK (
        public.is_org_member(org_id, auth.uid()) AND
        public.get_user_role_in_org(org_id, auth.uid()) IN ('ADMIN', 'DEVELOPER')
    );

CREATE POLICY "Developers and Admins can update schedules in their organizations" ON public.schedules
    FOR UPDATE USING (
        public.is_org_member(org_id, auth.uid()) AND
        public.get_user_role_in_org(org_id, auth.uid()) IN ('ADMIN', 'DEVELOPER')
    );

CREATE POLICY "Developers and Admins can delete schedules in their organizations" ON public.schedules
    FOR DELETE USING (
        public.is_org_member(org_id, auth.uid()) AND
        public.get_user_role_in_org(org_id, auth.uid()) IN ('ADMIN', 'DEVELOPER')
    );

-- Create Schedule Data Table (JSON payload store)
CREATE TABLE public.schedule_data (
    schedule_id UUID PRIMARY KEY REFERENCES public.schedules(id) ON DELETE CASCADE,
    data JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for schedule data
ALTER TABLE public.schedule_data ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Schedule Data
CREATE POLICY "Users can view schedule data of their organizations" ON public.schedule_data
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.schedules
            WHERE id = schedule_id AND public.is_org_member(org_id, auth.uid())
        )
    );

CREATE POLICY "Developers and Admins can write schedule data for their organizations" ON public.schedule_data
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.schedules
            WHERE id = schedule_id AND 
                  public.is_org_member(org_id, auth.uid()) AND
                  public.get_user_role_in_org(org_id, auth.uid()) IN ('ADMIN', 'DEVELOPER')
        )
    );

-- Create Audit Logs Table
CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for audit logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Audit Logs
CREATE POLICY "Users can view audit logs of their organizations" ON public.audit_logs
    FOR SELECT USING (public.is_org_member(org_id, auth.uid()));

CREATE POLICY "System can insert audit logs" ON public.audit_logs
    FOR INSERT WITH CHECK (public.is_org_member(org_id, auth.uid()));

-- Create Invitations Table
CREATE TABLE public.invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
    email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('ADMIN', 'DEVELOPER', 'GUEST')),
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    accepted_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS for invitations
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Invitations
CREATE POLICY "Admins can view invitations of their organizations" ON public.invitations
    FOR SELECT USING (public.get_user_role_in_org(org_id, auth.uid()) = 'ADMIN');

CREATE POLICY "Admins can manage invitations of their organizations" ON public.invitations
    FOR ALL USING (public.get_user_role_in_org(org_id, auth.uid()) = 'ADMIN');

-- Allow matching invitees to view their invite by token
CREATE POLICY "Invitees can view invite by token" ON public.invitations
    FOR SELECT USING (true);
