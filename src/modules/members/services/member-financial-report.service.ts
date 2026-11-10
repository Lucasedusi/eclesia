import "server-only";
import { createClient } from "@/lib/supabase/server";
import { PERMISSIONS } from "@/modules/auth/constants/permissions";
import type { AuthContext } from "@/modules/auth/types/auth.types";
import { loadChurchLogoDataUri } from "@/modules/auth/services/church-logo.service";
import { memberFinanceExportSchema } from "../validations/member-finance.schemas";
import {
  MemberFinanceError,
  type MemberFinancialDocument,
} from "../types/member-finance.types";
import { loadMemberFinancialData } from "./member-financial-data.service";
import {
  createMemberFinancialPdf,
  createMemberFinancialWorkbook,
} from "./member-financial-documents.service";
export async function generateMemberFinancialDownload(
  context: AuthContext,
  input: unknown,
) {
  if (
    ![PERMISSIONS.membersExport, PERMISSIONS.membersViewFull].every((p) =>
      context.permissions.includes(p),
    )
  )
    throw new MemberFinanceError("FORBIDDEN");
  const options = memberFinanceExportSchema.parse(input),
    data = await loadMemberFinancialData(
      context,
      options.memberId,
      options.filters,
    ),
    c = await createClient();
  const [churchResult, settingsResult] = await Promise.all([
    c
      .from("churches")
      .select("name,logo_url,senior_pastor_name,senior_pastor_spouse_name")
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
  if (churchResult.error || !churchResult.data || settingsResult.error)
    throw new MemberFinanceError("UNAVAILABLE");
  const church = churchResult.data,
    settings = settingsResult.data;
  const document: MemberFinancialDocument = {
    ...data,
    issuedAt: new Date().toISOString(),
    church: {
      name: settings?.display_church_name?.trim() || church.name,
      pastorNames: [
        church.senior_pastor_name,
        church.senior_pastor_spouse_name,
      ].filter((s): s is string => typeof s === "string" && !!s.trim()),
      logoDataUri: await loadChurchLogoDataUri(
        settings?.logo_url || church.logo_url || context.church.logoUrl,
        context.church.id,
        c,
      ),
      address: "",
      phone: "",
      document: "",
    },
  };
  const body =
    options.format === "pdf"
      ? await createMemberFinancialPdf(document)
      : await createMemberFinancialWorkbook(document);
  const audit = await c.rpc("log_audit", {
    p_church_id: context.church.id,
    p_module: "members",
    p_action: "EXPORT_MEMBER_FINANCE",
    p_entity_type: "member",
    p_entity_id: options.memberId,
    p_description: "Exportação do relatório financeiro individual.",
    p_metadata: {
      format: options.format,
      count: data.items.length,
      filtered: !!(options.filters.dateFrom || options.filters.dateTo),
    },
    p_severity: "INFO",
  });
  if (audit.error) throw new MemberFinanceError("AUDIT_FAILED");
  return {
    body,
    fileName: `financeiro-membro.${options.format}`,
    contentType:
      options.format === "pdf"
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
}
