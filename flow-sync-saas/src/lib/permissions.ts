import { useAppStore } from "@/lib/store";

export type Role = "ADMIN" | "DEVELOPER" | "GUEST";

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
}

export const PERMISSIONS_BY_ROLE: Record<Role, RolePermissions> = {
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
  },
  DEVELOPER: {
    canModifySchedules: true,
    canRunSolver: true,
    canUploadData: true,
    canClearData: true,
    canModifySetupMatrix: true,
    canManageTeam: false,
    canChangeBilling: false,
    canDispatchFloor: true,
    canLogScrap: true,
  },
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
  },
};

export function usePermissions(): RolePermissions & { role: Role } {
  const role = useAppStore((s) => s.role || "ADMIN");
  const permissions = PERMISSIONS_BY_ROLE[role] || PERMISSIONS_BY_ROLE.ADMIN;

  return {
    ...permissions,
    role,
  };
}

export function checkUserPermission(role: Role, action: keyof RolePermissions): boolean {
  const perms = PERMISSIONS_BY_ROLE[role] || PERMISSIONS_BY_ROLE.ADMIN;
  return perms[action];
}
