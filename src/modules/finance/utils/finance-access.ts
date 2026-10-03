import type { AuthContext } from "@/modules/auth/types/auth.types";
import { FINANCE_PERMISSIONS } from "../constants/finance-permissions";
import type { FinanceCapabilities, FinanceUnit } from "../types/finance.types";
export function financeCapabilities(auth: AuthContext): FinanceCapabilities {
  const active = auth.profile.status === "ACTIVE" && auth.access.status === "ACTIVE";
  const admin = auth.access.role === "ADMIN" && auth.access.scope === "CHURCH";
  const operational = admin || Boolean(auth.access.congregationId);
  return Object.fromEntries(Object.entries(FINANCE_PERMISSIONS).map(([key,permission]) => [key,
    active && auth.permissions.includes(permission) && (key === "manageSettings" ? admin :
      ["create","update","cancel","transfer"].includes(key) ? operational : true)])) as FinanceCapabilities;
}
export function selectFinanceUnit(auth: AuthContext, units: FinanceUnit[], requested?: string): string {
  if (auth.profile.status !== "ACTIVE" || auth.access.status !== "ACTIVE") throw new Error("FORBIDDEN");
  if (requested) {
    if (!units.some(unit => unit.id === requested)) throw new Error("FORBIDDEN");
    return requested;
  }
  const assigned = units.find(unit => unit.id === auth.access.congregationId);
  const headquarters = units.find(unit => unit.isHeadquarters);
  const selected = assigned ?? headquarters ?? units[0];
  if (!selected) throw new Error("CONFIGURATION_REQUIRED");
  return selected.id;
}
