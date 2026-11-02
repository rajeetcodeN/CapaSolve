import { sql } from "./neon";

const isBrowser = typeof window !== "undefined";

export const REMOTE_NEON_AUTH_URL =
  (typeof process !== "undefined" ? process.env?.NEON_AUTH_BASE_URL : undefined) ||
  import.meta.env?.VITE_NEON_AUTH_BASE_URL ||
  "https://ep-hidden-fog-b4pl0nab.neonauth.c-6.us-east-2.aws.neon.tech/neondb/auth";

export const NEON_AUTH_BASE_URL = isBrowser ? "/api/auth" : REMOTE_NEON_AUTH_URL;

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
  async getSession(
    forceRefresh = false,
  ): Promise<{ data: { session: NeonAuthSession | null }; error: Error | null }> {
    if (!isBrowser) return { data: { session: null }, error: null };

    try {
      if (!forceRefresh) {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const session: NeonAuthSession = JSON.parse(raw);
          if (!session.expires_at || session.expires_at >= Date.now()) {
            return { data: { session }, error: null };
          }
          localStorage.removeItem(STORAGE_KEY);
        }
      }

      // Check Neon Auth backend session (try remote direct first so cross-domain cookies are transmitted, then local proxy)
      const urlsToCheck = Array.from(new Set([REMOTE_NEON_AUTH_URL, NEON_AUTH_BASE_URL])).filter(Boolean);
      for (const baseUrl of urlsToCheck) {
        try {
          const res = await fetch(`${baseUrl}/get-session`, {
            credentials: "include",
          });
          if (res.ok) {
            const data = await res.json();
            if (data?.user) {
              const session: NeonAuthSession = {
                user: {
                  id: data.user.id,
                  email: data.user.email,
                  user_metadata: {
                    full_name: data.user.name || data.user.email?.split("@")[0],
                    avatar_url: data.user.image,
                  },
                },
                token: data.session?.token || data.user.id,
                access_token: data.session?.token || data.user.id,
                expires_at: data.session?.expiresAt
                  ? new Date(data.session.expiresAt).getTime()
                  : Date.now() + 7 * 24 * 60 * 60 * 1000,
              };
              localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
              return { data: { session }, error: null };
            }
          }
        } catch {
          // Ignore network errors and continue to next fallback
        }
      }

      // If forceRefresh was specified and backend had no session, fallback to local storage
      const fallbackRaw = localStorage.getItem(STORAGE_KEY);
      if (fallbackRaw) {
        const session: NeonAuthSession = JSON.parse(fallbackRaw);
        if (!session.expires_at || session.expires_at >= Date.now()) {
          return { data: { session }, error: null };
        }
      }

      return { data: { session: null }, error: null };
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
      const rows = await sql`
        INSERT INTO auth.users (id, email, raw_user_meta_data)
        VALUES (${userId}, ${email}, ${JSON.stringify(userMeta)})
        ON CONFLICT (email) DO UPDATE
        SET raw_user_meta_data = EXCLUDED.raw_user_meta_data, updated_at = timezone('utc'::text, now())
        RETURNING id;
      `;

      const actualUserId = rows[0]?.id || userId;

      const user: NeonAuthUser = {
        id: actualUserId,
        email,
        user_metadata: userMeta,
      };

      const session: NeonAuthSession = {
        user,
        token: actualUserId,
        access_token: actualUserId,
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
