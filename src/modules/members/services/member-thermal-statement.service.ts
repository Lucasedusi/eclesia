import "server-only";
import { createClient } from "@/lib/supabase/server";
import { PERMISSIONS } from "@/modules/auth/constants/permissions";
import type { AuthContext } from "@/modules/auth/types/auth.types";
import { loadChurchLogoDataUri } from "@/modules/auth/services/church-logo.service";
import { MemberFinanceError } from "../types/member-finance.types";
import { memberThermalStatementSchema } from "../validations/member-finance.schemas";
import { loadMemberFinancialData } from "./member-financial-data.service";
import { renderMemberThermalStatement } from "./member-thermal-statement-html";

export async function prepareMemberThermalStatement(
  context: AuthContext,
  input: unknown,
) {
  if (
    ![
      PERMISSIONS.financeView,
      PERMISSIONS.membersViewBasic,
      PERMISSIONS.membersViewFull,
      PERMISSIONS.membersExport,
    ].every((p) => context.permissions.includes(p))
  )
    throw new MemberFinanceError("FORBIDDEN");
  const options = memberThermalStatementSchema.parse(input);
  const data = await loadMemberFinancialData(
    context,
    options.memberId,
    options.filters,
    { confirmedIncomeOnly: true },
  );
  if (
    data.items.some(
      (item) =>
        item.transactionType !== "INCOME" || item.status !== "CONFIRMED",
    )
  )
    throw new MemberFinanceError("UNAVAILABLE");
  const c = await createClient();
  const [church, settings] = await Promise.all([
    c
      .from("churches")
      .select("name,logo_url")
      .eq("id", context.church.id)
      .is("deleted_at", null)
      .maybeSingle(),
    c
      .from("app_settings")
      .select("display_church_name,logo_url")
      .eq("church_id", context.church.id)
      .is("deleted_at", null)
      .maybeSingle(),
  ]);
  if (church.error || !church.data || settings.error)
    throw new MemberFinanceError("UNAVAILABLE");
  const html = renderMemberThermalStatement(
    {
      churchName:
        settings.data?.display_church_name?.trim() || church.data.name,
      logoDataUri: await loadChurchLogoDataUri(
        settings.data?.logo_url ||
          church.data.logo_url ||
          context.church.logoUrl,
        context.church.id,
        c,
      ),
      congregationName: data.member.congregationName,
      memberName: data.member.name,
      period: data.period,
      category: data.category,
      issuedAt: new Date().toISOString(),
      totalCents: data.summary.incomeCents,
      items: data.items.map((item) => ({
        date: item.transactionDate,
        category: item.category,
        amountCents: Math.round(item.amount * 100),
      })),
    },
    options.width,
  );
  const audit = await c.rpc("log_audit", {
    p_church_id: context.church.id,
    p_module: "members",
    p_action: "EXPORT_MEMBER_FINANCE",
    p_entity_type: "member",
    p_entity_id: options.memberId,
    p_description:
      options.intent === "print"
        ? "Solicitação de impressão do extrato térmico do contribuinte."
        : "Preparação da prévia do extrato térmico do contribuinte.",
    p_metadata: {
      format: "thermal",
      intent: options.intent,
      width: options.width,
      count: data.items.length,
      filtered: !!(
        options.filters.dateFrom ||
        options.filters.dateTo ||
        options.filters.categoryId
      ),
    },
    p_severity: "INFO",
  });
  if (audit.error) throw new MemberFinanceError("AUDIT_FAILED");
  return html;
}
