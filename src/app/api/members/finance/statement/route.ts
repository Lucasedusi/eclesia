import { NextResponse } from "next/server";
import { resolveAccessContext } from "@/modules/auth/services/access-context.service";
import {
  readBoundedJsonBody,
  PublicRequestBodyError,
} from "@/modules/events/utils/public-request";
import { MemberFinanceError } from "@/modules/members/types/member-finance.types";
import { memberThermalStatementSchema } from "@/modules/members/validations/member-finance.schemas";
import { prepareMemberThermalStatement } from "@/modules/members/services/member-thermal-statement.service";

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
        "Entre novamente para preparar o extrato.",
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
    const input = memberThermalStatementSchema.safeParse(
      await readBoundedJsonBody(request, 4096),
    );
    if (!input.success)
      return failure("Revise o membro, os filtros e a largura do papel.", 400);
    const html = await prepareMemberThermalStatement(
      access.context,
      input.data,
    );
    return new NextResponse(html, {
      headers: {
        ...headers,
        "Content-Type": "text/html; charset=utf-8",
        "Content-Security-Policy":
          "default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'self'; form-action 'none'",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch (error) {
    if (error instanceof PublicRequestBodyError)
      return failure(error.message, error.status);
    if (error instanceof MemberFinanceError) {
      if (error.code === "FORBIDDEN")
        return failure("Seu acesso não permite imprimir este extrato.", 403);
      if (error.code === "NOT_FOUND")
        return failure(
          "Membro ou categoria não encontrados no seu acesso.",
          404,
        );
      if (error.code === "TOO_LARGE")
        return failure(
          "Reduza o período ou selecione uma categoria para consultar até 10.000 contribuições.",
          422,
        );
    }
    return failure(
      "Não foi possível preparar o extrato. Tente novamente.",
      500,
    );
  }
}
