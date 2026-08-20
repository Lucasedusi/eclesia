import { NextResponse, type NextRequest } from "next/server";
import { getPublicCheckoutStatus } from "@/modules/events/services/event-public-checkout.service";
import { createEventReceiptPdf } from "@/modules/events/services/event-receipt-pdf.service";
import { publicCheckoutTokenSchema } from "@/modules/events/validations/event.schemas";

export async function POST(request: NextRequest, context: { params: Promise<{ publicCode: string; slug: string }> }) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ message: "Origem não permitida." }, { status: 403 });
  const { publicCode, slug } = await context.params;
  try {
    const parsed = publicCheckoutTokenSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ message: "Sessão inválida." }, { status: 400 });
    const checkout = await getPublicCheckoutStatus(publicCode, slug, parsed.data.checkoutToken, false);
    if (checkout.registrationStatus !== "CONFIRMED") return NextResponse.json({ message: "O comprovante será liberado após a confirmação." }, { status: 409 });
    const pdf = await createEventReceiptPdf(checkout);
    const safeNumber = checkout.registrationNumber.replace(/[^a-zA-Z0-9_-]/g, "");
    return new NextResponse(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="comprovante-evento-${safeNumber}.pdf"`, "Cache-Control": "private, no-store" } });
  } catch (error) {
    const message = error instanceof Error && error.message !== "EVENT_RECEIPT_NOT_AVAILABLE" ? error.message : "Comprovante indisponível.";
    return NextResponse.json({ message }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
}
