import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { handleApiRouteRequest } from "./api/router";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function getCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin");
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key, x-api-key",
    Vary: "Origin",
  };

  if (!origin) {
    return headers;
  }

  const allowedOriginsEnv = process.env.ALLOWED_ORIGINS;
  let isAllowed = false;

  if (allowedOriginsEnv) {
    const list = allowedOriginsEnv.split(",").map((s) => s.trim().toLowerCase());
    if (list.includes("*") || list.includes(origin.toLowerCase())) {
      isAllowed = true;
    }
  } else {
    try {
      const reqUrl = new URL(request.url);
      const originUrl = new URL(origin);
      if (
        originUrl.hostname === reqUrl.hostname ||
        originUrl.hostname === "localhost" ||
        originUrl.hostname === "127.0.0.1" ||
        originUrl.hostname.endsWith(".vercel.app")
      ) {
        isAllowed = true;
      }
    } catch {
      isAllowed = false;
    }
  }

  if (isAllowed) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Credentials"] = "true";
  }

  return headers;
}

async function handleNeonAuthProxy(request: Request, url: URL): Promise<Response> {
  const targetBase =
    process.env.NEON_AUTH_BASE_URL ||
    "https://ep-hidden-fog-b4pl0nab.neonauth.c-6.us-east-2.aws.neon.tech/neondb/auth";

  // e.g. /api/auth/sign-in/social -> /sign-in/social
  const subPath = url.pathname.replace(/^\/api\/auth/, "");
  const targetUrl = `${targetBase.replace(/\/+$/, "")}${subPath}${url.search}`;

  const forwardHeaders = new Headers();
  const DISALLOWED_PROXY_HEADERS = new Set([
    "host",
    "x-forwarded-host",
    "x-forwarded-proto",
    "x-forwarded-port",
    "x-forwarded-for",
    "x-vercel-id",
    "x-vercel-cache",
    "connection",
    "keep-alive",
  ]);

  request.headers.forEach((value, key) => {
    const lowerKey = key.toLowerCase();
    if (!DISALLOWED_PROXY_HEADERS.has(lowerKey)) {
      forwardHeaders.set(key, value);
    }
  });

  const origin = request.headers.get("origin") || url.origin;
  forwardHeaders.set("origin", origin);

  const reqInit: RequestInit = {
    method: request.method,
    headers: forwardHeaders,
    redirect: "manual",
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    reqInit.body = await request.arrayBuffer();
  }

  try {
    const upstreamRes = await fetch(targetUrl, reqInit);

    const responseHeaders = new Headers();
    upstreamRes.headers.forEach((value, key) => {
      const lower = key.toLowerCase();
      if (lower === "set-cookie") {
        const clean = value.replace(/Domain=[^;]+;?/gi, "");
        responseHeaders.append("set-cookie", clean);
      } else {
        responseHeaders.set(key, value);
      }
    });

    if (typeof (upstreamRes.headers as any).getSetCookie === "function") {
      const setCookies = (upstreamRes.headers as any).getSetCookie();
      if (Array.isArray(setCookies) && setCookies.length > 0) {
        responseHeaders.delete("set-cookie");
        for (const cookie of setCookies) {
          const clean = cookie.replace(/Domain=[^;]+;?/gi, "");
          responseHeaders.append("set-cookie", clean);
        }
      }
    }

    responseHeaders.set("Access-Control-Allow-Origin", origin);
    responseHeaders.set("Access-Control-Allow-Credentials", "true");
    responseHeaders.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    responseHeaders.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key, x-api-key");

    return new Response(upstreamRes.body, {
      status: upstreamRes.status,
      statusText: upstreamRes.statusText,
      headers: responseHeaders,
    });
  } catch (err: any) {
    console.error("[NeonAuthProxy] Error forwarding request to Neon Auth:", err);
    return new Response(
      JSON.stringify({ error: "Failed to connect to Neon Auth service: " + err.message }),
      {
        status: 502,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const url = new URL(request.url);

      // 1. CORS Preflight for REST API and Auth
      if (url.pathname.startsWith("/api/") && request.method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: getCorsHeaders(request),
        });
      }

      // 2. Neon Auth Proxy (forward /api/auth/* directly to Neon Auth in both dev & Vercel prod)
      if (url.pathname.startsWith("/api/auth")) {
        return await handleNeonAuthProxy(request, url);
      }

      // 3. REST API Endpoints Routing (for external ERP integration e.g. /api/v1/*)
      if (url.pathname.startsWith("/api/v1/")) {
        const method = request.method.toUpperCase();
        const headers: Record<string, string> = {};
        request.headers.forEach((val, key) => {
          headers[key.toLowerCase()] = val;
        });

        const queryParams: Record<string, string> = {};
        url.searchParams.forEach((val, key) => {
          queryParams[key] = val;
        });

        let body: unknown = null;
        if (method !== "GET" && method !== "HEAD") {
          try {
            const text = await request.text();
            if (text) {
              body = JSON.parse(text);
            }
          } catch {
            // keep null if not json
          }
        }

        const result = await handleApiRouteRequest({
          headers,
          method,
          path: url.pathname,
          body,
          queryParams,
        });

        const corsHeaders = getCorsHeaders(request);
        return new Response(JSON.stringify(result.body), {
          status: result.status,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
            ...(result.headers || {}),
          },
        });
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
