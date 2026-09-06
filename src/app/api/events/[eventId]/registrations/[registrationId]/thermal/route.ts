import { NextResponse } from "next/server";
import { createEventThermalReceiptHtml } from "@/modules/events/services/event-registration-receipt-html";
import { getInternalRegistrationReceipt } from "@/modules/events/services/event-registration-receipt.service";

export async function GET(_: Request, { params }: { params: Promise<{ eventId: string; registrationId: string }> }) {
  try {
    const { eventId, registrationId } = await params;
    const data = await getInternalRegistrationReceipt(eventId, registrationId);
    return new NextResponse(createEventThermalReceiptHtml(data), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "private, no-store", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer" } });
  } catch { return NextResponse.json({ message: "Comprovante térmico indisponível." }, { status: 404, headers: { "cache-control": "private, no-store" } }); }
}
