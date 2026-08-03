import { handleScheduleSolveApi } from "./v1/schedule";
import { handleGetOrdersApi, handlePostOrdersApi, handleDeleteOrderApi } from "./v1/orders";

export interface ApiRequestOptions {
  headers: Record<string, string>;
  method: string;
  path: string;
  body?: any;
  queryParams?: Record<string, string>;
}

// In-memory Rate Limiting Bucket: 100 requests per minute per API key / IP
const rateLimitWindowMs = 60 * 1000;
const maxRequestsPerWindow = 100;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function apiKeyAuthMiddleware(apiKey?: string): { authenticated: boolean; tenantId?: string; error?: string } {
  if (!apiKey || apiKey.trim() === "") {
    return { authenticated: false, error: "Missing X-API-Key header." };
  }
  // Standard demo & production key validation
  if (apiKey.startsWith("cs_live_") || apiKey.startsWith("cs_test_") || apiKey === "demo-api-key") {
    return { authenticated: true, tenantId: "tenant-default" };
  }
  return { authenticated: false, error: "Invalid X-API-Key provided." };
}

export function rateLimiterMiddleware(identifier: string): { allowed: boolean; remaining: number; resetInSec: number } {
  const now = Date.now();
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

export function formatApiError(code: string, message: string, details?: any) {
  return {
    success: false,
    error: {
      code,
      message,
      details: details || null,
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
      body: formatApiError("RATE_LIMIT_EXCEEDED", `Rate limit exceeded. Try again in ${rateLimit.resetInSec}s.`),
    };
  }

  // 3. Route Dispatching
  const { path, method, body, queryParams } = opts;

  if (path === "/api/v1/schedule/solve" && method.toUpperCase() === "POST") {
    const result = handleScheduleSolveApi(body);
    return {
      status: result.success ? 200 : 400,
      body: result,
    };
  }

  if (path === "/api/v1/orders" && method.toUpperCase() === "GET") {
    const result = handleGetOrdersApi(queryParams?.q);
    return { status: 200, body: result };
  }

  if (path === "/api/v1/orders" && method.toUpperCase() === "POST") {
    const result = handlePostOrdersApi(body);
    return { status: 200, body: result };
  }

  if (path.startsWith("/api/v1/orders/") && method.toUpperCase() === "DELETE") {
    const orderId = path.replace("/api/v1/orders/", "");
    const result = handleDeleteOrderApi(orderId);
    return { status: 200, body: result };
  }

  return {
    status: 404,
    body: formatApiError("NOT_FOUND", `API Route ${method} ${path} not found.`),
  };
}
