import "server-only";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { FinanceContext } from "../types/finance.types";
import type {
  FinanceOverview,
  FinanceTransactionPage,
  FinanceTransactionDetail,
} from "../types/finance-query.types";
import { financeFiltersSchema } from "../validations/finance-query.schemas";
import { monthSchema } from "../validations/finance-catalog.schemas";
import { decimalToCents } from "../utils/finance-money";
import { throwFinanceDatabaseError } from "../utils/finance-errors";
export async function getFinanceOverview(
  context: FinanceContext,
  input: { month: string },
): Promise<FinanceOverview> {
  if (!context.capabilities.view) throw new Error("FORBIDDEN");
  const month = monthSchema.parse(input.month),
    c = await createClient();
  const { data, error } = await c.rpc("get_finance_overview", {
    p_church_id: context.churchId,
    p_unit: context.congregationId,
    p_month: month,
  });
  if (error) throwFinanceDatabaseError(error);
  return data as FinanceOverview;
}
export async function listFinanceTransactions(
  context: FinanceContext,
  input: unknown,
): Promise<FinanceTransactionPage> {
  if (!context.capabilities.view) throw new Error("FORBIDDEN");
  const filters = financeFiltersSchema.parse(input),
    c = await createClient();
  const { data, error } = await c.rpc("list_finance_transactions", {
    p_church_id: context.churchId,
    p_unit: context.congregationId,
    p_filters: filters,
  });
  if (error) throwFinanceDatabaseError(error);
  return data as FinanceTransactionPage;
}
export async function getFinanceTransaction(
  context: FinanceContext,
  id: string,
): Promise<FinanceTransactionDetail> {
  if (!context.capabilities.view) throw new Error("FORBIDDEN");
  z.uuid().parse(id);
  const c = await createClient();
  const { data: t, error } = await c
    .from("financial_transactions")
    .select(
      "id,transaction_date,transaction_type,amount,status,revision,person_name,beneficiary_name,category_name,department_name,classification_name,description,document_number,attendance_id,cashbox_id,payment_method_id,member_id,contributor_kind,category_id,department_id,tithe_classification_id,notes,payment_reference",
    )
    .eq("church_id", context.churchId)
    .eq("congregation_id", context.congregationId)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throwFinanceDatabaseError(error);
  if (!t) throw new Error("FORBIDDEN");
  let receiptQuery = c
    .from("financial_receipts")
    .select("id,receipt_number,revision,receipt_status")
    .eq("church_id", context.churchId)
    .eq("congregation_id", context.congregationId)
    .is("deleted_at", null);
  receiptQuery = t.attendance_id
    ? receiptQuery.eq("attendance_id", t.attendance_id)
    : receiptQuery.eq("financial_transaction_id", id);
  const [receipts, documents, history, attendance] = await Promise.all([
    receiptQuery.order("revision", { ascending: false }),
    c
      .from("financial_documents")
      .select("id,file_name")
      .eq("church_id", context.churchId)
      .eq("congregation_id", context.congregationId)
      .eq("financial_transaction_id", id)
      .eq("status", "ACTIVE")
      .is("deleted_at", null),
    c
      .from("financial_transaction_revisions")
      .select("revision,reason,created_at,previous_values,new_values")
      .eq("church_id", context.churchId)
      .eq("congregation_id", context.congregationId)
      .eq("transaction_id", id)
      .is("deleted_at", null)
      .order("revision", { ascending: false }),
    t.attendance_id
      ? c
          .from("financial_attendances")
          .select("revision")
          .eq("church_id", context.churchId)
          .eq("congregation_id", context.congregationId)
          .eq("id", t.attendance_id)
          .is("deleted_at", null)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  for (const r of [receipts, documents, history, attendance])
    if (r.error) throwFinanceDatabaseError(r.error);
  const amount = (value: unknown) => {
    if (
      !value ||
      typeof value !== "object" ||
      !("amount" in value) ||
      value.amount === null
    )
      return null;
    return decimalToCents(String(value.amount));
  };
  return {
    id: t.id,
    date: t.transaction_date,
    direction: t.transaction_type as "INCOME" | "EXPENSE",
    amountCents: decimalToCents(t.amount),
    status: t.status,
    revision: t.revision,
    personName: t.person_name,
    beneficiaryName: t.beneficiary_name,
    categoryName: t.category_name,
    departmentName: t.department_name,
    classificationName: t.classification_name,
    description: t.description,
    documentNumber: t.document_number,
    attendanceId: t.attendance_id,
    cashboxId: t.cashbox_id ?? "",
    paymentMethodId: t.payment_method_id ?? "",
    memberId: t.member_id,
    contributorKind: t.contributor_kind,
    categoryId: t.category_id,
    departmentId: t.department_id ?? "",
    titheClassificationId: t.tithe_classification_id,
    notes: t.notes,
    paymentReference: t.payment_reference,
    attendanceRevision: attendance.data?.revision ?? null,
    receipts: (receipts.data ?? []).map((r) => ({
      id: r.id,
      number: r.receipt_number,
      revision: r.revision,
      status: r.receipt_status,
    })),
    documents: (documents.data ?? []).map((d) => ({
      id: d.id,
      name: d.file_name,
    })),
    history: (history.data ?? []).map((h) => ({
      revision: h.revision,
      reason: h.reason,
      createdAt: h.created_at,
      beforeAmountCents: amount(h.previous_values),
      afterAmountCents: amount(h.new_values),
    })),
  };
}
export async function listFinanceTransfers(
  context: FinanceContext,
  month: string,
  page = 1,
) {
  if (!context.capabilities.view) throw new Error("FORBIDDEN");
  monthSchema.parse(month);
  if (!Number.isSafeInteger(page) || page < 1) throw new Error("INVALID_INPUT");
  const c = await createClient();
  const [year, m] = month.split("-").map(Number),
    end = `${m === 12 ? year + 1 : year}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}-01`;
  const { data, error, count } = await c
    .from("financial_transfers")
    .select(
      "id,transaction_date,source_cashbox_id,target_cashbox_id,amount,description,revision,status",
      { count: "exact" },
    )
    .eq("church_id", context.churchId)
    .eq("congregation_id", context.congregationId)
    .is("deleted_at", null)
    .gte("transaction_date", `${month}-01`)
    .lt("transaction_date", end)
    .order("transaction_date", { ascending: false })
    .order("id", { ascending: false })
    .range((page - 1) * 20, page * 20 - 1);
  if (error) throwFinanceDatabaseError(error);
  return {
    page,
    pageCount: Math.max(1, Math.ceil((count ?? 0) / 20)),
    items: (data ?? []).map((t) => ({
      id: t.id,
      date: t.transaction_date,
      sourceCashboxId: t.source_cashbox_id,
      targetCashboxId: t.target_cashbox_id,
      amountCents: decimalToCents(t.amount),
      description: t.description,
      revision: t.revision,
      status: t.status,
    })),
  };
}
