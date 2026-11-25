import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAccessContext } from "@/modules/auth/services/access-context.service";
import { PERMISSIONS } from "@/modules/auth/constants/permissions";
import { throwFinanceDatabaseError } from "../utils/finance-errors";
import {
  accountingCodeChange,
  accountingFilters,
} from "../validations/finance-accounting.schemas";
import type {
  AccountingCatalog,
  AccountingHistory,
  AccountingPreview,
} from "../types/finance-accounting.types";

async function accountingAccess() {
  const auth = await requireAccessContext(PERMISSIONS.financeAccounting);
  return { auth, church: auth.church.id, client: await createClient() };
}

export const getAccountingCatalog = cache(async () => {
  const { auth, church, client } = await accountingAccess();
  const { data, error } = await client.rpc("finance_accounting_catalog", {
    p_church: church,
  });
  if (error) throwFinanceDatabaseError(error);
  const catalog = data as unknown as AccountingCatalog;
  if (!catalog.units.length) redirect("/acesso-negado");
  const canConfigure =
    auth.access.role === "ADMIN" &&
    auth.access.scope === "CHURCH" &&
    auth.permissions.includes(PERMISSIONS.financeSettings);
  return {
    catalog: canConfigure ? catalog : { ...catalog, categories: [] },
    canConfigure,
  };
});

const pageNumber = z.number().int().min(1).max(2147483647);
export async function getAccountingPreview(input: unknown, page: number) {
  const filters = accountingFilters.parse(input);
  const { church, client } = await accountingAccess();
  const { data, error } = await client.rpc("preview_finance_accounting", {
    p_church: church,
    p_filters: filters,
    p_page: pageNumber.parse(page),
  });
  if (error) throwFinanceDatabaseError(error);
  const preview = data as unknown as AccountingPreview;
  return {
    ...preview,
    rows: preview.rows.map((row) => ({
      id: row.id,
      date: row.date,
      unit: row.unit,
      box: row.box,
      category: row.category,
      classification: row.classification,
      payer: row.payer,
      debit: row.debit,
      credit: row.credit,
      direction: row.direction,
      cents: row.cents,
      box_issue: row.box_issue,
      category_issue: row.category_issue,
    })),
  };
}
export async function exportAccounting(
  input: unknown,
  fingerprint: string,
  repeat: boolean,
) {
  const filters = accountingFilters.parse(input);
  if (!filters.unit || !filters.box) throw new Error("INVALID_INPUT");
  const { church, client } = await accountingAccess();
  const { data, error } = await client.rpc("generate_finance_accounting", {
    p_church: church,
    p_filters: filters,
    p_fingerprint: z
      .string()
      .regex(/^[a-f0-9]{32}$/)
      .parse(fingerprint),
    p_repeat: z.boolean().parse(repeat),
  });
  if (error) throwFinanceDatabaseError(error);
  return data as { id: string; file: string };
}
export async function updateAccountingCode(input: unknown) {
  const { kind, id, code, previous } = accountingCodeChange.parse(input);
  const { church, client, auth } = await accountingAccess();
  if (!auth.permissions.includes(PERMISSIONS.financeSettings))
    throw new Error("FORBIDDEN");
  // Postgres accepts SQL NULL here. The generated RPC types omit nullable arguments.
  const { error } = await client.rpc("set_finance_accounting_code", {
    p_church: church,
    p_kind: kind,
    p_id: id,
    p_code: code!,
    p_previous: previous!,
  });
  if (error) throwFinanceDatabaseError(error);
}
export async function getAccountingHistory(
  unit: string | null,
  box: string | null,
  page: number,
) {
  const { church, client } = await accountingAccess();
  const { data, error } = await client.rpc("finance_accounting_history", {
    p_church: church,
    p_unit: z.uuid().nullable().parse(unit)!,
    p_box: z.uuid().nullable().parse(box)!,
    p_page: pageNumber.parse(page),
  });
  if (error) throwFinanceDatabaseError(error);
  return data as unknown as AccountingHistory;
}
export async function confirmAccountingImport(id: string) {
  const { church, client } = await accountingAccess();
  const { error } = await client.rpc("confirm_finance_accounting_import", {
    p_church: church,
    p_batch: z.uuid().parse(id),
  });
  if (error) throwFinanceDatabaseError(error);
}
