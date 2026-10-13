import "server-only";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { loadChurchLogoDataUri } from "@/modules/auth/services/church-logo.service";
import type { FinanceContext } from "../types/finance.types";
import {
  FinanceReportError,
  type FinanceReportDocument,
  type FinanceReportOptions,
  type FinanceReportSummary,
} from "../types/finance-report.types";
import {
  financeReportOptionsSchema,
  financeReportProjectionSchema,
} from "../validations/finance-report.schemas";
export async function getFinanceReport(
  context: FinanceContext,
  input: FinanceReportOptions,
): Promise<FinanceReportDocument> {
  if (!context.capabilities.view) throw new FinanceReportError("FORBIDDEN");
  const options = financeReportOptionsSchema.parse(input);
  const client = await createClient();
  const { data, error } = await client.rpc("get_finance_report", {
    p_church_id: context.churchId,
    p_unit: context.congregationId,
    p_options: options,
  });
  if (error) {
    const code = error.message;
    throw new FinanceReportError(
      code === "REPORT_TOO_LARGE" ||
      code === "REPORT_RECONCILIATION_REQUIRED" ||
      code === "FORBIDDEN"
        ? code
        : "UNAVAILABLE",
    );
  }
  const parsed = financeReportProjectionSchema.safeParse(data);
  if (!parsed.success) throw new FinanceReportError("UNAVAILABLE");
  const projection = parsed.data;
  if (
    projection.month !== options.month ||
    projection.type !== options.type ||
    projection.cashboxId !== (options.cashboxId ?? null)
  )
    throw new FinanceReportError("UNAVAILABLE");
  const sum = (values: number[]) =>
    values.reduce((a, b) => a + BigInt(b), BigInt(0));
  const reconciles = (s: FinanceReportSummary) =>
    sum([
      s.openingCents,
      s.incomeCents,
      -s.expenseCents,
      s.openingMovementCents,
      s.adjustmentCents,
      s.transferNetCents,
    ]) === BigInt(s.closingCents);
  const s = projection.summary;
  const rows =
    projection.type === "ANALYTIC" ? projection.rows : projection.categories;
  const boxRows = new Map<
    string,
    { income: bigint; expense: bigint; count: number }
  >();
  if (projection.type === "ANALYTIC") {
    for (const row of projection.rows) {
      const sums = boxRows.get(row.cashboxId) ?? {
        income: BigInt(0),
        expense: BigInt(0),
        count: 0,
      };
      sums[row.direction === "INCOME" ? "income" : "expense"] += BigInt(
        row.amountCents,
      );
      sums.count++;
      boxRows.set(row.cashboxId, sums);
    }
  }
  const boxIds = new Set(projection.cashboxes.map((box) => box.id));
  const consistent =
    (projection.type !== "ANALYTIC" ||
      ([...boxRows.keys()].every((id) => boxIds.has(id)) &&
        projection.cashboxes.every((box) => {
          const sums = boxRows.get(box.id);
          return (
            (sums?.income ?? BigInt(0)) === BigInt(box.incomeCents) &&
            (sums?.expense ?? BigInt(0)) === BigInt(box.expenseCents) &&
            (sums?.count ?? 0) === box.count
          );
        }))) &&
    reconciles(s) &&
    projection.cashboxes.every(reconciles) &&
    (Object.keys(s) as (keyof FinanceReportSummary)[]).every(
      (key) => sum(projection.cashboxes.map((b) => b[key])) === BigInt(s[key]),
    ) &&
    sum(
      rows.filter((r) => r.direction === "INCOME").map((r) => r.amountCents),
    ) === BigInt(s.incomeCents) &&
    sum(
      rows.filter((r) => r.direction === "EXPENSE").map((r) => r.amountCents),
    ) === BigInt(s.expenseCents) &&
    sum(projection.departments.map((d) => d.incomeCents)) ===
      BigInt(s.incomeCents) &&
    sum(projection.departments.map((d) => d.expenseCents)) ===
      BigInt(s.expenseCents);
  if (!consistent)
    throw new FinanceReportError("REPORT_RECONCILIATION_REQUIRED");
  const [church, settings, unit] = await Promise.all([
    client
      .from("churches")
      .select("name,logo_url,document,city,state")
      .eq("id", context.churchId)
      .is("deleted_at", null)
      .maybeSingle(),
    client
      .from("app_settings")
      .select("display_church_name,logo_url")
      .eq("church_id", context.churchId)
      .is("deleted_at", null)
      .maybeSingle(),
    client
      .from("congregations")
      .select("name,address,number,complement,district,city,state,zip_code")
      .eq("church_id", context.churchId)
      .eq("id", context.congregationId)
      .is("deleted_at", null)
      .maybeSingle(),
  ]);
  if (
    church.error ||
    settings.error ||
    unit.error ||
    !church.data ||
    !unit.data
  )
    throw new FinanceReportError("UNAVAILABLE");
  const logoDataUri = await loadChurchLogoDataUri(
    settings.data?.logo_url ||
      church.data.logo_url ||
      context.auth.church.logoUrl,
    context.churchId,
    client,
  );
  return {
    ...projection,
    emissionId: randomUUID(),
    congregationName: unit.data.name,
    congregationAddress:
      [
        [unit.data.address, unit.data.number].filter(Boolean).join(", "),
        unit.data.complement,
        unit.data.district,
        [unit.data.city, unit.data.state].filter(Boolean).join(" / "),
        unit.data.zip_code ? `CEP ${unit.data.zip_code}` : null,
      ]
        .filter(Boolean)
        .join(" · ") || null,
    church: {
      name: settings.data?.display_church_name?.trim() || church.data.name,
      document: church.data.document,
      city:
        [church.data.city, church.data.state].filter(Boolean).join(" / ") ||
        null,
      logoDataUri,
    },
  };
}

export async function listFinanceReportCashboxes(context: FinanceContext) {
  if (!context.capabilities.view) throw new FinanceReportError("FORBIDDEN");
  const client = await createClient();
  const { data, error } = await client
    .from("financial_cashboxes")
    .select("id,name,status")
    .eq("church_id", context.churchId)
    .eq("congregation_id", context.congregationId)
    .is("deleted_at", null)
    .order("name");
  if (error) throw new FinanceReportError("UNAVAILABLE");
  return data ?? [];
}
