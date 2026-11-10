import { NextResponse } from "next/server";
import { resolveAccessContext } from "@/modules/auth/services/access-context.service";
import {
  readBoundedJsonBody,
  PublicRequestBodyError,
} from "@/modules/events/utils/public-request";
import { memberFinanceExportSchema } from "@/modules/members/validations/member-finance.schemas";
import { generateMemberFinancialDownload } from "@/modules/members/services/member-financial-report.service";
import { MemberFinanceError } from "@/modules/members/types/member-finance.types";
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
        "Entre novamente para exportar o relatório.",
        access.status === "anonymous" ? 401 : 403,
      );
    const url = new URL(request.url),
      origin = request.headers.get("origin"),
      expected = `${url.protocol}//${request.headers.get("host") || url.host}`;
    if (
      (origin && origin !== expected) ||
      request.headers.get("sec-fetch-site") === "cross-site"
    )
      return failure("Origem inválida.", 403);
    const input = memberFinanceExportSchema.safeParse(
      await readBoundedJsonBody(request, 4096),
    );
    if (!input.success)
      return failure("Revise o membro, o período e o formato.", 400);
    const result = await generateMemberFinancialDownload(
      access.context,
      input.data,
    );
    return new NextResponse(Buffer.from(result.body), {
      headers: {
        ...headers,
        "Content-Type": result.contentType,
        "Content-Disposition": `attachment; filename="${result.fileName}"`,
      },
    });
  } catch (error) {
    if (error instanceof PublicRequestBodyError)
      return failure(error.message, error.status);
    if (error instanceof MemberFinanceError) {
      if (error.code === "FORBIDDEN")
        return failure("Seu acesso não permite exportar este relatório.", 403);
      if (error.code === "NOT_FOUND")
        return failure("Membro não encontrado no seu acesso.", 404);
      if (error.code === "TOO_LARGE")
        return failure(
          "Selecione um período menor para exportar até 10.000 lançamentos.",
          422,
        );
    }
    return failure(
      "Não foi possível gerar o relatório financeiro. Tente novamente.",
      500,
    );
  }
}
