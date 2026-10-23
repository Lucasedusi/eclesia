import type { AuthContext } from "@/modules/auth/types/auth.types";
import type { FINANCE_PERMISSIONS } from "../constants/finance-permissions";
export type Cents = number;
export type LocalDate = string;
export type MonthRef = string;
export type FinanceCapabilities = Record<
  keyof typeof FINANCE_PERMISSIONS,
  boolean
>;
export type FinanceUnit = {
  id: string;
  name: string;
  isHeadquarters: boolean;
  capabilities?: FinanceCapabilities;
};
export type FinanceContext = {
  auth: AuthContext;
  churchId: string;
  congregationId: string;
  capabilities: FinanceCapabilities;
};
export type FinanceErrorCode =
  | "BANK_IMPORT_FILE"
  | "BANK_IMPORT_CONFLICT"
  | "BANK_IMPORT_STATE"
  | "BANK_IMPORT_SOURCE_MISMATCH"
  | "BANK_IMPORT_TARGET_MISMATCH"
  | "BANK_IMPORT_TARGET_USED"
  | "BANK_IMPORT_DUPLICATE_REVIEW"
  | "BANK_IMPORT_RECONCILIATION"
  | "BANK_IMPORT_INVALID_ROW"
  | "FORBIDDEN"
  | "INVALID_INPUT"
  | "INACTIVE_REFERENCE"
  | "CONFLICT"
  | "IDEMPOTENCY_CONFLICT"
  | "STATEMENT_REASON_REQUIRED"
  | "PREBEND_CAP_REQUIRED"
  | "CONFIGURATION_REQUIRED"
  | "LEGACY_DATA_REQUIRES_REVIEW"
  | "UNAVAILABLE";
export type FinanceActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      code: FinanceErrorCode;
      message: string;
      fieldErrors?: Record<string, string[]>;
    };
