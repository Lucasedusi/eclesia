import { NextResponse, type NextRequest } from "next/server";
import { getPublicTrackingStatus } from "@/modules/events/services/event-public-checkout.service";
import { consumePublicCheckoutRateLimit } from "@/modules/events/services/public-checkout-rate-limit.service";
import { PublicRequestBodyError, readBoundedJsonBody } from "@/modules/events/utils/public-request";
import { publicTrackingSchema } from "@/modules/events/validations/event.schemas";

const MAX_BODY_SIZE = 16 * 1024;

export async function POST(request: NextRequest, context: { params: Promise<{ publicCode: string; slug: string }> }) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ message: "Origem não permitida." }, { status: 403 });
  const { publicCode, slug } = await context.params;
  try {
    const parsed = publicTrackingSchema.safeParse(await readBoundedJsonBody(request, MAX_BODY_SIZE));
    if (!parsed.success) return NextResponse.json({ message: "Link de acompanhamento inválido." }, { status: 400, headers: { "cache-control": "no-store" } });
    if (parsed.data.refreshProvider && !await consumePublicCheckoutRateLimit(parsed.data.token, "PROVIDER_REFRESH")) {
      return NextResponse.json(
        { message: "Muitas tentativas. Aguarde alguns minutos e tente novamente." },
        { status: 429, headers: { "Cache-Control": "private, no-store", "Retry-After": "900" } },
      );
    }
    const data = await getPublicTrackingStatus(publicCode, slug, parsed.data.token, parsed.data.refreshProvider);
    return NextResponse.json({ data }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    const status = error instanceof PublicRequestBodyError ? error.status : 400;
    return NextResponse.json({ message: error instanceof Error ? error.message : "Não foi possível acompanhar esta inscrição." }, { status, headers: { "cache-control": "private, no-store" } });
  }
}
