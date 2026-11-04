import { useAppStore } from "@/lib/store";

export type Role = "DEVELOPER" | "ADMIN" | "GUEST";

export interface RolePermissions {
  canModifySchedules: boolean;
  canRunSolver: boolean;
  canUploadData: boolean;
  canClearData: boolean;
  canModifySetupMatrix: boolean;
  canManageTeam: boolean;
  canChangeBilling: boolean;
  canDispatchFloor: boolean;
  canLogScrap: boolean;
  canAccessDevTools: boolean;
  canBypassPlanLimits: boolean;
}

export const PERMISSIONS_BY_ROLE: Record<Role, RolePermissions> = {
  // 1. TOP OF PYRAMID: Development Team (Superuser with full admin authority + dev diagnostics, hidden from regular users)
  DEVELOPER: {
    canModifySchedules: true,
    canRunSolver: true,
    canUploadData: true,
    canClearData: true,
    canModifySetupMatrix: true,
    canManageTeam: true,
    canChangeBilling: true,
    canDispatchFloor: true,
    canLogScrap: true,
    canAccessDevTools: true,
    canBypassPlanLimits: true,
  },
  // 2. MIDDLE OF PYRAMID: Organization Administrator (Full plant/factory management)
  ADMIN: {
    canModifySchedules: true,
    canRunSolver: true,
    canUploadData: true,
    canClearData: true,
    canModifySetupMatrix: true,
    canManageTeam: true,
    canChangeBilling: true,
    canDispatchFloor: true,
    canLogScrap: true,
    canAccessDevTools: false,
    canBypassPlanLimits: false,
  },
  // 3. BASE OF PYRAMID: Shop Floor Operator / Viewer (Read-only + execution dispatch)
  GUEST: {
    canModifySchedules: false,
    canRunSolver: false,
    canUploadData: false,
    canClearData: false,
    canModifySetupMatrix: false,
    canManageTeam: false,
    canChangeBilling: false,
    canDispatchFloor: true, // Floor operator can report start/hold
    canLogScrap: true, // Floor operator can log scrap
    canAccessDevTools: false,
    canBypassPlanLimits: false,
  },
};

export function isDevRole(role?: Role | string | null): boolean {
  return role === "DEVELOPER";
}

export function isAdminOrDev(role?: Role | string | null): boolean {
  return role === "DEVELOPER" || role === "ADMIN";
}

export function usePermissions(): RolePermissions & { role: Role; isDev: boolean; isAdmin: boolean } {
  const role = useAppStore((s) => s.role || "ADMIN");
  const permissions = PERMISSIONS_BY_ROLE[role] || PERMISSIONS_BY_ROLE.ADMIN;

  return {
    ...permissions,
    role,
    isDev: role === "DEVELOPER",
    isAdmin: role === "ADMIN" || role === "DEVELOPER",
  };
}

export function checkUserPermission(role: Role, action: keyof RolePermissions): boolean {
  // Top of the pyramid: Developer inherits all permissions without restriction
  if (role === "DEVELOPER") return true;
  const perms = PERMISSIONS_BY_ROLE[role] || PERMISSIONS_BY_ROLE.GUEST;
  return Boolean(perms[action]);
}
