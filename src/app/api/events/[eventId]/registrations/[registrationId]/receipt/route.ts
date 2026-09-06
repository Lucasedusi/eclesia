import { NextResponse } from "next/server";
import { createEventReceiptPdf } from "@/modules/events/services/event-receipt-pdf.service";
import { getInternalRegistrationReceipt } from "@/modules/events/services/event-registration-receipt.service";

export async function GET(_: Request, { params }: { params: Promise<{ eventId: string; registrationId: string }> }) {
  try {
    const { eventId, registrationId } = await params;
    const data = await getInternalRegistrationReceipt(eventId, registrationId);
    const pdf = await createEventReceiptPdf(data, { allowPending: true });
    return new NextResponse(new Uint8Array(pdf), { headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="comprovante-${data.registrationNumber}.pdf"`, "cache-control": "private, no-store" } });
  } catch { return NextResponse.json({ message: "Comprovante indisponível." }, { status: 404, headers: { "cache-control": "private, no-store" } }); }
}
