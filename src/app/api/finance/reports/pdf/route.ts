import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveAccessContext } from "@/modules/auth/services/access-context.service";
import { requireFinanceContext } from "@/modules/finance/services/finance-access.service";
import { FINANCE_PERMISSIONS } from "@/modules/finance/constants/finance-permissions";
import { getFinanceReport } from "@/modules/finance/services/finance-report.service";
import { createFinanceReportPdf } from "@/modules/finance/services/finance-report-pdf.service";
import { financeReportOptionsSchema } from "@/modules/finance/validations/finance-report.schemas";
import { FinanceReportError } from "@/modules/finance/types/finance-report.types";
import { financeInformativeReportOptionsSchema } from "@/modules/finance/validations/finance-informative-report.schemas";
import { getFinanceInformativeReport } from "@/modules/finance/services/finance-informative-report.service";
import { canViewInformativeReport } from "@/modules/finance/utils/finance-report-access";
import {
  PublicRequestBodyError,
  readBoundedJsonBody,
} from "@/modules/events/utils/public-request";
const schema = z.union([
  financeReportOptionsSchema.extend({ congregationId: z.uuid() }),
  financeInformativeReportOptionsSchema.safeExtend({
    congregationId: z.uuid(),
  }),
]);
const headers = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};
const failure = (message: string, status: number) =>
  NextResponse.json({ message }, { status, headers });
export async function POST(request: Request) {
  try {
    const access = await resolveAccessContext();
    if (access.status !== "ready")
      return failure(
        "Entre novamente para gerar o relatório.",
        access.status === "anonymous" ? 401 : 403,
      );
    if (!access.context.permissions.includes(FINANCE_PERMISSIONS.view))
      return failure(
        "Seu acesso não permite consultar relatórios financeiros.",
        403,
      );
    const origin = request.headers.get("origin");
    const requestUrl = new URL(request.url);
    const expectedOrigin = `${requestUrl.protocol}//${request.headers.get("host") || requestUrl.host}`;
    if (
      (origin && origin !== expectedOrigin) ||
      request.headers.get("sec-fetch-site") === "cross-site"
    )
      return failure("Origem da solicitação inválida.", 403);
    const parsed = schema.safeParse(await readBoundedJsonBody(request, 4096));
    if (!parsed.success)
      return failure("Confira o tipo, período e caixa selecionados.", 400);
    const { congregationId, ...options } = parsed.data;
    const context = await requireFinanceContext({
      congregationId,
      permission: FINANCE_PERMISSIONS.view,
    });
    if (options.type === "INFORMATIVE" && !canViewInformativeReport(context))
      return failure(
        "Este relatório está disponível somente para administradores.",
        403,
      );
    const report =
      options.type === "INFORMATIVE"
        ? await getFinanceInformativeReport(context, options)
        : await getFinanceReport(context, options);
    const bytes = await createFinanceReportPdf(report);
    const name =
      options.type === "INFORMATIVE"
        ? `relatorio-informativo-${options.startMonth}-a-${options.endMonth}.pdf`
        : `relatorio-${options.type === "ANALYTIC" ? "analitico" : "sintetico"}-${options.month}.pdf`;
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        ...headers,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${name}"`,
      },
    });
  } catch (error) {
    if (error instanceof PublicRequestBodyError)
      return failure(error.message, error.status);
    if (error instanceof Error && error.message === "FORBIDDEN")
      return failure("Congregação ou caixa fora do seu acesso.", 403);
    if (error instanceof FinanceReportError) {
      if (error.code === "REPORT_TOO_LARGE")
        return failure(
          "Este relatório excede o limite de geração. Reduza o período ou selecione um caixa nos modelos mensais.",
          422,
        );
      if (error.code === "REPORT_RECONCILIATION_REQUIRED")
        return failure(
          "Há divergência entre lançamentos e movimentos de saldo. Solicite a conferência ao administrador antes de emitir o relatório.",
          422,
        );
    }
    return failure(
      "Não foi possível gerar o relatório agora. Tente novamente.",
      500,
    );
  }
}
