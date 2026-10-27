import { neon } from "@neondatabase/serverless";

const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

if (!connectionString) {
  console.error("No DATABASE_URL found in environment variables.");
  process.exit(1);
}

console.log("Connecting to Neon Postgres...");
const sql = neon(connectionString);

async function runMigration() {
  try {
    // 0. Ensure auth schema and auth.users exist so FK and RLS work smoothly
    console.log("0. Setting up auth schema & functions...");
    await sql`CREATE SCHEMA IF NOT EXISTS auth;`;

    await sql`
      CREATE TABLE IF NOT EXISTS auth.users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT UNIQUE,
        raw_user_meta_data JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
      );
    `;

    await sql`
      CREATE OR REPLACE FUNCTION auth.uid()
      RETURNS UUID AS $$
        SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
      $$ LANGUAGE sql STABLE;
    `;

    // 1. Organizations
    console.log("1. Creating organizations & members...");
    await sql`
      CREATE TABLE IF NOT EXISTS public.organizations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        plan TEXT NOT NULL DEFAULT 'FREE' CHECK (plan IN ('FREE', 'PRO', 'ENTERPRISE')),
        created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS public.organization_members (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
        user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('ADMIN', 'DEVELOPER', 'GUEST')),
        created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
        CONSTRAINT unq_org_members_org_user UNIQUE (org_id, user_id)
      );
    `;

    // 2. Profiles
    console.log("2. Creating profiles...");
    await sql`
      CREATE TABLE IF NOT EXISTS public.profiles (
        id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
        full_name TEXT,
        avatar_url TEXT,
        job_title TEXT,
        updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
      );
    `;

    // 3. Helper functions
    console.log("3. Creating helper functions...");
    await sql`
      CREATE OR REPLACE FUNCTION public.get_user_role_in_org(org_id UUID, user_id UUID)
      RETURNS TEXT AS $$
        SELECT role FROM public.organization_members
        WHERE org_id = $1 AND user_id = $2;
      $$ LANGUAGE sql SECURITY DEFINER;
    `;

    await sql`
      CREATE OR REPLACE FUNCTION public.is_org_member(org_id UUID, user_id UUID)
      RETURNS BOOLEAN AS $$
        SELECT EXISTS (
          SELECT 1 FROM public.organization_members
          WHERE org_id = $1 AND user_id = $2
        );
      $$ LANGUAGE sql SECURITY DEFINER;
    `;

    // 4. Schedules & schedule data
    console.log("4. Creating schedules & schedule_data...");
    await sql`
      CREATE TABLE IF NOT EXISTS public.schedules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
        name TEXT NOT NULL,
        created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS public.schedule_data (
        schedule_id UUID PRIMARY KEY REFERENCES public.schedules(id) ON DELETE CASCADE,
        data JSONB NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
      );
    `;

    // 5. Audit logs & invitations
    console.log("5. Creating audit_logs & invitations...");
    await sql`
      CREATE TABLE IF NOT EXISTS public.audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
        user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
        action TEXT NOT NULL,
        details TEXT,
        created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
      );
    `;

    await sql`
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
    `;

    // 6. Machines & machine groups
    console.log("6. Creating machine_groups & machines...");
    await sql`
      CREATE TABLE IF NOT EXISTS public.machine_groups (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
        code TEXT NOT NULL,
        name TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
        CONSTRAINT unq_machine_groups_org_code UNIQUE (org_id, code)
      );
    `;

    await sql`
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
    `;

    // 7. Capacity profiles & overrides
    console.log("7. Creating capacity_profiles & daily_capacity_overrides...");
    await sql`
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
    `;

    await sql`
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
    `;

    // 8. Scheduler configs, execution logs & subscriptions
    console.log("8. Creating scheduler_configs, schedule_execution_logs, api_keys, subscriptions...");
    await sql`
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
    `;

    await sql`
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
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS public.api_keys (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
        key_hash TEXT NOT NULL UNIQUE,
        prefix TEXT NOT NULL,
        name TEXT NOT NULL DEFAULT 'Default API Key',
        created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
        last_used_at TIMESTAMPTZ
      );
    `;

    await sql`
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
    `;

    // 9. Indexes
    console.log("9. Creating indexes...");
    await sql`CREATE INDEX IF NOT EXISTS idx_org_members_user ON public.organization_members(user_id);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_schedules_org ON public.schedules(org_id);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_machine_groups_org ON public.machine_groups(org_id);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_machines_org_group ON public.machines(org_id, machine_group_id);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_capacity_profiles_org ON public.capacity_profiles(org_id);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_daily_override_lookup ON public.daily_capacity_overrides(profile_id, date);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_exec_logs_org_created ON public.schedule_execution_logs(org_id, created_at DESC);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON public.api_keys(key_hash);`;

    // 10. Automated signup trigger
    console.log("10. Creating signup provisioning function and trigger...");
    await sql`
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
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `;

    await sql`DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;`;
    await sql`
      CREATE TRIGGER on_auth_user_created
        AFTER INSERT ON auth.users
        FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_signup();
    `;

    // Verify tables
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `;
    console.log("✅ Schema migration successfully completed on Neon Lakebase Postgres!");
    console.log("Public tables in Neon DB:", tables.map((t) => t.table_name));
  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  }
}

runMigration();
