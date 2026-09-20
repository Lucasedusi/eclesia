import "server-only";

import { normalizeMercadoPagoStatus, verifyMercadoPagoWebhookSignature, type NormalizedPaymentStatus } from "../utils/mercado-pago-pix";

export { normalizeMercadoPagoStatus, verifyMercadoPagoWebhookSignature };
export type { NormalizedPaymentStatus };

const API_URL = "https://api.mercadopago.com";

export type MercadoPagoPayment = {
  id: number | string;
  provider_order_id?: string;
  provider_transaction_id?: string;
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

type MercadoPagoOrderPayment = {
  id: string;
  amount: number | string;
  status: string;
  status_detail?: string;
  date_created?: string;
  date_approved?: string | null;
  date_of_expiration?: string | null;
  payment_method?: {
    id?: string;
    type?: string;
    qr_code?: string;
    qr_code_base64?: string;
    ticket_url?: string;
  };
};

type MercadoPagoOrder = {
  id: string;
  status?: string;
  status_detail?: string;
  total_amount: number | string;
  external_reference?: string | null;
  created_date?: string;
  last_updated_date?: string;
  transactions?: { payments?: MercadoPagoOrderPayment[] };
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

function orderExpirationDuration(expiresAt: string) {
  const expiration = Date.parse(expiresAt);
  if (!Number.isFinite(expiration)) {
    throw new MercadoPagoPixError("O vencimento do Pix é inválido.");
  }
  const minutes = Math.min(Math.max(Math.ceil((expiration - Date.now()) / 60_000), 30), 30 * 24 * 60);
  return `PT${minutes}M`;
}

async function assertTestCredential() {
  const account = await mercadoPagoRequest<{ tags?: string[] }>("/users/me");
  if (!account.tags?.includes("test_user")) {
    throw new MercadoPagoPixError("A credencial configurada não pertence a uma conta de teste.");
  }
}

function paymentFromOrder(order: MercadoPagoOrder, expiresAt?: string): MercadoPagoPayment {
  const transaction = order.transactions?.payments?.[0];
  if (!order.id) {
    throw new MercadoPagoPixError("O Mercado Pago retornou uma order inválida.");
  }
  const amount = Number(transaction?.amount ?? order.total_amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new MercadoPagoPixError("O Mercado Pago retornou um valor de pagamento inválido.");
  }
  const method = transaction?.payment_method;
  const status = transaction?.status ?? order.status ?? "processing";
  return {
    id: order.id,
    provider_order_id: order.id,
    ...(transaction?.id ? { provider_transaction_id: transaction.id } : {}),
    status,
    status_detail: transaction?.status_detail ?? order.status_detail,
    transaction_amount: amount,
    external_reference: order.external_reference,
    date_created: transaction?.date_created ?? order.created_date,
    date_approved: transaction?.date_approved
      ?? (status === "processed" ? order.last_updated_date ?? null : null),
    date_of_expiration: transaction?.date_of_expiration ?? expiresAt,
    payment_method_id: method?.id ?? "pix",
    point_of_interaction: {
      transaction_data: {
        qr_code: method?.qr_code,
        qr_code_base64: method?.qr_code_base64,
        ticket_url: method?.ticket_url,
      },
    },
  };
}

function mergeCreatedOrder(createdOrder: MercadoPagoOrder, refreshedOrder: MercadoPagoOrder): MercadoPagoOrder {
  return {
    ...createdOrder,
    ...refreshedOrder,
    id: refreshedOrder.id || createdOrder.id,
    total_amount: refreshedOrder.total_amount ?? createdOrder.total_amount,
    external_reference: refreshedOrder.external_reference ?? createdOrder.external_reference,
    created_date: refreshedOrder.created_date ?? createdOrder.created_date,
    last_updated_date: refreshedOrder.last_updated_date ?? createdOrder.last_updated_date,
    transactions: refreshedOrder.transactions ?? createdOrder.transactions,
  };
}

export async function createMercadoPagoPixCharge(input: {
  amount: number;
  participantName: string;
  payerEmail: string;
  payerCpf: string;
  externalReference: string;
  idempotencyKey: string;
  expiresAt: string;
}) {
  const [firstName, ...lastNameParts] = input.participantName.trim().split(/\s+/);
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(input.externalReference)) {
    throw new MercadoPagoPixError("A referência externa do Pix é inválida.");
  }
  const amount = input.amount.toFixed(2);
  const testEnvironment = process.env.MERCADO_PAGO_ENV?.trim().toLowerCase() === "test";
  if (testEnvironment) await assertTestCredential();
  const payer = testEnvironment
    ? { email: "test_user_br@testuser.com", first_name: "APRO" }
    : {
      email: input.payerEmail,
      first_name: firstName,
      last_name: lastNameParts.join(" ") || firstName,
      identification: { type: "CPF", number: input.payerCpf.replace(/\D/g, "") },
    };
  const createdOrder = await mercadoPagoRequest<MercadoPagoOrder>("/v1/orders", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-idempotency-key": input.idempotencyKey,
    },
    body: JSON.stringify({
      type: "online",
      total_amount: amount,
      external_reference: input.externalReference,
      processing_mode: "automatic",
      transactions: {
        payments: [{
          amount,
          payment_method: { id: "pix", type: "bank_transfer" },
          expiration_time: orderExpirationDuration(input.expiresAt),
        }],
      },
      payer,
    }),
  });
  let order = createdOrder;
  if (!createdOrder.transactions?.payments?.[0]?.id && createdOrder.id) {
    try {
      const refreshedOrder = await mercadoPagoRequest<MercadoPagoOrder>(`/v1/orders/${createdOrder.id}`);
      order = mergeCreatedOrder(createdOrder, refreshedOrder);
    } catch {
      order = createdOrder;
    }
  }
  return paymentFromOrder(order, input.expiresAt);
}

export function getMercadoPagoPayment(providerPaymentId: string) {
  if (/^ORD[A-Z0-9]+$/i.test(providerPaymentId)) {
    return mercadoPagoRequest<MercadoPagoOrder>(`/v1/orders/${providerPaymentId}`)
      .then((order) => paymentFromOrder(order));
  }
  if (/^\d+$/.test(providerPaymentId)) {
    return mercadoPagoRequest<MercadoPagoPayment>(`/v1/payments/${providerPaymentId}`);
  }
  throw new MercadoPagoPixError("Identificador de pagamento inválido.");
}

export function mercadoPagoPaymentMetadata(payment: MercadoPagoPayment) {
  return {
    statusDetail: payment.status_detail ?? null,
    paymentMethodId: payment.payment_method_id ?? "pix",
    ...(payment.provider_order_id ? { providerOrderId: payment.provider_order_id } : {}),
    ...(payment.provider_transaction_id ? { providerTransactionId: payment.provider_transaction_id } : {}),
  };
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
