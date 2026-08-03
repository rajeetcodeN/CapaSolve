/**
 * CapaSolve SaaS — Outbound Webhook Dispatcher Engine
 * Emits real-time HTTP POST notifications to registered customer webhook URLs.
 */

export interface WebhookEventPayload {
  event: "schedule.updated" | "job.delayed" | "order.completed" | "capacity.overload";
  timestamp: string;
  orgId: string;
  data: Record<string, any>;
}

export interface WebhookEndpointConfig {
  id: string;
  url: string;
  secret?: string;
  events: string[];
  active: boolean;
}

const registeredEndpoints: WebhookEndpointConfig[] = [];

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
  data: Record<string, any>
): Promise<{ dispatchedCount: number; errors: string[] }> {
  const payload: WebhookEventPayload = {
    event,
    timestamp: new Date().toISOString(),
    orgId,
    data,
  };

  const activeWebhooks = registeredEndpoints.filter(
    (ep) => ep.active && (ep.events.includes("*") || ep.events.includes(event))
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
          headers["X-CapaSolve-Signature"] = ep.secret;
        }

        const response = await fetch(ep.url, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          dispatchedCount++;
        } else {
          errors.push(`Webhook ${ep.url} returned status ${response.status}`);
        }
      } catch (err: any) {
        errors.push(`Webhook ${ep.url} failed: ${err.message}`);
      }
    })
  );

  return { dispatchedCount, errors };
}
