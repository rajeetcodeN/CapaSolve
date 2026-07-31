import { useAppStore } from "./store";
import { supabase } from "./supabase";

export async function checkAuthSession() {
  if (typeof window === "undefined") return { authenticated: true, user: null };

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      return { authenticated: true, user: session.user };
    }
  } catch (err) {
    console.error("Auth session check error:", err);
  }

  // Fallback check on Zustand store user or guest role
  const storeUser = useAppStore.getState().user;
  const storeRole = useAppStore.getState().role;

  if (storeUser || storeRole) {
    return { authenticated: true, user: storeUser || { email: "guest@capasolve.com", role: storeRole } };
  }

  return { authenticated: false, user: null };
}

export const PUBLIC_ROUTES = [
  "/",
  "/pricing",
  "/login",
  "/signup",
  "/about",
  "/contact",
  "/privacy",
  "/security",
  "/documentation",
  "/api-reference",
  "/support"
];

export function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.includes(pathname);
}
