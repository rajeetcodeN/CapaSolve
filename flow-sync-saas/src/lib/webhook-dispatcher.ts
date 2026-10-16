/**
 * CapaSolve SaaS — Outbound Webhook Dispatcher Engine
 * Emits real-time HTTP POST notifications to registered customer webhook URLs.
 */

export interface WebhookEventPayload {
  event: "schedule.updated" | "job.delayed" | "order.completed" | "capacity.overload";
  timestamp: string;
  orgId: string;
  data: Record<string, unknown>;
}

export interface WebhookEndpointConfig {
  id: string;
  url: string;
  secret?: string;
  events: string[];
  active: boolean;
}

const registeredEndpoints: WebhookEndpointConfig[] = [];

/**
 * Computes an HMAC-SHA256 signature for a webhook payload string.
 * Output format: `sha256=<hex_digest>`
 */
export async function computeWebhookSignature(secret: string, payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  const hexDigest = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `sha256=${hexDigest}`;
}

/**
 * Verifies an incoming webhook signature against the secret and payload.
 */
export async function verifyWebhookSignature(
  secret: string,
  payload: string,
  signatureHeader: string,
): Promise<boolean> {
  if (!signatureHeader || !secret) return false;
  const expected = await computeWebhookSignature(secret, payload);
  return expected === signatureHeader.trim();
}

export function registerWebhookEndpoint(config: WebhookEndpointConfig) {
  const existing = registeredEndpoints.findIndex((e) => e.id === config.id);
  if (existing >= 0) {
    registeredEndpoints[existing] = config;
  } else {
    registeredEndpoints.push(config);
  }
}

export function getRegisteredWebhooks(): WebhookEndpointConfig[] {
  return registeredEndpoints;
}

export async function dispatchWebhookEvent(
  event: WebhookEventPayload["event"],
  orgId: string,
  data: Record<string, unknown>,
): Promise<{ dispatchedCount: number; errors: string[] }> {
  const payload: WebhookEventPayload = {
    event,
    timestamp: new Date().toISOString(),
    orgId,
    data,
  };

  const rawBody = JSON.stringify(payload);

  const activeWebhooks = registeredEndpoints.filter(
    (ep) => ep.active && (ep.events.includes("*") || ep.events.includes(event)),
  );

  let dispatchedCount = 0;
  const errors: string[] = [];

  await Promise.all(
    activeWebhooks.map(async (ep) => {
      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          "User-Agent": "CapaSolve-Webhook-Dispatcher/1.0",
          "X-CapaSolve-Event": event,
        };

        if (ep.secret) {
          headers["X-CapaSolve-Signature"] = await computeWebhookSignature(ep.secret, rawBody);
        }

        const response = await fetch(ep.url, {
          method: "POST",
          headers,
          body: rawBody,
        });

        if (response.ok) {
          dispatchedCount++;
        } else {
          errors.push(`Webhook ${ep.url} returned status ${response.status}`);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`Webhook ${ep.url} failed: ${message}`);
      }
    }),
  );

  return { dispatchedCount, errors };
}

