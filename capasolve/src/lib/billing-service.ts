import { logger } from "./error-tracking";

export type SubscriptionTier = "STARTER" | "PRO" | "ENTERPRISE";
export type SubscriptionStatus = "ACTIVE" | "PAST_DUE" | "CANCELED" | "TRIALING";

export interface PlanConfig {
  id: SubscriptionTier;
  name: string;
  priceMonthly: number;
  maxMachines: number;
  features: {
    finiteScheduling: boolean;
    setupMatrixClustering: boolean;
    whatIfScenarios: boolean;
    kioskExecution: boolean;
    restApiAccess: boolean;
    customShifts: boolean;
  };
}

export const SUBSCRIPTION_PLANS: Record<SubscriptionTier, PlanConfig> = {
  STARTER: {
    id: "STARTER",
    name: "Starter Factory",
    priceMonthly: 149,
    maxMachines: 10,
    features: {
      finiteScheduling: true,
      setupMatrixClustering: false,
      whatIfScenarios: false,
      kioskExecution: true,
      restApiAccess: false,
      customShifts: false,
    },
  },
  PRO: {
    id: "PRO",
    name: "Precision Machine Shop",
    priceMonthly: 499,
    maxMachines: 50,
    features: {
      finiteScheduling: true,
      setupMatrixClustering: true,
      whatIfScenarios: true,
      kioskExecution: true,
      restApiAccess: true,
      customShifts: true,
    },
  },
  ENTERPRISE: {
    id: "ENTERPRISE",
    name: "Multi-Plant Enterprise",
    priceMonthly: 1299,
    maxMachines: 500,
    features: {
      finiteScheduling: true,
      setupMatrixClustering: true,
      whatIfScenarios: true,
      kioskExecution: true,
      restApiAccess: true,
      customShifts: true,
    },
  },
};

/**
 * Creates Stripe Checkout Session URL or handles mocked dev redirection
 */
export async function createCheckoutSession(
  orgId: string,
  tier: SubscriptionTier,
  customerEmail: string,
): Promise<{ url: string | null; error?: string }> {
  try {
    const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

    if (!stripePublishableKey) {
      // In sandbox / beta mode without active Stripe secret, generate simulated confirmation
      logger.info(`Simulated checkout session initiated for org ${orgId} on plan ${tier}`);
      return {
        url: `/settings?billing_status=success&tier=${tier}&orgId=${orgId}`,
      };
    }

    const res = await fetch("/api/v1/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId, tier, customerEmail }),
    });

    const data = await res.json();
    return { url: data.url };
  } catch (err) {
    logger.error("Failed to initialize billing checkout", err as Error);
    return { url: null, error: (err as Error).message };
  }
}

/**
 * Validates feature entitlements against an organization's subscription tier
 */
export function checkTierEntitlement(
  tier: SubscriptionTier = "STARTER",
  feature: keyof PlanConfig["features"],
): boolean {
  const plan = SUBSCRIPTION_PLANS[tier] || SUBSCRIPTION_PLANS.STARTER;
  return Boolean(plan.features[feature]);
}
