import { supabase } from "./supabase";
import { useAppStore } from "./store";
import { UserRole } from "./api/auth";

export async function syncUserSession() {
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session?.user) {
      useAppStore.getState().setUser(null);
      useAppStore.getState().setOrganization(null);
      useAppStore.getState().setRole("GUEST");
      return null;
    }

    const user = session.user;
    useAppStore.getState().setUser(user);

    // Fetch user's organization membership and profile
    let { data: memberData } = await supabase
      .from("organization_members")
      .select("org_id, role, organizations(id, name, plan)")
      .eq("user_id", user.id)
      .maybeSingle();

    if (memberData) {
      const orgInfo = memberData.organizations as unknown as { id: string; name: string; plan: string } | null;
      useAppStore.getState().setOrganization({
        id: memberData.org_id,
        name: orgInfo?.name || "Factory Organization",
        plan: (orgInfo?.plan || "FREE") as "FREE" | "PRO" | "ENTERPRISE",
      });
      useAppStore.getState().setRole(memberData.role as UserRole);
    } else {
      // Self-heal organization provisioning if DB trigger didn't run
      const companyName = user.user_metadata?.company_name || `${user.email?.split("@")[0]} Factory`;
      const signupRole = (user.user_metadata?.signup_role as UserRole) || "ADMIN";
      const slug = `org-${user.id.substring(0, 8)}`;

      const { data: newOrg } = await supabase
        .from("organizations")
        .insert({ name: companyName, slug, plan: "FREE" })
        .select()
        .maybeSingle();

      if (newOrg) {
        await supabase.from("organization_members").insert({
          org_id: newOrg.id,
          user_id: user.id,
          role: signupRole,
        });

        useAppStore.getState().setOrganization({
          id: newOrg.id,
          name: newOrg.name,
          plan: (newOrg.plan || "FREE") as "FREE" | "PRO" | "ENTERPRISE",
        });
        useAppStore.getState().setRole(signupRole);
      }
    }

    return user;
  } catch (err) {
    console.error("Failed to sync Supabase Auth session:", err);
    return null;
  }
}

export function setupAuthListener() {
  if (typeof window === "undefined") return;

  // Initial session check
  syncUserSession();

  // Listen for auth state changes (SignIn, SignOut, TokenRefresh)
  const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
      if (session?.user) {
        useAppStore.getState().setUser(session.user);
        await syncUserSession();
      }
    } else if (event === "SIGNED_OUT") {
      useAppStore.getState().setUser(null);
      useAppStore.getState().setOrganization(null);
      useAppStore.getState().setRole("GUEST");
    }
  });

  return () => {
    subscription.unsubscribe();
  };
}

export async function sendPasswordResetEmail(email: string) {
  const redirectUrl = typeof window !== "undefined" 
    ? `${window.location.origin}/reset-password`
    : "http://localhost:3000/reset-password";

  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: redirectUrl,
  });

  if (error) {
    throw new Error(error.message);
  }
  return data;
}

export async function updateUserPassword(newPassword: string) {
  const { data, error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    throw new Error(error.message);
  }
  return data;
}

export async function signInWithOAuthProvider(provider: "google" | "azure") {
  const redirectUrl = typeof window !== "undefined"
    ? `${window.location.origin}/dashboard`
    : "http://localhost:3000/dashboard";

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: redirectUrl,
    },
  });

  if (error) {
    throw new Error(error.message);
  }
  return data;
}

export async function signOutUser() {
  await supabase.auth.signOut();
  useAppStore.getState().setUser(null);
  useAppStore.getState().setOrganization(null);
  useAppStore.getState().setRole("GUEST");
}

