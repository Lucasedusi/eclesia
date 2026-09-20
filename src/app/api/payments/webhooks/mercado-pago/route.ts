import { NextResponse, type NextRequest } from "next/server";
import { reconcileMercadoPagoOrder } from "@/modules/events/services/event-public-checkout.service";
import { finishMercadoPagoWebhookEvent, registerMercadoPagoWebhookEvent } from "@/modules/events/services/mercado-pago-webhook.service";
import { verifyMercadoPagoWebhookSignature } from "@/modules/events/services/mercado-pago-pix.service";
import { PublicRequestBodyError, readBoundedJsonBody } from "@/modules/events/utils/public-request";

const MAX_BODY_SIZE = 16 * 1024;

export async function POST(request: NextRequest) {
  const dataId = request.nextUrl.searchParams.get("data.id") ?? request.nextUrl.searchParams.get("data_id") ?? "";
  const signature = request.headers.get("x-signature") ?? "";
  const requestId = request.headers.get("x-request-id") ?? "";
  if (!verifyMercadoPagoWebhookSignature({ signature, requestId, dataId })) return NextResponse.json({ message: "Assinatura inválida." }, { status: 401 });
  try {
    const body = await readBoundedJsonBody(request, MAX_BODY_SIZE) as { id?: string | number; type?: string; action?: string; data?: { id?: string | number } };
    const topic = body.type ?? request.nextUrl.searchParams.get("type");
    if (topic !== "order") return NextResponse.json({ received: true });
    const orderId = String(dataId || body.data?.id || "");
    if (!/^ORD[A-Z0-9]+$/i.test(orderId)) return NextResponse.json({ received: true });
    const notificationId = String(body.id ?? `${requestId}:${orderId}:${body.action ?? "order.updated"}`);
    const eventId = `order:${notificationId}`;
    if (!await registerMercadoPagoWebhookEvent({ eventId, orderId })) return NextResponse.json({ received: true, duplicate: true });
    try {
      await reconcileMercadoPagoOrder(orderId);
      await finishMercadoPagoWebhookEvent(eventId, "PROCESSED");
    } catch (error) {
      await finishMercadoPagoWebhookEvent(eventId, "FAILED");
      throw error;
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    if (error instanceof PublicRequestBodyError) {
      return NextResponse.json({ message: error.message }, { status: error.status, headers: { "Cache-Control": "no-store" } });
    }
    console.error("[events] Mercado Pago webhook failed", { message: error instanceof Error ? error.message : "UNKNOWN_ERROR" });
    return NextResponse.json({ received: false }, { status: 500 });
  }
}
