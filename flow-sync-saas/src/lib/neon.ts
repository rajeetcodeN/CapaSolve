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

  async getOrganizationMembers(orgId: string): Promise<
    Array<{
      id: string;
      user_id: string;
      role: string;
      email: string;
      full_name: string;
      created_at: string;
    }>
  > {
    try {
      const rows = await sql`
        SELECT 
          om.id, om.user_id, om.role, om.created_at,
          COALESCE(u.email, 'member@plant.com') as email,
          COALESCE(p.full_name, split_part(u.email, '@', 1), 'Team Member') as full_name
        FROM public.organization_members om
        LEFT JOIN auth.users u ON om.user_id = u.id
        LEFT JOIN public.profiles p ON om.user_id = p.id
        WHERE om.org_id = ${orgId}
        ORDER BY om.created_at ASC;
      `;
      return rows as any;
    } catch (err) {
      console.error("[Neon] Error fetching organization members:", err);
      return [];
    }
  },

  async getOrganizationInvitations(orgId: string): Promise<
    Array<{
      id: string;
      org_id: string;
      email: string;
      role: string;
      token: string;
      expires_at: string;
      created_at: string;
      accepted_at: string | null;
    }>
  > {
    try {
      const rows = await sql`
        SELECT id, org_id, email, role, token, expires_at, created_at, accepted_at
        FROM public.invitations
        WHERE org_id = ${orgId} AND accepted_at IS NULL AND expires_at > timezone('utc'::text, now())
        ORDER BY created_at DESC;
      `;
      return rows as any;
    } catch (err) {
      console.error("[Neon] Error fetching organization invitations:", err);
      return [];
    }
  },

  async createInvitation(
    orgId: string,
    email: string,
    role: string = "GUEST",
  ): Promise<{ id: string; token: string; inviteLink: string }> {
    const token = "inv_" + crypto.randomUUID().replace(/-/g, "");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const rows = await sql`
      INSERT INTO public.invitations (org_id, email, role, token, expires_at)
      VALUES (${orgId}, ${email}, ${role}, ${token}, ${expiresAt}::timestamptz)
      RETURNING id, token;
    `;
    const origin =
      typeof window !== "undefined" ? window.location.origin : "http://localhost:5173";
    return {
      id: rows[0].id,
      token: rows[0].token,
      inviteLink: `${origin}/signup?invite=${rows[0].token}`,
    };
  },

  async getInvitationByToken(token: string): Promise<{
    invitation: { id: string; org_id: string; email: string; role: string; expires_at: string };
    orgName: string;
  } | null> {
    try {
      const rows = await sql`
        SELECT 
          i.id, i.org_id, i.email, i.role, i.expires_at,
          o.name as org_name
        FROM public.invitations i
        JOIN public.organizations o ON i.org_id = o.id
        WHERE i.token = ${token} AND i.accepted_at IS NULL AND i.expires_at > timezone('utc'::text, now())
        LIMIT 1;
      `;
      if (!rows.length) return null;
      return {
        invitation: {
          id: rows[0].id,
          org_id: rows[0].org_id,
          email: rows[0].email,
          role: rows[0].role,
          expires_at: rows[0].expires_at,
        },
        orgName: rows[0].org_name,
      };
    } catch (err) {
      console.error("[Neon] Error querying invitation:", err);
      return null;
    }
  },

  async acceptInvitation(
    token: string,
    userId: string,
  ): Promise<{ success: boolean; orgId: string; role: string; orgName: string } | null> {
    try {
      const inviteData = await neonDb.getInvitationByToken(token);
      if (!inviteData) return null;

      const { org_id, role, id: inviteId } = inviteData.invitation;

      // 1. Insert into organization_members
      await sql`
        INSERT INTO public.organization_members (org_id, user_id, role)
        VALUES (${org_id}, ${userId}, ${role})
        ON CONFLICT (org_id, user_id) DO UPDATE SET role = EXCLUDED.role;
      `;

      // 2. Mark invitation accepted
      await sql`
        UPDATE public.invitations
        SET accepted_at = timezone('utc'::text, now())
        WHERE id = ${inviteId};
      `;

      return { success: true, orgId: org_id, role, orgName: inviteData.orgName };
    } catch (err) {
      console.error("[Neon] Error accepting invitation:", err);
      return null;
    }
  },

  async removeMember(orgId: string, memberId: string): Promise<boolean> {
    await sql`
      DELETE FROM public.organization_members
      WHERE org_id = ${orgId} AND (id = ${memberId} OR user_id = ${memberId});
    `;
    return true;
  },

  async revokeInvitation(invitationId: string): Promise<boolean> {
    await sql`
      DELETE FROM public.invitations
      WHERE id = ${invitationId};
    `;
    return true;
  },
};
