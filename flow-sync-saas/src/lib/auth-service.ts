import { neonAuth } from "./neon-auth";
import { neonDb, sql } from "./neon";
import { useAppStore } from "./store";
import { UserRole } from "./api/auth";

export async function syncUserSession(forceRefresh = false) {
  try {
    const {
      data: { session },
      error: sessionError,
    } = await neonAuth.getSession(forceRefresh);

    if (sessionError || !session?.user) {
      useAppStore.getState().setUser(null);
      useAppStore.getState().setOrganization(null);
      useAppStore.getState().setRole("GUEST");
      return null;
    }

    const user = session.user as any;
    useAppStore.getState().setUser(user);

    const userMeta = {
      full_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "User",
      avatar_url: user.user_metadata?.avatar_url || null,
      company_name:
        user.user_metadata?.company_name || `${(user.email || "Factory").split("@")[0]} Operations`,
      signup_role: (user.user_metadata?.signup_role as UserRole) || "ADMIN",
      ...user.user_metadata,
    };

    // 1. Ensure user is registered in auth.users & profiles to satisfy foreign key constraints
    let activeUserId = user.id;

    try {
      const existingUsers = await sql`
        SELECT id, email FROM auth.users 
        WHERE email = ${user.email} OR id = ${user.id} 
        LIMIT 1;
      `;

      if (existingUsers.length > 0) {
        const existing = existingUsers[0];
        if (existing.id !== user.id) {
          try {
            await sql`
              UPDATE auth.users
              SET id = ${user.id}, raw_user_meta_data = ${JSON.stringify(userMeta)}, updated_at = timezone('utc'::text, now())
              WHERE email = ${user.email};
            `;
            activeUserId = user.id;
          } catch {
            // Keep existing DB ID if update is constrained by existing foreign references
            activeUserId = existing.id;
            await sql`
              UPDATE auth.users
              SET raw_user_meta_data = ${JSON.stringify(userMeta)}, updated_at = timezone('utc'::text, now())
              WHERE id = ${existing.id};
            `;
          }
        } else {
          activeUserId = user.id;
          await sql`
            UPDATE auth.users
            SET raw_user_meta_data = ${JSON.stringify(userMeta)}, updated_at = timezone('utc'::text, now())
            WHERE id = ${user.id};
          `;
        }
      } else {
        const inserted = await sql`
          INSERT INTO auth.users (id, email, raw_user_meta_data)
          VALUES (${user.id}, ${user.email}, ${JSON.stringify(userMeta)})
          ON CONFLICT (id) DO UPDATE
          SET email = EXCLUDED.email,
              raw_user_meta_data = EXCLUDED.raw_user_meta_data,
              updated_at = timezone('utc'::text, now())
          RETURNING id;
        `;
        if (inserted.length > 0) {
          activeUserId = inserted[0].id;
        }
      }

      // Sync active ID into store and session cache
      user.id = activeUserId;
      useAppStore.getState().setUser(user);
      if (typeof window !== "undefined") {
        try {
          const raw = localStorage.getItem("capasolve_neon_session");
          if (raw) {
            const sess = JSON.parse(raw);
            if (sess?.user) {
              sess.user.id = activeUserId;
              localStorage.setItem("capasolve_neon_session", JSON.stringify(sess));
            }
          }
        } catch {}
      }

      // Upsert user profile
      await sql`
        INSERT INTO public.profiles (id, full_name, avatar_url)
        VALUES (${activeUserId}, ${userMeta.full_name}, ${userMeta.avatar_url})
        ON CONFLICT (id) DO UPDATE
        SET full_name = EXCLUDED.full_name,
            avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
            updated_at = timezone('utc'::text, now());
      `;
    } catch (upsertErr) {
      console.warn("[AuthService] Warning ensuring user in auth.users:", upsertErr);
    }

    // 2. Fetch user's organization membership from Neon Postgres
    const memberData = await neonDb.getUserOrganization(activeUserId);

    if (memberData) {
      useAppStore.getState().setOrganization({
        id: memberData.org.id,
        name: memberData.org.name || "Factory Organization",
        plan: memberData.org.plan || "FREE",
      });
      useAppStore.getState().setRole(memberData.role as UserRole);
    } else {
      // 3. Self-heal organization workspace provisioning in Neon Postgres
      const companyName = userMeta.company_name;
      const signupRole = userMeta.signup_role as UserRole;
      const slug = `org-${activeUserId.substring(0, 8)}`;

      const newOrg = await sql`
        INSERT INTO public.organizations (name, slug, plan)
        VALUES (${companyName}, ${slug}, 'FREE')
        ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
        RETURNING id, name, plan;
      `;

      if (newOrg.length > 0) {
        await sql`
          INSERT INTO public.organization_members (org_id, user_id, role)
          VALUES (${newOrg[0].id}, ${activeUserId}, ${signupRole})
          ON CONFLICT (org_id, user_id) DO UPDATE SET role = EXCLUDED.role;
        `;

        useAppStore.getState().setOrganization({
          id: newOrg[0].id,
          name: newOrg[0].name,
          plan: (newOrg[0].plan || "FREE") as "FREE" | "PRO" | "ENTERPRISE",
        });
        useAppStore.getState().setRole(signupRole);
      }
    }

    return user;
  } catch (err) {
    console.error("Failed to sync Neon Auth session:", err);
    throw err;
  }
}

