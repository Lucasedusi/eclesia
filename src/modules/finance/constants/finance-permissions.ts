import { PERMISSIONS } from "@/modules/auth/constants/permissions";
export const FINANCE_PERMISSIONS = {
  view: PERMISSIONS.financeView,
  create: PERMISSIONS.financeCreate,
  update: PERMISSIONS.financeUpdate,
  cancel: PERMISSIONS.financeCancel,
  transfer: PERMISSIONS.financeTransfers,
  generateStatement: PERMISSIONS.financeStatements,
  manageSettings: PERMISSIONS.financeSettings,
  lookupContributors: PERMISSIONS.financeContributors,
} as const;
