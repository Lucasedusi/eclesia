import { NextResponse, type NextRequest } from "next/server";
import { submitPublicStaticPixReceipt } from "@/modules/events/services/event-public-checkout.service";
import { consumePublicCheckoutRateLimit } from "@/modules/events/services/public-checkout-rate-limit.service";
import { PublicRequestBodyError, readBoundedJsonBody } from "@/modules/events/utils/public-request";
import { publicStaticPixReceiptSchema } from "@/modules/events/validations/event.schemas";

const MAX_BODY_SIZE = 16 * 1024;

export async function POST(request: NextRequest, context: { params: Promise<{ publicCode: string; slug: string }> }) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ message: "Origem não permitida." }, { status: 403 });
  const { publicCode, slug } = await context.params;
  try {
    const parsed = publicStaticPixReceiptSchema.safeParse(await readBoundedJsonBody(request, MAX_BODY_SIZE));
    if (!parsed.success) return NextResponse.json({ message: "Revise os dados do comprovante." }, { status: 400, headers: { "Cache-Control": "no-store" } });
    const idempotencyKey = request.headers.get("idempotency-key");
    if (!idempotencyKey || !/^[a-zA-Z0-9:_-]{16,120}$/.test(idempotencyKey)) {
      return NextResponse.json({ message: "Identificador de envio inválido." }, { status: 400, headers: { "Cache-Control": "no-store" } });
    }
    if (!await consumePublicCheckoutRateLimit(parsed.data.checkoutToken, "STATIC_PIX_SUBMIT")) {
      return NextResponse.json({ message: "Muitas tentativas. Aguarde alguns minutos e tente novamente." }, { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": "900" } });
    }
    const data = await submitPublicStaticPixReceipt({ publicCode, slug, idempotencyKey, ...parsed.data });
    return NextResponse.json({ message: "Comprovante enviado para análise.", data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível registrar o comprovante.";
    const status = error instanceof PublicRequestBodyError ? error.status : 400;
    return NextResponse.json({ message }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
