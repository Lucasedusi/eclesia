import { hasPermission, PERMISSIONS } from "@/modules/auth/constants/permissions";
import type { AuthContext } from "@/modules/auth/types/auth.types";

export function canViewBirthdays({ access, permissions }: AuthContext) {
  if (!hasPermission(permissions, PERMISSIONS.membersViewBasic)) return false;
  switch (access.scope) {
    case "CHURCH": return true;
    case "REGION": return Boolean(access.regionId);
    case "CONGREGATION": return Boolean(access.congregationId);
    case "MINISTRY": return Boolean(access.ministryId) && hasPermission(permissions, PERMISSIONS.ministriesView);
    default: return false;
  }
}
