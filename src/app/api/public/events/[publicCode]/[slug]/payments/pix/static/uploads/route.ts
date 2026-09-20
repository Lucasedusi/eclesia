import { NextResponse, type NextRequest } from "next/server";
import { preparePublicStaticPixReceiptUpload } from "@/modules/events/services/event-public-checkout.service";
import { consumePublicCheckoutRateLimit } from "@/modules/events/services/public-checkout-rate-limit.service";
import { PublicRequestBodyError, readBoundedJsonBody } from "@/modules/events/utils/public-request";
import { publicStaticPixReceiptUploadSchema } from "@/modules/events/validations/event.schemas";

const MAX_BODY_SIZE = 16 * 1024;

export async function POST(request: NextRequest, context: { params: Promise<{ publicCode: string; slug: string }> }) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ message: "Origem não permitida." }, { status: 403 });
  const { publicCode, slug } = await context.params;
  try {
    const parsed = publicStaticPixReceiptUploadSchema.safeParse(await readBoundedJsonBody(request, MAX_BODY_SIZE));
    if (!parsed.success) return NextResponse.json({ message: "Envie um comprovante PDF, JPG, PNG ou WEBP de até 10 MB." }, { status: 400, headers: { "Cache-Control": "no-store" } });
    if (!await consumePublicCheckoutRateLimit(parsed.data.checkoutToken, "STATIC_PIX_UPLOAD")) {
      return NextResponse.json({ message: "Muitas tentativas. Aguarde alguns minutos e tente novamente." }, { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": "900" } });
    }
    const data = await preparePublicStaticPixReceiptUpload({ publicCode, slug, ...parsed.data });
    return NextResponse.json({ message: "Envio preparado.", data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível preparar o comprovante.";
    const status = error instanceof PublicRequestBodyError ? error.status : 400;
    return NextResponse.json({ message }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
