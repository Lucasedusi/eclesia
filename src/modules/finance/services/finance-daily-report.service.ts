import "server-only";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { FinanceReportError } from "../types/finance-report.types";
import type { FinanceContext } from "../types/finance.types";
import { hasFinanceAdminAccess } from "../utils/finance-report-access";
import { sumCents } from "../utils/finance-money";
import {
  dailyReportOptions,
  dailyReportSnapshot,
  type DailyReportOptions,
  type DailyReportDocument,
  type CashBalanceAccount,
  type CashBalanceReportDocument,
} from "../validations/finance-daily-report.schemas";
import { loadFinanceReportIdentity } from "./finance-report.service";

export async function getDailyCashFlowReport(
  context: FinanceContext,
  input: DailyReportOptions,
): Promise<DailyReportDocument | CashBalanceReportDocument> {
  if (!hasFinanceAdminAccess(context))
    throw new FinanceReportError("FORBIDDEN");
  const options = dailyReportOptions.parse(input);
  const balanceOnly = options.presentation === "BALANCES";
  const boxId = balanceOnly ? undefined : options.box;
  const client = await createClient();
  const { data, error } = await client.rpc(
    "get_finance_daily_cash_flow_report",
    {
      p_church_id: context.churchId,
      p_day: options.date,
      p_box: boxId,
      p_detail: options.presentation === "DETAIL",
      p_payments: !balanceOnly && options.includePayments,
    },
  );
  if (error) {
    const code = error.message;
    if (
      code === "FORBIDDEN" ||
      code === "INVALID_INPUT" ||
      code === "REPORT_CONFIGURATION_REQUIRED" ||
      code === "REPORT_RECONCILIATION_REQUIRED"
    )
      throw new FinanceReportError(code);
    throw new FinanceReportError("UNAVAILABLE");
  }
  const parsed = dailyReportSnapshot.safeParse(data);
  if (
    !parsed.success ||
    parsed.data.date !== options.date ||
    parsed.data.box !== (boxId ?? null)
  )
    throw new FinanceReportError("UNAVAILABLE");
  const snapshot = parsed.data;
  if (boxId && (snapshot.boxes.length !== 1 || snapshot.boxes[0].id !== boxId))
    throw new FinanceReportError("UNAVAILABLE");
  // The report RPC resolves and authorizes the Cathedral even when another unit is selected.
  const unitContext = { ...context, congregationId: snapshot.unitId };
  if (balanceOnly) {
    const [identity, accounts] = await Promise.all([
      loadFinanceReportIdentity(unitContext),
      loadBalanceAccounts(client, unitContext, snapshot.boxes),
    ]);
    return {
      ...identity,
      type: "DAILY",
      presentation: "BALANCES",
      date: snapshot.date,
      generatedAt: snapshot.generatedAt,
      emissionId: randomUUID(),
      accounts,
      totalCents: accounts.reduce(
        (total, account) => sumCents(total, account.closing),
        0,
      ),
    };
  }
  const summary = { opening: 0, income: 0, expense: 0, closing: 0 };
  for (const box of snapshot.boxes) {
    for (const key of ["opening", "income", "expense", "closing"] as const)
      summary[key] = sumCents(summary[key], box[key]);
  }
  const identity = await loadFinanceReportIdentity(unitContext);
  return {
    ...snapshot,
    ...identity,
    type: "DAILY",
    presentation: options.presentation,
    includePayments: options.includePayments,
    summary,
    emissionId: randomUUID(),
  };
}

// All nonzero balances come from a single reconciled ledger snapshot. The catalog
// supplies active accounts omitted from that snapshot because their balance is zero.
async function loadBalanceAccounts(
  client: Awaited<ReturnType<typeof createClient>>,
  context: FinanceContext,
  positions: Pick<CashBalanceAccount, "id" | "closing">[],
): Promise<CashBalanceAccount[]> {
  const balances = new Map(positions.map((p) => [p.id, p.closing]));
  const accounts: CashBalanceAccount[] = [];
  const pageSize = 250;
  let after: string | undefined;
  for (;;) {
    let query = client
      .from("financial_cashboxes")
      .select("id,name,status,cashbox_type,bank_name,agency,account_number")
      .eq("church_id", context.churchId)
      .eq("congregation_id", context.congregationId)
      .is("deleted_at", null)
      .order("id")
      .limit(pageSize);
    if (after) query = query.gt("id", after);
    const { data, error } = await query;
    if (error || !data) throw new FinanceReportError("UNAVAILABLE");
    for (const box of data) {
      const closing = balances.get(box.id) ?? 0;
      balances.delete(box.id);
      const inactive = box.status === "INACTIVE";
      if (inactive && closing === 0) continue;
      accounts.push({
        id: box.id,
        name: box.name,
        inactive,
        closing,
        bankDetails:
          box.cashbox_type === "BANK_ACCOUNT"
            ? {
                bankName: box.bank_name,
                agency: box.agency,
                accountNumber: box.account_number,
              }
            : null,
      });
    }
    if (data.length < pageSize) break;
    after = data[data.length - 1].id;
  }
  if ([...balances.values()].some((balance) => balance !== 0))
    throw new FinanceReportError("REPORT_RECONCILIATION_REQUIRED");
  return accounts.sort(
    (a, b) => a.name.localeCompare(b.name, "pt-BR") || a.id.localeCompare(b.id),
  );
}
