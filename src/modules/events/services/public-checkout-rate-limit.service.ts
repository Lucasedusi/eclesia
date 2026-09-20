import "server-only";

import { createHash, createHmac } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export type PublicCheckoutRateLimitAction = "PIX_CREATE" | "PROVIDER_REFRESH" | "STATIC_PIX_UPLOAD" | "STATIC_PIX_SUBMIT";

const RATE_LIMITS: Record<PublicCheckoutRateLimitAction, { limit: number; windowSeconds: number }> = {
  PIX_CREATE: { limit: 6, windowSeconds: 600 },
  PROVIDER_REFRESH: { limit: 60, windowSeconds: 600 },
  STATIC_PIX_UPLOAD: { limit: 10, windowSeconds: 900 },
  STATIC_PIX_SUBMIT: { limit: 10, windowSeconds: 900 },
};

export class PublicCheckoutRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PublicCheckoutRateLimitError";
  }
}

export function createPublicCheckoutRateLimitKey(
  secret: string,
  eventId: string,
  checkoutToken: string,
  action: PublicCheckoutRateLimitAction,
) {
  return createHmac("sha256", secret)
    .update(`event-checkout-limit:${action}:${eventId}:${checkoutToken}`)
    .digest("hex");
}

export async function consumePublicCheckoutRateLimit(
  checkoutToken: string,
  action: PublicCheckoutRateLimitAction,
) {
  if (!/^[A-Za-z0-9_-]{40,120}$/.test(checkoutToken)) {
    throw new PublicCheckoutRateLimitError("Sessão de inscrição inválida.");
  }

  const secret = process.env.EVENT_CHECKOUT_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new PublicCheckoutRateLimitError("O checkout público ainda não está configurado para este ambiente.");
  }

  const admin = createAdminClient();
  const checkout = await admin.from("event_public_checkouts")
    .select("event_id,checkout_type")
    .eq("access_token_hash", createHash("sha256").update(checkoutToken).digest("hex"))
    .maybeSingle();

  if (checkout.error || !checkout.data) {
    throw new PublicCheckoutRateLimitError("Sessão de inscrição não encontrada.");
  }

  if (action === "PROVIDER_REFRESH" && checkout.data.checkout_type === "CARAVAN") {
    return true;
  }

  const settings = RATE_LIMITS[action];
  const result = await admin.rpc("consume_event_public_limit", {
    p_event_id: checkout.data.event_id,
    p_key_hash: createPublicCheckoutRateLimitKey(secret, checkout.data.event_id, checkoutToken, action),
    p_limit: settings.limit,
    p_window_seconds: settings.windowSeconds,
  });

  if (result.error) {
    throw new PublicCheckoutRateLimitError("Não foi possível validar a tentativa.");
  }

  return result.data === true;
}
