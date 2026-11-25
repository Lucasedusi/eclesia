import "server-only";
import { z } from "zod";
import { PERMISSIONS } from "@/modules/auth/constants/permissions";
import { requireFinanceContext } from "./finance-access.service";
import { isMonth, todayLocal } from "../utils/finance-period";
export type FinanceSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;
export function financePageMonth(value: string | string[] | undefined) {
  return value === undefined
    ? todayLocal().slice(0, 7)
    : z.string().refine(isMonth).parse(value);
}
export async function resolveFinancePage(
  searchParams: FinanceSearchParams,
  settings = false,
) {
  const search = await searchParams;
  const unit =
    search.unidade === undefined ? undefined : z.uuid().parse(search.unidade);
  const context = await requireFinanceContext({
    congregationId: unit,
    permission: settings
      ? PERMISSIONS.financeSettings
      : PERMISSIONS.financeView,
  });
  const month = financePageMonth(search.mes);
  return { context, month, search };
}
