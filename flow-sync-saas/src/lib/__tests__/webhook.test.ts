import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  computeWebhookSignature,
  verifyWebhookSignature,
  registerWebhookEndpoint,
  dispatchWebhookEvent,
} from "../webhook-dispatcher";

describe("CapaSolve Webhook Dispatcher & HMAC Security", () => {
  const secret = "whsec_test_secret_key_883311";
  const payload = JSON.stringify({
    event: "schedule.updated",
    timestamp: "2026-10-16T12:00:00.000Z",
    orgId: "org-test-123",
    data: { orderId: "ORD-999" },
  });

  it("generates a valid sha256= HMAC hex signature", async () => {
    const signature = await computeWebhookSignature(secret, payload);
    expect(signature).toMatch(/^sha256=[a-f0-9]{64}$/);
  });

  it("verifies matching webhook signature successfully", async () => {
    const signature = await computeWebhookSignature(secret, payload);
    const isValid = await verifyWebhookSignature(secret, payload, signature);
    expect(isValid).toBe(true);
  });

  it("rejects tampered payload or incorrect secret", async () => {
    const signature = await computeWebhookSignature(secret, payload);
    const tamperedPayload = payload.replace("ORD-999", "ORD-HACK");

    const isTamperedValid = await verifyWebhookSignature(secret, tamperedPayload, signature);
    expect(isTamperedValid).toBe(false);

    const isWrongSecretValid = await verifyWebhookSignature("wrong_secret", payload, signature);
    expect(isWrongSecretValid).toBe(false);
  });

  it("dispatches webhook with X-CapaSolve-Signature header using HMAC", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });
    vi.stubGlobal("fetch", mockFetch);

    registerWebhookEndpoint({
      id: "ep-test-hmac",
      url: "https://example.com/webhook",
      secret: "whsec_super_secret_123",
      events: ["*"],
      active: true,
    });

    const result = await dispatchWebhookEvent("order.completed", "org-test", {
      orderId: "ORD-1",
    });

    expect(result.dispatchedCount).toBeGreaterThanOrEqual(1);
    expect(mockFetch).toHaveBeenCalled();

    const callArgs = mockFetch.mock.calls[0];
    const headers = callArgs[1].headers;
    expect(headers["X-CapaSolve-Signature"]).toMatch(/^sha256=[a-f0-9]{64}$/);
    expect(headers["X-CapaSolve-Signature"]).not.toEqual("whsec_super_secret_123");

    vi.unstubAllGlobals();
  });
});
