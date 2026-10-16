import { describe, it, expect } from "vitest";
import {
  apiKeyAuthMiddleware,
  rateLimiterMiddleware,
  registerApiKey,
  revokeApiKey,
  handleApiRouteRequest,
} from "../../api/router";

describe("CapaSolve API Gateway & Multi-Tenant Auth Middleware", () => {
  it("rejects requests missing an API key header", () => {
    const auth = apiKeyAuthMiddleware(undefined);
    expect(auth.authenticated).toBe(false);
    expect(auth.error).toContain("Missing");
  });

  it("rejects unauthorized random string with cs_ prefix", () => {
    // Before, any key starting with cs_ passed. Now, it must be valid or structured!
    const auth = apiKeyAuthMiddleware("cs_live_short");
    expect(auth.authenticated).toBe(false);
    expect(auth.error).toContain("Invalid or unauthorized");
  });

  it("authenticates registered keys with exact tenant isolation", () => {
    const authAlpha = apiKeyAuthMiddleware("cs_test_dev_alpha_9921");
    expect(authAlpha.authenticated).toBe(true);
    expect(authAlpha.tenantId).toBe("tenant-alpha");

    const authBeta = apiKeyAuthMiddleware("cs_live_prod_beta_8842");
    expect(authBeta.authenticated).toBe(true);
    expect(authBeta.tenantId).toBe("tenant-beta");

    // Tenants must NOT collide or fallback to tenant-default
    expect(authAlpha.tenantId).not.toBe(authBeta.tenantId);
  });

  it("dynamically provisions structured tenant keys and enforces isolation", () => {
    const key = "cs_live_turbomfg_88776655aabbcc";
    const auth = apiKeyAuthMiddleware(key);
    expect(auth.authenticated).toBe(true);
    expect(auth.tenantId).toBe("tenant-turbomfg");
  });

  it("blocks revoked API keys immediately", () => {
    const customKey = "cs_test_temp_key_99887766";
    registerApiKey(customKey, "tenant-temp", "Temporary Key");

    const beforeRevoke = apiKeyAuthMiddleware(customKey);
    expect(beforeRevoke.authenticated).toBe(true);

    revokeApiKey(customKey);

    const afterRevoke = apiKeyAuthMiddleware(customKey);
    expect(afterRevoke.authenticated).toBe(false);
    expect(afterRevoke.error).toContain("revoked");
  });

  it("enforces rate limits per client identifier", () => {
    const clientId = "test-rate-limit-client";
    for (let i = 0; i < 100; i++) {
      const res = rateLimiterMiddleware(clientId);
      expect(res.allowed).toBe(true);
    }

    // 101st request should be blocked
    const blocked = rateLimiterMiddleware(clientId);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.resetInSec).toBeGreaterThan(0);
  });

  it("dispatches API request to /api/v1/orders GET endpoint", async () => {
    const response = await handleApiRouteRequest({
      headers: { "x-api-key": "demo-api-key" },
      method: "GET",
      path: "/api/v1/orders",
    });

    expect(response.status).toBe(200);
    expect((response.body as any).success).toBe(true);
    expect((response.body as any).data).toBeDefined();
  });

  it("returns 401 when API request lacks valid key", async () => {
    const response = await handleApiRouteRequest({
      headers: { "x-api-key": "bad-key-invalid" },
      method: "GET",
      path: "/api/v1/orders",
    });

    expect(response.status).toBe(401);
    expect((response.body as any).success).toBe(false);
  });
});
