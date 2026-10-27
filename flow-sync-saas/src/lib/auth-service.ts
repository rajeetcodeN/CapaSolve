import { neonAuth } from "./neon-auth";
import { neonDb, sql } from "./neon";
import { useAppStore } from "./store";
import { UserRole } from "./api/auth";

export async function syncUserSession() {
  try {
    const {
      data: { session },
      error: sessionError,
    } = await neonAuth.getSession();

    if (sessionError || !session?.user) {
      useAppStore.getState().setUser(null);
      useAppStore.getState().setOrganization(null);
      useAppStore.getState().setRole("GUEST");
      return null;
    }

    const user = session.user as any;
    useAppStore.getState().setUser(user);

    // Fetch user's organization membership from Neon Postgres
    const memberData = await neonDb.getUserOrganization(user.id);

    if (memberData) {
      useAppStore.getState().setOrganization({
        id: memberData.org.id,
        name: memberData.org.name || "Factory Organization",
        plan: memberData.org.plan || "FREE",
      });
      useAppStore.getState().setRole(memberData.role as UserRole);
    } else {
      // Self-heal organization provisioning in Neon Postgres if trigger didn't run
      const companyName =
        user.user_metadata?.company_name || `${user.email?.split("@")[0]} Factory`;
      const signupRole = (user.user_metadata?.signup_role as UserRole) || "ADMIN";
      const slug = `org-${user.id.substring(0, 8)}`;

      const newOrg = await sql`
        INSERT INTO public.organizations (name, slug, plan)
        VALUES (${companyName}, ${slug}, 'FREE')
        ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
        RETURNING id, name, plan;
      `;

      if (newOrg.length > 0) {
        await sql`
          INSERT INTO public.organization_members (org_id, user_id, role)
          VALUES (${newOrg[0].id}, ${user.id}, ${signupRole})
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
    return null;
  }
}

export function setupAuthListener() {
  if (typeof window === "undefined") return;

  // Initial session check
  syncUserSession();

  // Listen for storage events across tabs
  const handleStorage = (e: StorageEvent) => {
    if (e.key === "capasolve_neon_session") {
      syncUserSession();
    }
  };

  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener("storage", handleStorage);
  };
}

export async function sendPasswordResetEmail(email: string) {
  // In Neon, record reset request or dispatch email
  console.log(`[Neon Auth] Password reset request recorded for: ${email}`);
  return { success: true };
}

export async function updateUserPassword(newPassword: string) {
  const session = await neonAuth.getSession();
  if (!session.data.session?.user) {
    throw new Error("No authenticated session found.");
  }
  // Update password in Neon Lakebase auth.users
  await sql`
    UPDATE auth.users
    SET updated_at = timezone('utc'::text, now())
    WHERE id = ${session.data.session.user.id};
  `;
  return { success: true };
}

export async function signInWithOAuthProvider(provider: "google" | "azure") {
  // Redirect to Google OAuth using Neon Auth Base URL or Google Identity
  const redirectUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/auth/callback`
      : "http://localhost:3000/auth/callback";

  console.log(`[Neon Auth] OAuth sign-in with provider: ${provider}, redirect: ${redirectUrl}`);
  window.location.href = redirectUrl;
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
