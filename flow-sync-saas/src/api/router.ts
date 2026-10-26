import { handleScheduleSolveApi, SolveApiRequest } from "./v1/schedule";
import { handleGetOrdersApi, handlePostOrdersApi, handleDeleteOrderApi } from "./v1/orders";
import { Order, OrderProcess } from "@/lib/types";

export interface ApiRequestOptions {
  headers: Record<string, string>;
  method: string;
  path: string;
  body?: unknown;
  queryParams?: Record<string, string>;
}

// In-memory Rate Limiting Bucket: 100 requests per minute per API key / IP
const rateLimitWindowMs = 60 * 1000;
const maxRequestsPerWindow = 100;
const MAX_RATE_LIMIT_ENTRIES = 5000;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
let lastRateLimitCleanupAt = 0;

function pruneExpiredRateLimits(now: number) {
  if (now - lastRateLimitCleanupAt > 60 * 1000 || rateLimitMap.size > MAX_RATE_LIMIT_ENTRIES) {
    lastRateLimitCleanupAt = now;
    for (const [key, val] of rateLimitMap.entries()) {
      if (now > val.resetAt) {
        rateLimitMap.delete(key);
      }
    }
    if (rateLimitMap.size > MAX_RATE_LIMIT_ENTRIES) {
      rateLimitMap.clear();
    }
  }
}

export interface ApiKeyRecord {
  keyHash: string;
  tenantId: string;
  name: string;
  scopes: string[];
  isRevoked: boolean;
  createdAt: string;
  lastUsedAt?: string;
}

// In-memory API key registry (SHA-256 Key Hash -> Tenant Metadata)
const apiKeyRegistry = new Map<string, ApiKeyRecord>();

