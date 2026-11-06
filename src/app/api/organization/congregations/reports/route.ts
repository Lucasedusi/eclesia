import { NextResponse } from "next/server";
import { PERMISSIONS, hasPermission } from "@/modules/auth/constants/permissions";
import { resolveAccessContext } from "@/modules/auth/services/access-context.service";
import { PublicRequestBodyError, readBoundedJsonBody } from "@/modules/events/utils/public-request";
import { generateCongregationReportDownload } from "@/modules/organization/services/congregation-report.service";
import { CongregationReportError } from "@/modules/organization/types/congregation-report.types";
import { congregationReportSchema } from "@/modules/organization/validations/congregation-report.schemas";

const privateHeaders = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
function failure(message: string, status: number) {
  return NextResponse.json({ message }, { status, headers: privateHeaders });
}

export async function POST(request: Request) {
  try {
    const access = await resolveAccessContext();
    if (access.status !== "ready") return failure("Entre novamente para gerar o relatório.", access.status === "anonymous" ? 401 : 403);
    if (![PERMISSIONS.organizationView, PERMISSIONS.congregationsReportsExport].every((p) => hasPermission(access.context.permissions, p))) {
      return failure("Seu acesso não permite exportar relatórios de congregações.", 403);
    }
    const origin = request.headers.get("origin");
    const requestUrl = new URL(request.url);
    const expectedOrigin = `${requestUrl.protocol}//${request.headers.get("host") || requestUrl.host}`;
    if ((origin && origin !== expectedOrigin) || request.headers.get("sec-fetch-site") === "cross-site") return failure("Origem da solicitação inválida.", 403);
    const input = congregationReportSchema.safeParse(await readBoundedJsonBody(request, 4096));
    if (!input.success) return failure("Opções do relatório inválidas.", 400);
    const result = await generateCongregationReportDownload(access.context, input.data);
    return new NextResponse(Buffer.from(result.body), { headers: { ...privateHeaders, "Content-Type": result.contentType, "Content-Disposition": `attachment; filename="${result.fileName}"` } });
  } catch (error) {
    if (error instanceof PublicRequestBodyError) return failure(error.message, error.status);
    if (error instanceof CongregationReportError) {
      if (error.code === "CONGREGATION_REPORT_PERMISSION_DENIED") return failure("Seu acesso não permite exportar este relatório.", 403);
      if (error.code === "CONGREGATION_REPORT_NOT_FOUND") return failure("Congregação não encontrada ou fora do seu acesso.", 404);
      if (error.code === "CONGREGATION_REPORT_TOO_LARGE") return failure("O relatório ultrapassa o limite de 10.000 registros. Selecione um conjunto menor de dados.", 422);
    }
    return failure("Não foi possível gerar o relatório agora. Tente novamente.", 500);
  }
}
