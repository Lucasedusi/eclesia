import { NextResponse, type NextRequest } from "next/server";
import { createPublicPixPayment } from "@/modules/events/services/event-public-checkout.service";
import { consumePublicCheckoutRateLimit } from "@/modules/events/services/public-checkout-rate-limit.service";
import { PublicRequestBodyError, readBoundedJsonBody } from "@/modules/events/utils/public-request";
import { publicPixPaymentSchema } from "@/modules/events/validations/event.schemas";

const MAX_BODY_SIZE = 16 * 1024;

export async function POST(request: NextRequest, context: { params: Promise<{ publicCode: string; slug: string }> }) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ message: "Origem não permitida." }, { status: 403 });
  const { publicCode, slug } = await context.params;
  try {
    const parsed = publicPixPaymentSchema.safeParse(await readBoundedJsonBody(request, MAX_BODY_SIZE));
    if (!parsed.success) return NextResponse.json({ message: "Revise o e-mail e o CPF.", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 });
    if (!await consumePublicCheckoutRateLimit(parsed.data.checkoutToken, "PIX_CREATE")) {
      return NextResponse.json(
        { message: "Muitas tentativas. Aguarde alguns minutos e tente novamente." },
        { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": "900" } },
      );
    }
    const data = await createPublicPixPayment({ publicCode, slug, ...parsed.data });
    return NextResponse.json({ message: "Pix gerado com segurança.", data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível gerar o Pix.";
    const status = error instanceof PublicRequestBodyError ? error.status : 400;
    return NextResponse.json({ message }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
