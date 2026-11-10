import "server-only";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { PERMISSIONS } from "@/modules/auth/constants/permissions";
import type { AuthContext } from "@/modules/auth/types/auth.types";
import { listFinanceUnits } from "@/modules/finance/services/finance-access.service";
import { memberFinanceFiltersSchema } from "../validations/member-finance.schemas";
import {
  MemberFinanceError,
  type MemberFinancialData,
} from "../types/member-finance.types";
import { formatDateOnly } from "../utils/member-formatters";

type Row = Record<string, unknown>;
const first = (value: unknown): Row =>
  ((Array.isArray(value) ? value[0] : value) as Row) ?? {};
export async function loadMemberFinancialData(
  context: AuthContext,
  memberId: string,
  input: unknown,
  options: { confirmedIncomeOnly?: boolean } = {},
): Promise<MemberFinancialData> {
  if (
    ![PERMISSIONS.financeView, PERMISSIONS.membersViewBasic].every((p) =>
      context.permissions.includes(p),
    )
  )
    throw new MemberFinanceError("FORBIDDEN");
  z.uuid().parse(memberId);
  const filters = memberFinanceFiltersSchema.parse(input);
  const c = await createClient();
  let memberQuery = c
    .from("members")
    .select(
      "id,full_name,member_code,congregation_id,congregation:congregations!members_congregation_id_fkey(region_id,name)",
    )
    .eq("church_id", context.church.id)
    .eq("id", memberId);
  if (!context.permissions.includes(PERMISSIONS.membersRestore))
    memberQuery = memberQuery.is("deleted_at", null);
  const { data: member, error } = await memberQuery.maybeSingle();
  if (error) throw new MemberFinanceError("UNAVAILABLE");
  if (!member) throw new MemberFinanceError("NOT_FOUND");
  const scope = context.access.scope;
  if (
    (scope === "CONGREGATION" &&
      (!context.access.congregationId ||
        member.congregation_id !== context.access.congregationId)) ||
    (scope === "REGION" &&
      (!context.access.regionId ||
        first(member.congregation).region_id !== context.access.regionId))
  )
    throw new MemberFinanceError("NOT_FOUND");
  if (scope === "MINISTRY") {
    if (
      !context.access.ministryId ||
      !context.permissions.includes(PERMISSIONS.ministriesView)
    )
      throw new MemberFinanceError("NOT_FOUND");
    const membership = await c
      .from("member_ministries")
      .select("member_id")
      .eq("church_id", context.church.id)
      .eq("member_id", memberId)
      .eq("ministry_id", context.access.ministryId)
      .eq("status", "ACTIVE")
      .is("deleted_at", null)
      .maybeSingle();
    if (membership.error) throw new MemberFinanceError("UNAVAILABLE");
    if (!membership.data) throw new MemberFinanceError("NOT_FOUND");
  }
  const units = (await listFinanceUnits(context))
    .filter((u) => u.capabilities?.view)
    .map((u) => u.id);
  const result: MemberFinancialData = {
    member: {
      id: member.id,
      name: member.full_name,
      code: member.member_code ?? "",
      congregationName: (first(member.congregation).name as string) || null,
    },
    items: [],
    category: null,
    categories: [],
    summary: {
      incomeCents: 0,
      expenseCents: 0,
      cancelledCents: 0,
      pendingCents: 0,
    },
    period:
      filters.dateFrom && filters.dateTo
        ? `${formatDateOnly(filters.dateFrom)} a ${formatDateOnly(filters.dateTo)}`
        : filters.dateFrom
          ? `A partir de ${formatDateOnly(filters.dateFrom)}`
          : filters.dateTo
            ? `Até ${formatDateOnly(filters.dateTo)}`
            : "Todo o período",
  };
  if (!units.length) {
    if (filters.categoryId) throw new MemberFinanceError("NOT_FOUND");
    return result;
  }
  let categoryCount: number | undefined;
  const categoryIds = new Set<string>();
  do {
    const page = await c
      .from("financial_categories")
      .select("id,name,church_id", { count: "exact" })
      .eq("church_id", context.church.id)
      .is("deleted_at", null)
      .order("name")
      .order("id")
      .range(result.categories.length, result.categories.length + 499);
    if (
      page.error ||
      page.count === null ||
      !Array.isArray(page.data) ||
      page.count > 10000
    )
      throw new MemberFinanceError("UNAVAILABLE");
    categoryCount ??= page.count;
    if (
      page.count !== categoryCount ||
      (result.categories.length < categoryCount && !page.data.length)
    )
      throw new MemberFinanceError("UNAVAILABLE");
    for (const category of page.data) {
      if (
        category.church_id !== context.church.id ||
        categoryIds.has(category.id)
      )
        throw new MemberFinanceError("UNAVAILABLE");
      categoryIds.add(category.id);
      result.categories.push({ id: category.id, name: category.name });
    }
  } while (result.categories.length < categoryCount);
  if (filters.categoryId) {
    const category = result.categories.find(
      (item) => item.id === filters.categoryId,
    );
    if (!category) throw new MemberFinanceError("NOT_FOUND");
    result.category = category.name;
  }
  const seen = new Set<string>();
  let total: number | undefined;
  do {
    let q = c
      .from("financial_transactions")
      .select(
        "id,church_id,member_id,congregation_id,transaction_number,transaction_type,description,amount,transaction_date,status,category_id,category_name,category:financial_categories!finance_tx_category(name),method:financial_payment_methods!financial_transactions_payment_method_id_fkey(name)",
        { count: "exact" },
      )
      .eq("church_id", context.church.id)
      .eq("member_id", memberId)
      .in("congregation_id", units)
      .is("deleted_at", null);
    if (filters.dateFrom) q = q.gte("transaction_date", filters.dateFrom);
    if (filters.dateTo) q = q.lte("transaction_date", filters.dateTo);
    if (filters.categoryId) q = q.eq("category_id", filters.categoryId);
    if (options.confirmedIncomeOnly)
      q = q.eq("transaction_type", "INCOME").eq("status", "CONFIRMED");
    const page = await q
      .order("transaction_date", { ascending: false })
      .order("id", { ascending: false })
      .range(result.items.length, result.items.length + 499);
    if (page.error || page.count === null || !Array.isArray(page.data))
      throw new MemberFinanceError("UNAVAILABLE");
    if (page.count > 10000) throw new MemberFinanceError("TOO_LARGE");
    total ??= page.count;
    if (
      page.count !== total ||
      (result.items.length < total && !page.data.length)
    )
      throw new MemberFinanceError("UNAVAILABLE");
    for (const row of page.data as Row[]) {
      if (
        typeof row.id !== "string" ||
        seen.has(row.id) ||
        row.church_id !== context.church.id ||
        row.member_id !== memberId ||
        (filters.categoryId && row.category_id !== filters.categoryId) ||
        (options.confirmedIncomeOnly &&
          (row.transaction_type !== "INCOME" || row.status !== "CONFIRMED")) ||
        !units.includes(String(row.congregation_id))
      )
        throw new MemberFinanceError("UNAVAILABLE");
      seen.add(row.id);
      const amount = Number(row.amount),
        cents = Math.round(amount * 100);
      if (!Number.isSafeInteger(cents) || cents < 0)
        throw new MemberFinanceError("UNAVAILABLE");
      const key =
        row.status === "CANCELLED"
          ? "cancelledCents"
          : row.status !== "CONFIRMED"
            ? "pendingCents"
            : row.transaction_type === "INCOME"
              ? "incomeCents"
              : row.transaction_type === "EXPENSE"
                ? "expenseCents"
                : null;
      if (!key) throw new MemberFinanceError("UNAVAILABLE");
      result.summary[key] += cents;
      if (!Number.isSafeInteger(result.summary[key]))
        throw new MemberFinanceError("UNAVAILABLE");
      result.items.push({
        id: row.id,
        transactionNumber: row.transaction_number as string | null,
        transactionType: String(row.transaction_type),
        description: row.description as string | null,
        amount,
        transactionDate: String(row.transaction_date),
        status: String(row.status),
        category: String(
          row.category_name || first(row.category).name || "Sem categoria",
        ),
        paymentMethod: (first(row.method).name as string) || null,
      });
    }
  } while (result.items.length < total);
  if (result.items.length !== total)
    throw new MemberFinanceError("UNAVAILABLE");
  return result;
}
