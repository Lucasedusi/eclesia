import { NextResponse, type NextRequest } from "next/server";
import { approveSimulatedPublicPixPayment } from "@/modules/events/services/event-public-checkout.service";
import { publicCheckoutTokenSchema } from "@/modules/events/validations/event.schemas";

export async function POST(request: NextRequest, context: { params: Promise<{ publicCode: string; slug: string }> }) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) {
    return NextResponse.json({ message: "Origem não permitida." }, { status: 403 });
  }
  const { publicCode, slug } = await context.params;
  try {
    const parsed = publicCheckoutTokenSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ message: "Sessão inválida." }, { status: 400 });
    const data = await approveSimulatedPublicPixPayment({ publicCode, slug, checkoutToken: parsed.data.checkoutToken });
    return NextResponse.json(
      { message: "Pagamento de teste aprovado.", data },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível aprovar o pagamento de teste.";
    return NextResponse.json({ message }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
}
