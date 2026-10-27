import { neon } from "@neondatabase/serverless";

const isBrowser = typeof window !== "undefined";

const connectionString = isBrowser
  ? import.meta.env.VITE_DATABASE_URL
  : process.env.DATABASE_URL || import.meta.env.VITE_DATABASE_URL;

if (!connectionString) {
  console.warn(
    "[CapaSolve] Missing DATABASE_URL in environment configuration. Neon Postgres queries will be disabled until configured.",
  );
}

// Neon serverless SQL client (HTTP transport, pooled connection)
export const sql = neon(connectionString || "");

export interface OrganizationRow {
  id: string;
  name: string;
  slug: string;
  plan: "FREE" | "PRO" | "ENTERPRISE";
  created_at: string;
  updated_at: string;
}

export interface OrganizationMemberRow {
  id: string;
  org_id: string;
  user_id: string;
  role: "ADMIN" | "DEVELOPER" | "GUEST";
  created_at: string;
}

export interface ScheduleRow {
  id: string;
  org_id: string;
  name: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Neon Database Repository helpers
 */
export const neonDb = {
  async getOrganization(orgId: string): Promise<OrganizationRow | null> {
    const rows = await sql`
      SELECT id, name, slug, plan, created_at, updated_at
      FROM public.organizations
      WHERE id = ${orgId}
      LIMIT 1;
    `;
    return (rows[0] as OrganizationRow) || null;
  },

  async getUserOrganization(userId: string): Promise<{ org: OrganizationRow; role: string } | null> {
    const rows = await sql`
      SELECT 
        o.id, o.name, o.slug, o.plan, o.created_at, o.updated_at,
        om.role
      FROM public.organization_members om
      JOIN public.organizations o ON om.org_id = o.id
      WHERE om.user_id = ${userId}
      LIMIT 1;
    `;
    if (!rows.length) return null;
    const row = rows[0] as any;
    return {
      org: {
        id: row.id,
        name: row.name,
        slug: row.slug,
        plan: row.plan,
        created_at: row.created_at,
        updated_at: row.updated_at,
      },
      role: row.role,
    };
  },

  async saveSchedule(
    orgId: string,
    scheduleName: string,
    data: any,
    userId?: string | null,
  ): Promise<string> {
    // 1. Find or insert schedule
    const existing = await sql`
      SELECT id FROM public.schedules WHERE org_id = ${orgId} LIMIT 1;
    `;
    let scheduleId = existing[0]?.id;

    if (!scheduleId) {
      const inserted = await sql`
        INSERT INTO public.schedules (org_id, name, created_by)
        VALUES (${orgId}, ${scheduleName}, ${userId || null})
        RETURNING id;
      `;
      scheduleId = inserted[0]?.id;
    }

    // 2. Upsert schedule data
    await sql`
      INSERT INTO public.schedule_data (schedule_id, data, updated_at)
      VALUES (${scheduleId}, ${JSON.stringify(data)}, timezone('utc'::text, now()))
      ON CONFLICT (schedule_id) DO UPDATE
      SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at;
    `;

    return scheduleId;
  },

  async loadSchedule(orgId: string): Promise<any | null> {
    const rows = await sql`
      SELECT sd.data, s.id, s.name
      FROM public.schedules s
      JOIN public.schedule_data sd ON s.id = sd.schedule_id
      WHERE s.org_id = ${orgId}
      ORDER BY s.updated_at DESC
      LIMIT 1;
    `;
    if (!rows.length) return null;
    return typeof rows[0].data === "string" ? JSON.parse(rows[0].data) : rows[0].data;
  },

  async logAudit(orgId: string, action: string, details?: string, userId?: string | null) {
    await sql`
      INSERT INTO public.audit_logs (org_id, user_id, action, details)
      VALUES (${orgId}, ${userId || null}, ${action}, ${details || null});
    `;
  },
};
