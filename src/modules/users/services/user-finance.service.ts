import "server-only";
import { PERMISSIONS } from "@/modules/auth/constants/permissions";
import type { AuthContext } from "@/modules/auth/types/auth.types";
import { listFinanceUnits } from "@/modules/finance/services/finance-access.service";
import { listFinanceOperators } from "@/modules/finance/services/finance-operator.service";
import type { UserFinanceOperations } from "../types/user-finance.types";

/** Called with the authenticated users workspace context; RPCs repeat authorization. */
export async function getUserFinanceOperations(auth: AuthContext): Promise<UserFinanceOperations | null> {
  if (!auth.permissions.includes(PERMISSIONS.financeSettings)) return null;
  const units = await listFinanceUnits(auth);
  const authorizationUnit = units.find(unit => unit.capabilities?.manageSettings);
  if (!authorizationUnit) return null;
  const operators = await listFinanceOperators({
    auth,
    churchId: auth.church.id,
    congregationId: authorizationUnit.id,
    capabilities: authorizationUnit.capabilities!,
  });
  return {
    authorizationUnitId: authorizationUnit.id,
    assignments: operators.map(operator => ({
      accessId: operator.id,
      unitId: operator.unitId,
      units: units.filter(unit => operator.allowedUnitIds.includes(unit.id)).map(({ id, name }) => ({ id, name })),
    })),
  };
}
