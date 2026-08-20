import "server-only";

import { normalizeMercadoPagoStatus, verifyMercadoPagoWebhookSignature, type NormalizedPaymentStatus } from "../utils/mercado-pago-pix";

export { normalizeMercadoPagoStatus, verifyMercadoPagoWebhookSignature };
export type { NormalizedPaymentStatus };

const API_URL = "https://api.mercadopago.com";

export type MercadoPagoPayment = {
  id: number | string;
  status: string;
  status_detail?: string;
  transaction_amount: number;
  external_reference?: string | null;
  date_created?: string;
  date_approved?: string | null;
  date_of_expiration?: string | null;
  payment_method_id?: string;
  point_of_interaction?: {
    transaction_data?: {
      qr_code?: string;
      qr_code_base64?: string;
      ticket_url?: string;
    };
  };
};

export class MercadoPagoPixError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MercadoPagoPixError";
  }
}

function accessToken() {
  const token = process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim();
  if (!token) throw new MercadoPagoPixError("O Pix ainda não está configurado para este ambiente.");
  return token;
}

async function mercadoPagoRequest<T>(path: string, init?: RequestInit) {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      accept: "application/json",
      authorization: `Bearer ${accessToken()}`,
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const payload = await response.json().catch(() => null) as (T & { message?: string; error?: string }) | null;
  if (!response.ok || !payload) {
    console.error("[events] Mercado Pago request failed", { path, status: response.status, providerError: payload?.error });
    throw new MercadoPagoPixError("Não foi possível gerar ou consultar o Pix agora. Tente novamente.");
  }
  return payload;
}

export async function createMercadoPagoPixCharge(input: {
  amount: number;
  participantName: string;
  payerEmail: string;
  payerCpf: string;
  eventName: string;
  externalReference: string;
  idempotencyKey: string;
  expiresAt: string;
}) {
  const [firstName, ...lastNameParts] = input.participantName.trim().split(/\s+/);
  const notificationUrl = process.env.MERCADO_PAGO_WEBHOOK_URL?.trim()
    || `${process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? ""}/api/payments/webhooks/mercado-pago`;
  if (!notificationUrl.startsWith("https://") && process.env.MERCADO_PAGO_ENV !== "test") {
    throw new MercadoPagoPixError("Configure uma URL HTTPS para receber as confirmações do Pix.");
  }

  return mercadoPagoRequest<MercadoPagoPayment>("/v1/payments", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-idempotency-key": input.idempotencyKey,
    },
    body: JSON.stringify({
      transaction_amount: Number(input.amount.toFixed(2)),
      description: `EKLESIA EVENTOS — ${input.eventName}`.slice(0, 255),
      payment_method_id: "pix",
      external_reference: input.externalReference,
      notification_url: notificationUrl,
      date_of_expiration: input.expiresAt,
      payer: {
        email: input.payerEmail,
        first_name: firstName,
        last_name: lastNameParts.join(" ") || firstName,
        identification: { type: "CPF", number: input.payerCpf.replace(/\D/g, "") },
      },
    }),
  });
}

export function getMercadoPagoPayment(providerPaymentId: string) {
  if (!/^\d+$/.test(providerPaymentId)) throw new MercadoPagoPixError("Identificador de pagamento inválido.");
  return mercadoPagoRequest<MercadoPagoPayment>(`/v1/payments/${providerPaymentId}`);
}

export function publicPixData(payment: MercadoPagoPayment) {
  const transaction = payment.point_of_interaction?.transaction_data;
  return {
    providerPaymentId: String(payment.id),
    providerStatus: payment.status,
    paymentStatus: normalizeMercadoPagoStatus(payment.status, payment.date_of_expiration),
    qrCode: transaction?.qr_code ?? null,
    qrCodeBase64: transaction?.qr_code_base64 ?? null,
    ticketUrl: transaction?.ticket_url ?? null,
    expiresAt: payment.date_of_expiration ?? null,
  };
}
