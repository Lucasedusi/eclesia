import { NextResponse } from "next/server";
import { createCaravanThermalReceiptHtml } from "@/modules/events/services/event-caravan-receipt-html";
import { getInternalCaravanReceipt } from "@/modules/events/services/event-caravan-receipt.service";

export async function GET(_: Request, { params }: { params: Promise<{ eventId: string; groupId: string }> }) {
  try {
    const { eventId, groupId } = await params;
    const data = await getInternalCaravanReceipt(eventId, groupId);
    return new NextResponse(createCaravanThermalReceiptHtml(data), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "private, no-store", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer" } });
  } catch {
    return NextResponse.json({ message: "Comprovante térmico indisponível." }, { status: 404, headers: { "cache-control": "private, no-store" } });
  }
}