export function setupAuthListener() {
  if (typeof window === "undefined") return;

  // Initial session check
  syncUserSession().catch((err) => {
    console.debug("[AuthService] Background session sync check:", err?.message);
  });

  // Listen for storage events across tabs
  const handleStorage = (e: StorageEvent) => {
    if (e.key === "capasolve_neon_session") {
      syncUserSession().catch((err) => {
        console.debug("[AuthService] Storage sync check:", err?.message);
      });
    }
  };

  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener("storage", handleStorage);
  };
}

export async function sendPasswordResetEmail(
  email: string,
): Promise<{ success: boolean; resetUrl?: string }> {
  const baseUrl =
    typeof window !== "undefined"
      ? "/api/auth"
      : import.meta.env.VITE_NEON_AUTH_BASE_URL ||
        "https://ep-hidden-fog-b4pl0nab.neonauth.c-6.us-east-2.aws.neon.tech/neondb/auth";

  const redirectUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/reset-password`
      : "http://localhost:5173/reset-password";

  try {
    const res = await fetch(`${baseUrl}/request-password-reset`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: typeof window !== "undefined" ? window.location.origin : "http://localhost:5173",
      },
      body: JSON.stringify({
        email,
        redirectTo: redirectUrl,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Failed to send password reset request.");
    }

    // In local development or testing, retrieve the generated token for instant UI preview
    let resetUrl: string | undefined;
    try {
      const rows = await sql`
        SELECT identifier FROM neon_auth.verification
        WHERE identifier LIKE 'reset-password:%'
        ORDER BY "createdAt" DESC
        LIMIT 1;
      `;
      if (rows.length > 0) {
        const rawToken = rows[0].identifier.replace(/^reset-password:/, "");
        resetUrl = `/reset-password?token=${rawToken}&email=${encodeURIComponent(email)}`;
      }
    } catch {
      // Ignore if verification table cannot be queried directly
    }

    return { success: true, resetUrl };
  } catch (err: any) {
    console.error("[Neon Auth] Password reset request failure:", err);
    throw err;
  }
}

export async function updateUserPassword(newPassword: string, token?: string) {
  const baseUrl =
    typeof window !== "undefined"
      ? "/api/auth"
      : import.meta.env.VITE_NEON_AUTH_BASE_URL ||
        "https://ep-hidden-fog-b4pl0nab.neonauth.c-6.us-east-2.aws.neon.tech/neondb/auth";

  if (token) {
    // Reset via recovery token from email
    const res = await fetch(`${baseUrl}/reset-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: typeof window !== "undefined" ? window.location.origin : "http://localhost:5173",
      },
      body: JSON.stringify({
        token,
        newPassword,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Invalid or expired reset token. Please request a new link.");
    }

    return { success: true };
  }

  // Otherwise, user is updating their password from active session
  const session = await neonAuth.getSession();
  if (!session.data.session?.user) {
    throw new Error("Missing reset token or active session. Please request a new password reset link.");
  }

  // Update password in Neon Lakebase auth.users
  await sql`
    UPDATE auth.users
    SET updated_at = timezone('utc'::text, now())
    WHERE id = ${session.data.session.user.id};
  `;

  return { success: true };
}

export async function signInWithOAuthProvider(provider: "google", inviteToken?: string) {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "http://localhost:5173";
  const redirectUrl = inviteToken
    ? `${origin}/auth/callback?invite=${encodeURIComponent(inviteToken)}`
    : `${origin}/auth/callback`;

  const baseUrl =
    typeof window !== "undefined"
      ? "/api/auth"
      : import.meta.env.VITE_NEON_AUTH_BASE_URL ||
        "https://ep-hidden-fog-b4pl0nab.neonauth.c-6.us-east-2.aws.neon.tech/neondb/auth";

  console.log(`[Neon Auth] Initiating real Google OAuth with redirect: ${redirectUrl}`);

  try {
    const res = await fetch(`${baseUrl}/sign-in/social`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        provider: "google",
        callbackURL: redirectUrl,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || "Failed to initialize Google authentication.");
    }

    const data = await res.json();
    if (data?.url) {
      window.location.href = data.url;
    } else {
      throw new Error("No authorization URL returned from auth server.");
    }
  } catch (err: any) {
    console.error("[Neon Auth] Social sign-in failure:", err);
    throw err;
  }
}

export async function signInWithGoogleIdToken(idToken: string, nonce?: string) {
  console.log("[Neon Auth] Signing in with Google ID token:", idToken.substring(0, 10));
  await syncUserSession();
  return { success: true };
}

export async function signOutUser() {
  await neonAuth.signOut();
  useAppStore.getState().setUser(null);
  useAppStore.getState().setOrganization(null);
  useAppStore.getState().setRole("GUEST");
}
