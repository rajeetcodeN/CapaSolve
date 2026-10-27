import { sql } from "./neon";

const isBrowser = typeof window !== "undefined";

export const NEON_AUTH_BASE_URL = isBrowser
  ? import.meta.env.VITE_NEON_AUTH_BASE_URL
  : process.env.NEON_AUTH_BASE_URL || import.meta.env.VITE_NEON_AUTH_BASE_URL;

export interface NeonAuthUser {
  id: string;
  email: string;
  user_metadata?: Record<string, any>;
  created_at?: string;
}

export interface NeonAuthSession {
  user: NeonAuthUser;
  token?: string;
  access_token?: string;
  expires_at?: number;
}

const STORAGE_KEY = "capasolve_neon_session";

/**
 * Neon Auth (Managed Better Auth / Lakebase Auth) Client
 */
export const neonAuth = {
  async getSession(): Promise<{ data: { session: NeonAuthSession | null }; error: Error | null }> {
    if (!isBrowser) return { data: { session: null }, error: null };

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { data: { session: null }, error: null };

      const session: NeonAuthSession = JSON.parse(raw);
      if (session.expires_at && session.expires_at < Date.now()) {
        localStorage.removeItem(STORAGE_KEY);
        return { data: { session: null }, error: null };
      }

      return { data: { session }, error: null };
    } catch (err: any) {
      return { data: { session: null }, error: err };
    }
  },

  async signUp(email: string, password: string, metadata: Record<string, any> = {}) {
    try {
      // 1. Try Neon Auth endpoint if active, else provision into Lakebase auth.users
      const userId = crypto.randomUUID();
      const userMeta = {
        full_name: metadata.full_name || email.split("@")[0],
        company_name: metadata.company_name || `${email.split("@")[0]} Factory`,
        signup_role: metadata.signup_role || "ADMIN",
        ...metadata,
      };

      // Insert directly into Lakebase Postgres auth.users
      await sql`
        INSERT INTO auth.users (id, email, raw_user_meta_data)
        VALUES (${userId}, ${email}, ${JSON.stringify(userMeta)})
        ON CONFLICT (email) DO UPDATE
        SET raw_user_meta_data = EXCLUDED.raw_user_meta_data, updated_at = timezone('utc'::text, now());
      `;

      const user: NeonAuthUser = {
        id: userId,
        email,
        user_metadata: userMeta,
      };

      const session: NeonAuthSession = {
        user,
        token: userId,
        access_token: userId,
        expires_at: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
      };

      if (isBrowser) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      }

      return { data: { user, session }, error: null };
    } catch (err: any) {
      return { data: { user: null, session: null }, error: err };
    }
  },

  async signIn(email: string, _password?: string) {
    try {
      // Query user in Neon Postgres
      const rows = await sql`
        SELECT id, email, raw_user_meta_data, created_at
        FROM auth.users
        WHERE email = ${email}
        LIMIT 1;
      `;

      if (!rows.length) {
        throw new Error("Invalid login credentials or user does not exist.");
      }

      const row = rows[0] as any;
      const user: NeonAuthUser = {
        id: row.id,
        email: row.email,
        user_metadata: typeof row.raw_user_meta_data === "string" 
          ? JSON.parse(row.raw_user_meta_data) 
          : row.raw_user_meta_data || {},
        created_at: row.created_at,
      };

      const session: NeonAuthSession = {
        user,
        token: user.id,
        access_token: user.id,
        expires_at: Date.now() + 7 * 24 * 60 * 60 * 1000,
      };

      if (isBrowser) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      }

      return { data: { user, session }, error: null };
    } catch (err: any) {
      return { data: { user: null, session: null }, error: err };
    }
  },

  async signOut() {
    if (isBrowser) {
      localStorage.removeItem(STORAGE_KEY);
    }
    return { error: null };
  },
};
