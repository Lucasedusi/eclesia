import "server-only";
import { z } from "zod";
import { deliveryRuleSchema } from "../validations/finance-administrative.schemas";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import type { FinanceContext } from "../types/finance.types";
import type {
  DeliveryDocument,
  DeliveryOptions,
  RankingDocument,
  RankingOptions,
} from "../types/finance-administrative.types";
import { FinanceReportError } from "../types/finance-report.types";
import { canViewInformativeReport } from "../utils/finance-report-access";
import { throwFinanceDatabaseError } from "../utils/finance-errors";
import { summarizeInformativeProjection } from "../utils/finance-informative-summary";
import { sumCents, summarizeRanking } from "../utils/finance-administrative";
import {
  deliveryOptionsSchema,
  deliveryProjectionSchema,
  deliveryQuerySchema,
  rankingOptionsSchema,
  rankingProjectionSchema,
  recordDeliverySchema,
  deliveryDeadlineSchema,
} from "../validations/finance-administrative.schemas";
import { loadFinanceReportIdentity } from "./finance-report.service";

export function assertAdministrativeReports(context: FinanceContext) {
  if (!canViewInformativeReport(context))
    throw new FinanceReportError("FORBIDDEN");
}
async function identity(context: FinanceContext) {
  const data = await loadFinanceReportIdentity(context);
  return {
    ...data,
    congregationName: "Todas as congregações",
    congregationAddress: null,
    emissionId: randomUUID(),
  };
}
export async function getFinanceRankingReport(
  context: FinanceContext,
  input: RankingOptions,
): Promise<RankingDocument> {
  assertAdministrativeReports(context);
  const options = rankingOptionsSchema.parse(input),
    client = await createClient();
  const { data, error } = await client.rpc("get_finance_ranking_report", {
    p_church_id: context.churchId,
    p_options: options,
  });
  if (error)
    throw new FinanceReportError(
      error.message === "REPORT_CONFIGURATION_REQUIRED" ||
      error.message === "REPORT_TOO_LARGE" ||
      error.message === "REPORT_RECONCILIATION_REQUIRED" ||
      error.message === "FORBIDDEN"
        ? error.message
        : "UNAVAILABLE",
    );
  const parsed = rankingProjectionSchema.safeParse(data);
  if (!parsed.success) throw new FinanceReportError("UNAVAILABLE");
  const projection = parsed.data;
  for (const key of Object.keys(options) as (keyof RankingOptions)[])
    if (projection[key] !== options[key])
      throw new FinanceReportError("UNAVAILABLE");
  if (
    new Set(projection.units.map((u) => u.id)).size !== projection.units.length
  )
    throw new FinanceReportError("UNAVAILABLE");
  const rows = projection.units.map((u) => {
    const r = u.report;
    if (
      r.startMonth !== options.startMonth ||
      r.endMonth !== options.endMonth ||
      r.includePrebend !== options.includePrebend ||
      r.includeTransfer !== options.includeTransfer ||
      (!options.includeInactive && u.status !== "ACTIVE")
    )
      throw new FinanceReportError("UNAVAILABLE");
    const summary = summarizeInformativeProjection(r);
    return {
      id: u.id,
      name: u.name,
      status: u.status,
      isHeadquarters: u.isHeadquarters,
      incomeCents: summary.incomeCents,
      expenseCents: summary.expenseCents,
      closingCents: summary.closingCents,
      grossPrebendCents: sumCents(
        r.months.map((m) => m.recorded.grossPrebendCents ?? 0),
      ),
      transferCents: sumCents(
        r.months.map((m) => m.recorded.transferCents ?? 0),
      ),
    };
  });
  const ranking = summarizeRanking(rows);
  const review = projection.transferReview;
  if (
    options.includeTransfer !== (review !== null) ||
    (review &&
      sumCents([
        ranking.totals.transferCents,
        review.unidentifiedCents,
        review.outsideReportCents,
      ]) !== review.receivedCents)
  )
    throw new FinanceReportError("REPORT_RECONCILIATION_REQUIRED");
  return {
    ...options,
    transferReview: review,
    generatedAt: projection.generatedAt,
    ...ranking,
    ...(await identity(context)),
  };
}
export async function listFinanceDeliveries(
  context: FinanceContext,
  input: unknown,
) {
  assertAdministrativeReports(context);
  const query = deliveryQuerySchema.parse(input),
    client = await createClient();
  const { data, error } = await client.rpc("list_finance_deliveries", {
    p_church_id: context.churchId,
    p_month: query.month,
    p_include_inactive: query.includeInactive,
  });
  if (error) throwFinanceDatabaseError(error);
  const result = deliveryProjectionSchema.parse(data);
  if (
    result.month !== query.month ||
    result.includeInactive !== query.includeInactive
  )
    throw new Error("UNAVAILABLE");
  return result;
}
export async function getFinanceDeliveryReport(
  context: FinanceContext,
  input: DeliveryOptions,
): Promise<DeliveryDocument> {
  assertAdministrativeReports(context);
  const options = deliveryOptionsSchema.parse(input);
  const data = await listFinanceDeliveries(context, {
    month: options.month,
    includeInactive: options.includeInactive,
  });
  const rows = data.rows.filter(
    (r) =>
      (options.filter === "ALL" ||
        (options.filter === "DELIVERED"
          ? !!r.deliveryDate
          : !r.deliveryDate)) &&
      r.name
        .toLocaleLowerCase("pt-BR")
        .includes(options.search.toLocaleLowerCase("pt-BR")),
  );
  return {
    ...options,
    rows,
    generatedAt: data.generatedAt,
    dueDate: data.dueDate,
    today: data.today,
    ...(await identity(context)),
  };
}
export async function recordFinanceDelivery(
  context: FinanceContext,
  input: unknown,
) {
  assertAdministrativeReports(context);
  const value = recordDeliverySchema.parse(input),
    client = await createClient();
  const { data, error } = await client.rpc("record_finance_delivery", {
    p_church_id: context.churchId,
    p_payload: value,
  });
  if (error) throwFinanceDatabaseError(error);
  return data;
}
export async function saveFinanceDeliveryDeadline(
  context: FinanceContext,
  input: unknown,
) {
  assertAdministrativeReports(context);
  if (!context.capabilities.manageSettings) throw new Error("FORBIDDEN");
  const value = deliveryDeadlineSchema.parse(input),
    client = await createClient();
  const { data, error } = await client.rpc("save_finance_delivery_deadline", {
    p_church_id: context.churchId,
    p_payload: value,
  });
  if (error) throwFinanceDatabaseError(error);
  return data;
}

export async function listFinanceDeliveryRules(context: FinanceContext) {
  assertAdministrativeReports(context);
  const client = await createClient();
  const { data, error } = await client
    .from("finance_delivery_deadlines")
    .select("effective_month,due_day,revision")
    .eq("church_id", context.churchId)
    .is("deleted_at", null)
    .order("effective_month", { ascending: false })
    .order("revision", { ascending: false });
  if (error) throwFinanceDatabaseError(error);
  return z
    .array(deliveryRuleSchema)
    .parse(
      (data ?? []).map((r) => ({
        effectiveMonth: r.effective_month.slice(0, 7),
        day: r.due_day,
        revision: r.revision,
      })),
    );
}
