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
  | "FORBIDDEN"
  | "INVALID_INPUT"
  | "INACTIVE_REFERENCE"
  | "CONFLICT"
  | "IDEMPOTENCY_CONFLICT"
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
