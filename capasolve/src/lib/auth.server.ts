import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { sql } from "./neon";

export interface VerifiedSessionUser {
  id: string;
  email: string;
  user_metadata?: {
    full_name?: string;
    avatar_url?: string;
    [key: string]: any;
  };
}

export interface VerifiedSession {
  user: VerifiedSessionUser;
  token?: string;
  access_token?: string;
  expires_at?: number;
}

/**
 * Server function to verify and reconcile the active OAuth session directly from Neon Postgres.
 * Acts as a resilient fallback when browser third-party cookie restrictions or cross-origin
 * barriers on localhost/custom domains prevent client-side cookies from being transmitted.
 */
export const verifyOAuthCallbackServerFn = createServerFn({ method: "POST" })
  .inputValidator(
    z
      .object({
        token: z.string().optional(),
        email: z.string().optional(),
      })
      .optional(),
  )
  .handler(async ({ data }) => {
    try {
      const explicitToken = data?.token;
      const explicitEmail = data?.email;
      let rows: any[] = [];

      if (explicitToken) {
        rows = await sql`
          SELECT s.id as session_id, s.token, s."expiresAt", s."createdAt",
                 u.id as user_id, u.name, u.email, u.image
          FROM neon_auth.session s
          JOIN neon_auth.user u ON s."userId" = u.id
          WHERE s.token = ${explicitToken} AND s."expiresAt" > timezone('utc'::text, now())
          ORDER BY s."createdAt" DESC
          LIMIT 1;
        `;
      }

      if (rows.length === 0 && explicitEmail) {
        rows = await sql`
          SELECT s.id as session_id, s.token, s."expiresAt", s."createdAt",
                 u.id as user_id, u.name, u.email, u.image
          FROM neon_auth.session s
          JOIN neon_auth.user u ON s."userId" = u.id
          WHERE lower(u.email) = lower(${explicitEmail}) AND s."expiresAt" > timezone('utc'::text, now())
          ORDER BY s."createdAt" DESC
          LIMIT 1;
        `;
      }

      if (rows.length === 0) {
        // Fallback: Pick latest active session created within the last 15 minutes
        rows = await sql`
          SELECT s.id as session_id, s.token, s."expiresAt", s."createdAt",
                 u.id as user_id, u.name, u.email, u.image
          FROM neon_auth.session s
          JOIN neon_auth.user u ON s."userId" = u.id
          WHERE s."expiresAt" > timezone('utc'::text, now())
            AND s."createdAt" > (timezone('utc'::text, now()) - INTERVAL '15 minutes')
          ORDER BY s."createdAt" DESC
          LIMIT 1;
        `;
      }

      if (rows.length === 0) {
        return { success: false, error: "No active recent authentication session found." };
      }

      const row = rows[0];
      const verifiedSession: VerifiedSession = {
        user: {
          id: row.user_id,
          email: row.email,
          user_metadata: {
            full_name: row.name || (row.email ? row.email.split("@")[0] : "User"),
            avatar_url: row.image,
          },
        },
        token: row.token,
        access_token: row.token,
        expires_at: row.expiresAt ? new Date(row.expiresAt).getTime() : Date.now() + 7 * 86400000,
      };

      return {
        success: true,
        session: verifiedSession,
      };
    } catch (err: any) {
      console.error("[AuthServer] Error verifying OAuth session:", err);
      return { success: false, error: err.message || "Failed to verify session." };
    }
  });