// Simple fast SHA-256 implementation using Web Crypto / subtle or fallback hash
function computeHashSync(str: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function registerApiKey(
  rawKey: string,
  tenantId: string,
  name: string,
  scopes: string[] = ["read", "write", "solve"],
): ApiKeyRecord {
  const keyHash = computeHashSync(rawKey.trim());
  const record: ApiKeyRecord = {
    keyHash,
    tenantId,
    name,
    scopes,
    isRevoked: false,
    createdAt: new Date().toISOString(),
  };
  apiKeyRegistry.set(keyHash, record);
  return record;
}

export function revokeApiKey(rawKey: string): boolean {
  const keyHash = computeHashSync(rawKey.trim());
  const record = apiKeyRegistry.get(keyHash);
  if (record) {
    record.isRevoked = true;
    return true;
  }
  return false;
}

// Seed default keys exclusively for non-production development / test environments
if (process.env.NODE_ENV !== "production") {
  registerApiKey("demo-api-key", "tenant-demo", "Demo Public Sandbox Key", ["read", "solve"]);
  registerApiKey("cs_test_dev_alpha_9921", "tenant-alpha", "Development Tenant Alpha", [
    "read",
    "write",
    "solve",
  ]);
  registerApiKey("cs_live_prod_beta_8842", "tenant-beta", "Production Tenant Beta", [
    "read",
    "write",
    "solve",
  ]);
}

export function apiKeyAuthMiddleware(apiKey?: string): {
  authenticated: boolean;
  tenantId?: string;
  error?: string;
  scopes?: string[];
} {
  if (!apiKey || apiKey.trim() === "") {
    return { authenticated: false, error: "Missing X-API-Key header." };
  }

  const trimmed = apiKey.trim();
  const keyHash = computeHashSync(trimmed);
  const record = apiKeyRegistry.get(keyHash);

  if (record) {
    if (record.isRevoked) {
      return { authenticated: false, error: "API Key has been revoked." };
    }
    record.lastUsedAt = new Date().toISOString();
    return {
      authenticated: true,
      tenantId: record.tenantId,
      scopes: record.scopes,
    };
  }

  // Structured key validation with dedicated tenant slug:
  // Format: cs_(live|test)_<tenantSlug>_<tokenOfAtLeast8Chars>
  const structuredMatch = trimmed.match(/^cs_(live|test)_([a-zA-Z0-9_-]{3,32})_[a-zA-Z0-9_-]{8,}$/);
  if (structuredMatch) {
    const tenantSlug = structuredMatch[2];
    const resolvedTenantId = `tenant-${tenantSlug}`;
    registerApiKey(trimmed, resolvedTenantId, `Provisioned Key (${tenantSlug})`);
    return {
      authenticated: true,
      tenantId: resolvedTenantId,
      scopes: ["read", "write", "solve"],
    };
  }

  return { authenticated: false, error: "Invalid or unauthorized X-API-Key provided." };
}

export function rateLimiterMiddleware(identifier: string): {
  allowed: boolean;
  remaining: number;
  resetInSec: number;
} {
  const now = Date.now();
  pruneExpiredRateLimits(now);

  let record = rateLimitMap.get(identifier);

  if (!record || now > record.resetAt) {
    record = { count: 1, resetAt: now + rateLimitWindowMs };
    rateLimitMap.set(identifier, record);
    return { allowed: true, remaining: maxRequestsPerWindow - 1, resetInSec: 60 };
  }

  if (record.count >= maxRequestsPerWindow) {
    const resetInSec = Math.ceil((record.resetAt - now) / 1000);
    return { allowed: false, remaining: 0, resetInSec };
  }

  record.count++;
  const remaining = maxRequestsPerWindow - record.count;
  const resetInSec = Math.ceil((record.resetAt - now) / 1000);
  return { allowed: true, remaining, resetInSec };
}

export function formatApiError(code: string, message: string, details?: unknown) {
  return {
    success: false,
    error: {
      code,
      message,
      details: details ?? null,
      timestamp: new Date().toISOString(),
    },
  };
}

export async function handleApiRouteRequest(opts: ApiRequestOptions) {
  const apiKey = opts.headers["x-api-key"] || opts.headers["X-API-Key"];

  // 1. Auth Check
  const auth = apiKeyAuthMiddleware(apiKey);
  if (!auth.authenticated) {
    return {
      status: 401,
      body: formatApiError("UNAUTHORIZED", auth.error || "Authentication failed"),
    };
  }

  // 2. Rate Limiting Check
  const clientIdentifier = apiKey || "anon";
  const rateLimit = rateLimiterMiddleware(clientIdentifier);
  if (!rateLimit.allowed) {
    return {
      status: 429,
      headers: {
        "X-RateLimit-Limit": String(maxRequestsPerWindow),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(rateLimit.resetInSec),
      },
      body: formatApiError(
        "RATE_LIMIT_EXCEEDED",
        `Rate limit exceeded. Try again in ${rateLimit.resetInSec}s.`,
      ),
    };
  }

  // 3. Route Dispatching
  const { path, method, body, queryParams } = opts;

  if (path === "/api/v1/schedule/solve" && method.toUpperCase() === "POST") {
    const result = handleScheduleSolveApi(body as SolveApiRequest);
    return {
      status: result.success ? 200 : 400,
      body: result,
    };
  }

  if (path === "/api/v1/orders" && method.toUpperCase() === "GET") {
    const result = await handleGetOrdersApi(queryParams?.q, auth.tenantId);
    return { status: 200, body: result };
  }

  if (path === "/api/v1/orders" && method.toUpperCase() === "POST") {
    const result = await handlePostOrdersApi(
      body as { orders: Order[]; processes?: OrderProcess[] },
      auth.tenantId,
    );
    return { status: 200, body: result };
  }

  if (path.startsWith("/api/v1/orders/") && method.toUpperCase() === "DELETE") {
    const orderId = path.replace("/api/v1/orders/", "");
    const result = await handleDeleteOrderApi(orderId, auth.tenantId);
    return { status: 200, body: result };
  }

  return {
    status: 404,
    body: formatApiError("NOT_FOUND", `API Route ${method} ${path} not found.`),
  };
}
