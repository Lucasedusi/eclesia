import { NextResponse } from "next/server";
import { PERMISSIONS, hasPermission } from "@/modules/auth/constants/permissions";
import { resolveAccessContext } from "@/modules/auth/services/access-context.service";
import { PublicRequestBodyError, readBoundedJsonBody } from "@/modules/events/utils/public-request";
import { generateMemberReportDownload } from "@/modules/members/services/member-report.service";
import { MemberReportError } from "@/modules/members/types/member-report.types";
import { memberReportRequestSchema } from "@/modules/members/validations/member-report.schemas";

const privateHeaders = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
function failure(message: string, status: number) { return NextResponse.json({ message }, { status, headers: privateHeaders }); }
export async function POST(request: Request) {
  try {
    const access = await resolveAccessContext();
    if (access.status !== "ready") return failure("Entre novamente para gerar a listagem.", access.status === "anonymous" ? 401 : 403);
    if (![PERMISSIONS.membersExport, PERMISSIONS.membersViewBasic, PERMISSIONS.membersViewFull].every((p) => hasPermission(access.context.permissions, p))) return failure("Seu acesso não permite exportar listagens de membros.", 403);
    const origin = request.headers.get("origin"), url = new URL(request.url);
    const expectedOrigin = `${url.protocol}//${request.headers.get("host") || url.host}`;
    if ((origin && origin !== expectedOrigin) || request.headers.get("sec-fetch-site") === "cross-site") return failure("Origem da solicitação inválida.", 403);
    const input = memberReportRequestSchema.safeParse(await readBoundedJsonBody(request, 4096));
    if (!input.success) return failure("Opções da listagem inválidas. Revise os campos e os filtros.", 400);
    const result = await generateMemberReportDownload(access.context, input.data);
    return new NextResponse(Buffer.from(result.body), { headers: { ...privateHeaders, "Content-Type": result.contentType, "Content-Disposition": `attachment; filename="${result.fileName}"` } });
  } catch (error) {
    if (error instanceof PublicRequestBodyError) return failure(error.message, error.status);
    if (error instanceof MemberReportError) {
      if (error.code === "MEMBER_REPORT_PERMISSION_DENIED") return failure("Seu acesso não permite exportar esta listagem ou os campos selecionados.", 403);
      if (error.code === "MEMBER_REPORT_TOO_LARGE") return failure("A seleção ultrapassa 10.000 membros. Refine os filtros para reduzir a quantidade de registros.", 422);
    }
    return failure("Não foi possível gerar a listagem agora. Tente novamente.", 500);
  }
}
