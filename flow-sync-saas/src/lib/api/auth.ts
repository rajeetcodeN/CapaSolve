import { supabase } from "../supabase";

export type UserRole = "ADMIN" | "DEVELOPER" | "GUEST";

export interface AuthContext {
  userId: string;
  orgId: string;
  role: UserRole;
  email: string;
  plan: string;
}

async function hashApiKey(key: string): Promise<string> {
  const enc = new TextEncoder();
  const hashBuf = await crypto.subtle.digest("SHA-256", enc.encode(key));
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Validates request authentication (Supabase JWT token or Enterprise API Key)
 * and retrieves user role and organization context.
 */
export async function authenticateRequest(
  request: Request,
  requiredRoles: UserRole[] = ["ADMIN", "DEVELOPER", "GUEST"],
): Promise<{ error?: string; status?: number; ctx?: AuthContext }> {
  try {
    const authHeader = request.headers.get("Authorization") || request.headers.get("authorization");
    if (!authHeader) {
      return { error: "Missing Authorization header", status: 401 };
    }

    const token = authHeader.startsWith("Bearer ") ? authHeader.substring(7) : authHeader;

    // Check if it's an Enterprise API Key (cap_live_...)
    if (token.startsWith("cap_live_")) {
      const hashedKey = await hashApiKey(token);

      // Query database by SHA-256 key_hash
      let { data: apiKeyData, error: keyError } = await supabase
        .from("api_keys")
        .select("org_id, key_hash, organizations(plan)")
        .eq("key_hash", hashedKey)
        .maybeSingle();

      // Fallback for legacy dev records where the raw token was stored in key_hash
      if (!apiKeyData && !keyError) {
        const legacy = await supabase
          .from("api_keys")
          .select("org_id, key_hash, organizations(plan)")
          .eq("key_hash", token)
          .maybeSingle();
        if (legacy.data) {
          apiKeyData = legacy.data;
          keyError = null;
        }
      }

      if (keyError || !apiKeyData) {
        return { error: "Invalid API Key", status: 401 };
      }

      // Update last_used_at timestamp asynchronously
      supabase
        .from("api_keys")
        .update({ last_used_at: new Date().toISOString() })
        .eq("key_hash", apiKeyData.key_hash)
        .then();

      const orgData = apiKeyData.organizations as unknown as { plan: string } | null;

      return {
        ctx: {
          userId: "system-api-key",
          orgId: apiKeyData.org_id,
          role: "ADMIN",
          email: "api-service@capasolve.internal",
          plan: orgData?.plan || "ENTERPRISE",
        },
      };
    }

    // Otherwise, validate Supabase JWT session token
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return { error: "Authentication failed: Invalid or expired token", status: 401 };
    }

    // Fetch user's organization membership & role
    const { data: membership, error: memError } = await supabase
      .from("organization_members")
      .select("org_id, role, organizations(plan)")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (memError || !membership) {
      return { error: "Access denied: User is not assigned to any organization", status: 403 };
    }

    const role = membership.role as UserRole;
    if (!requiredRoles.includes(role)) {
      return {
        error: `Access denied: Role '${role}' has insufficient permissions for this resource`,
        status: 403,
      };
    }

    const orgObj = membership.organizations as unknown as { plan: string } | null;

    return {
      ctx: {
        userId: user.id,
        orgId: membership.org_id,
        role,
        email: user.email || "",
        plan: orgObj?.plan || "FREE",
      },
    };
  } catch (err: unknown) {
    console.error("Auth Middleware Error:", err);
    return { error: "Internal server authentication error", status: 500 };
  }
}

