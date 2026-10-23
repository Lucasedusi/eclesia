import "server-only";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import type { FinanceContext } from "../types/finance.types";
import type {
  CategoryReportDocument,
  CategoryReportOptions,
  ReportCategory,
} from "../types/finance-category-report.types";
import {
  categoryReportOptionsSchema,
  categoryReportProjectionSchema,
} from "../validations/finance-category-report.schemas";
import { FinanceReportError } from "../types/finance-report.types";
import { loadFinanceReportIdentity } from "./finance-report.service";

export async function listFinanceReportCategories(
  context: FinanceContext,
): Promise<ReportCategory[]> {
  if (!context.capabilities.view) throw new FinanceReportError("FORBIDDEN");
  const client = await createClient();
  const { data, error } = await client
    .from("financial_categories")
    .select("id,name,status,category_type")
    .eq("church_id", context.churchId)
    .is("deleted_at", null)
    .order("name");
  if (error) throw new FinanceReportError("UNAVAILABLE");
  return (data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    status: c.status,
    direction: c.category_type,
  }));
}
export async function getFinanceCategoryReport(
  context: FinanceContext,
  input: CategoryReportOptions,
): Promise<CategoryReportDocument> {
  if (!context.capabilities.view) throw new FinanceReportError("FORBIDDEN");
  const options = categoryReportOptionsSchema.parse(input);
  const client = await createClient();
  const { data, error } = await client.rpc("get_finance_category_report", {
    p_church_id: context.churchId,
    p_unit: context.congregationId,
    p_options: options,
  });
  if (error)
    throw new FinanceReportError(
      error.message === "FORBIDDEN" ||
      error.message === "INVALID_INPUT" ||
      error.message === "REPORT_TOO_LARGE" ||
      error.message === "REPORT_RECONCILIATION_REQUIRED"
        ? error.message
        : "UNAVAILABLE",
    );
  const parsed = categoryReportProjectionSchema.safeParse(data);
  if (!parsed.success) throw new FinanceReportError("UNAVAILABLE");
  const report = parsed.data;
  const selected = new Set(options.categoryIds);
  const sameIds = (ids: string[]) =>
    ids.length === selected.size &&
    new Set(ids).size === selected.size &&
    ids.every((id) => selected.has(id));
  if (
    report.dateFrom !== options.dateFrom ||
    report.dateTo !== options.dateTo ||
    report.direction !== options.direction ||
    report.presentation !== options.presentation ||
    report.cashboxId !== (options.cashboxId ?? null) ||
    !sameIds(report.categoryIds) ||
    !sameIds(report.categories.map((c) => c.id))
  )
    throw new FinanceReportError("UNAVAILABLE");
  const sum = (values: number[]) =>
    values.reduce((a, b) => a + BigInt(b), BigInt(0));
  const totals = new Map<string, { amount: bigint; count: number }>();
  for (const row of report.rows) {
    if (
      !selected.has(row.categoryId) ||
      row.date < options.dateFrom ||
      row.date > options.dateTo ||
      (options.cashboxId && row.cashboxId !== options.cashboxId)
    )
      throw new FinanceReportError("UNAVAILABLE");
    const total = totals.get(row.categoryId) ?? { amount: BigInt(0), count: 0 };
    total.amount += BigInt(row.amountCents);
    total.count++;
    totals.set(row.categoryId, total);
  }
  const consistent =
    sum(report.categories.map((c) => c.amountCents)) ===
      BigInt(report.totalCents) &&
    sum(report.categories.map((c) => c.count)) === BigInt(report.count) &&
    (options.presentation === "SUMMARY"
      ? report.rows.length === 0
      : report.rows.length === report.count &&
        new Set(report.rows.map((r) => r.id)).size === report.rows.length &&
        report.categories.every(
          (c) =>
            (totals.get(c.id)?.amount ?? BigInt(0)) === BigInt(c.amountCents) &&
            (totals.get(c.id)?.count ?? 0) === c.count,
        ));
  if (!consistent)
    throw new FinanceReportError("REPORT_RECONCILIATION_REQUIRED");
  return {
    ...report,
    emissionId: randomUUID(),
    ...(await loadFinanceReportIdentity(context)),
  };
}
