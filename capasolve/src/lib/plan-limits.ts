export interface PlanLimits {
  maxOrders: number;
  maxMachines: number;
  maxHorizonDays: number;
  solverTimeoutMs: number;
  allowCustomShifts: boolean;
  allowApiKeyAccess: boolean;
  allowExportExcel: boolean;
}

export const PLAN_TIERS: Record<string, PlanLimits> = {
  FREE: {
    maxOrders: 50,
    maxMachines: 4,
    maxHorizonDays: 30,
    solverTimeoutMs: 5000,
    allowCustomShifts: false,
    allowApiKeyAccess: false,
    allowExportExcel: false,
  },
  PRO: {
    maxOrders: 500,
    maxMachines: 20,
    maxHorizonDays: 365,
    solverTimeoutMs: 30000,
    allowCustomShifts: true,
    allowApiKeyAccess: false,
    allowExportExcel: true,
  },
  ENTERPRISE: {
    maxOrders: 10000,
    maxMachines: 500,
    maxHorizonDays: 1095, // 3 years
    solverTimeoutMs: 120000,
    allowCustomShifts: true,
    allowApiKeyAccess: true,
    allowExportExcel: true,
  },
};

export function getPlanLimits(planName?: string): PlanLimits {
  const normalized = (planName || "FREE").toUpperCase();
  return PLAN_TIERS[normalized] || PLAN_TIERS.FREE;
}

export function validateOptimizationPayload(
  orderCount: number,
  machineCount: number,
  planName: string,
): { allowed: boolean; reason?: string } {
  const limits = getPlanLimits(planName);

  if (orderCount > limits.maxOrders) {
    return {
      allowed: false,
      reason: `Plan '${planName}' limit exceeded: Maximum allowed orders is ${limits.maxOrders}, but payload contained ${orderCount}. Please upgrade to Pro or Enterprise.`,
    };
  }

  if (machineCount > limits.maxMachines) {
    return {
      allowed: false,
      reason: `Plan '${planName}' limit exceeded: Maximum allowed active machines is ${limits.maxMachines}, but payload contained ${machineCount}. Please upgrade to Pro or Enterprise.`,
    };
  }

  return { allowed: true };
}
