import type { FinanceContext } from "../types/finance.types";

export function hasFinanceAdminAccess(context: FinanceContext) {
  return (
    context.capabilities.view &&
    context.auth.profile.status === "ACTIVE" &&
    context.auth.access.status === "ACTIVE" &&
    context.auth.access.role === "ADMIN" &&
    context.auth.access.scope === "CHURCH"
  );
}

export { hasFinanceAdminAccess as canViewInformativeReport };
