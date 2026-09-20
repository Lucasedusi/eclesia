import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export class MercadoPagoWebhookError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MercadoPagoWebhookError";
  }
}

export async function registerMercadoPagoWebhookEvent(input: { eventId: string; orderId: string }) {
  const admin = createAdminClient();
  const inserted = await admin.from("event_payment_webhook_events").insert({
    provider: "MERCADO_PAGO",
    provider_event_id: input.eventId,
    provider_payment_id: input.orderId,
    payload: { topic: "order" },
  });

  if (!inserted.error) return true;
  if (inserted.error.code !== "23505") {
    throw new MercadoPagoWebhookError("Não foi possível registrar a notificação.");
  }

  const reclaimed = await admin.from("event_payment_webhook_events")
    .update({ processing_status: "PROCESSING", processed_at: null })
    .eq("provider", "MERCADO_PAGO")
    .eq("provider_event_id", input.eventId)
    .eq("processing_status", "FAILED")
    .select("id")
    .maybeSingle();

  if (reclaimed.error) {
    throw new MercadoPagoWebhookError("Não foi possível registrar a notificação.");
  }

  return Boolean(reclaimed.data);
}

export async function finishMercadoPagoWebhookEvent(
  eventId: string,
  status: "PROCESSED" | "IGNORED" | "FAILED",
) {
  const admin = createAdminClient();
  const result = await admin.from("event_payment_webhook_events")
    .update({ processing_status: status, processed_at: new Date().toISOString() })
    .eq("provider", "MERCADO_PAGO")
    .eq("provider_event_id", eventId)
    .eq("processing_status", "PROCESSING");
  if (result.error) {
    throw new MercadoPagoWebhookError("Não foi possível concluir o processamento da notificação.");
  }
}
