import "server-only";

import { createHash, createHmac, randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PublicCheckoutItem, PublicCheckoutStatus } from "../types/event.types";
import type { z } from "zod";
import type { publicRegistrationSchema } from "../validations/event.schemas";
import { ensureEventCredential } from "./event-credential.service";
import {
  createMercadoPagoPixCharge,
  getMercadoPagoPayment,
  normalizeMercadoPagoStatus,
  publicPixData,
  type MercadoPagoPayment,
} from "./mercado-pago-pix.service";

type PublicRegistrationInput = z.infer<typeof publicRegistrationSchema>;
type AnyRow = Record<string, unknown>;
const SIMULATED_PAYMENT_PREFIX = "MOCK-";

export class PublicCheckoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PublicCheckoutError";
  }
}

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function createCheckoutToken(eventId: string, idempotencyKey: string) {
  const secret = process.env.EVENT_CHECKOUT_SECRET?.trim();
  if (!secret || secret.length < 32) throw new PublicCheckoutError("O checkout público ainda não está configurado para este ambiente.");
  return createHmac("sha256", secret).update(`event-checkout:${eventId}:${idempotencyKey}`).digest("base64url");
}

function number(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isPaymentSimulationEnabled() {
  return process.env.EVENT_PAYMENT_MOCK_ENABLED?.trim().toLowerCase() === "true"
    && process.env.NODE_ENV !== "production";
}

function isSimulatedPaymentId(value: unknown) {
  return typeof value === "string" && /^MOCK-[0-9a-f-]{36}$/i.test(value);
}

function simulatedPixCode(paymentId: string, externalReference: string, amount: number) {
  const checksum = createHash("sha256")
    .update(`${paymentId}:${externalReference}:${amount.toFixed(2)}`)
    .digest("hex")
    .slice(0, 24)
    .toUpperCase();
  // O gerador interno usa QR Code versão 3 e aceita até 53 bytes.
  // O hash mantém o código de teste único sem expor o payload completo.
  return `PIXTESTE:${checksum}`;
}

function simulatedProviderPayment(payment: AnyRow, statusOverride?: "pending" | "approved" | "expired"): MercadoPagoPayment {
  const paymentId = String(payment.provider_payment_id);
  const expiresAt = payment.expires_at ? String(payment.expires_at) : null;
  const storedStatus = String(payment.payment_status ?? "PENDING");
  const providerStatus = statusOverride
    ?? (storedStatus === "CONFIRMED" ? "approved"
      : storedStatus === "FAILED" ? "rejected"
        : storedStatus === "CANCELLED" ? "cancelled"
          : "pending");
  const externalReference = String(payment.external_reference ?? "event-payment-test");
  const amount = number(payment.amount);
  const pixCode = simulatedPixCode(paymentId, externalReference, amount);
  return {
    id: paymentId,
    status: providerStatus,
    status_detail: "local_payment_simulation",
    transaction_amount: amount,
    external_reference: externalReference,
    date_created: payment.created_at ? String(payment.created_at) : undefined,
    date_approved: providerStatus === "approved" ? (payment.paid_at ? String(payment.paid_at) : new Date().toISOString()) : null,
    date_of_expiration: expiresAt,
    payment_method_id: "pix",
    point_of_interaction: {
      transaction_data: {
        qr_code: pixCode,
      },
    },
  };
}

function checkoutPixData(payment: MercadoPagoPayment, isSimulated: boolean) {
  return { ...publicPixData(payment), isSimulated };
}

function validCheckoutToken(token: string) {
  return /^[A-Za-z0-9_-]{40,120}$/.test(token);
}

async function checkoutRows(checkoutToken: string, publicCode: string, slug: string) {
  if (!validCheckoutToken(checkoutToken)) throw new PublicCheckoutError("Sessão de inscrição inválida.");
  const admin = createAdminClient();
  const checkoutResult = await admin.from("event_public_checkouts")
    .select("id,event_id,registration_id,status,payment_method,expires_at")
    .eq("access_token_hash", tokenHash(checkoutToken)).maybeSingle();
  if (checkoutResult.error || !checkoutResult.data) throw new PublicCheckoutError("Sessão de inscrição não encontrada.");
  const [eventResult, registrationResult, itemResult, paymentResult] = await Promise.all([
    admin.from("events").select("id,name,public_code,slug,starts_at,location_name,city,state").eq("id", checkoutResult.data.event_id).eq("public_code", publicCode).eq("slug", slug).eq("visibility", "PUBLIC").is("deleted_at", null).maybeSingle(),
    admin.from("event_registrations").select("id,registration_number,participant_name,congregation_id,status,payment_status,total_amount,registered_at,confirmed_at,credential_version,congregations!event_registrations_congregation_tenant_fkey(name)").eq("id", checkoutResult.data.registration_id).is("deleted_at", null).maybeSingle(),
    admin.from("event_registration_items").select("event_item_id,item_name,quantity,unit_price,total_price").eq("event_registration_id", checkoutResult.data.registration_id).is("deleted_at", null).order("created_at"),
    admin.from("event_payments").select("id,provider_payment_id,provider_status,payment_status,amount,external_reference,expires_at,created_at,paid_at").eq("event_registration_id", checkoutResult.data.registration_id).eq("provider", "MERCADO_PAGO").is("deleted_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (eventResult.error || !eventResult.data || registrationResult.error || !registrationResult.data) {
    throw new PublicCheckoutError("Esta inscrição não está mais disponível.");
  }
  return {
    admin,
    checkout: checkoutResult.data as AnyRow,
    event: eventResult.data as AnyRow,
    registration: registrationResult.data as AnyRow,
    items: (itemResult.data ?? []) as AnyRow[],
    payment: (paymentResult.data ?? null) as AnyRow | null,
  };
}

async function applyProviderPayment(payment: MercadoPagoPayment, extraMetadata: Record<string, unknown> = {}) {
  const admin = createAdminClient();
  const local = await admin.from("event_payments")
    .select("id,amount,external_reference,payment_status")
    .eq("provider", "MERCADO_PAGO").eq("provider_payment_id", String(payment.id)).maybeSingle();
  if (local.error || !local.data) throw new PublicCheckoutError("Pagamento não vinculado a uma inscrição.");
  if (Math.abs(number(local.data.amount) - number(payment.transaction_amount)) > 0.009
    || local.data.external_reference !== payment.external_reference) {
    throw new PublicCheckoutError("O pagamento recebido não corresponde a esta inscrição.");
  }
  const normalized = normalizeMercadoPagoStatus(payment.status, payment.date_of_expiration);
  const result = await admin.rpc("apply_event_provider_payment", {
    p_provider_payment_id: String(payment.id),
    p_provider_status: payment.status,
    p_normalized_status: normalized,
    p_paid_at: payment.date_approved ?? null,
    p_metadata: { statusDetail: payment.status_detail ?? null, paymentMethodId: payment.payment_method_id ?? "pix", ...extraMetadata },
  });
  if (result.error) throw new PublicCheckoutError("Não foi possível atualizar a situação do pagamento.");
  return normalized;
}

export async function startPublicCheckout(
  publicCode: string,
  slug: string,
  input: PublicRegistrationInput,
  idempotencyKey: string,
) {
  const admin = createAdminClient();
  const eventResult = await admin.from("events").select("id").eq("id", input.eventId).eq("public_code", publicCode).eq("slug", slug).eq("visibility", "PUBLIC").is("deleted_at", null).maybeSingle();
  if (eventResult.error || !eventResult.data) throw new PublicCheckoutError("Evento público indisponível.");
  const checkoutToken = createCheckoutToken(input.eventId, idempotencyKey);
  const result = await admin.rpc("start_event_public_checkout", {
    p_event_id: input.eventId,
    p_payload: { ...input, registrationSource: "PUBLIC", consentAccepted: true },
    p_idempotency_key: idempotencyKey,
    p_access_token_hash: tokenHash(checkoutToken),
  });
  if (result.error) {
    const message = result.error.message;
    if (message.includes("EVENT_CAPACITY_FULL")) throw new PublicCheckoutError("Não há vagas disponíveis.");
    if (message.includes("EVENT_ITEM_STOCK_EXCEEDED")) throw new PublicCheckoutError("Um dos itens selecionados está esgotado.");
    if (message.includes("EVENT_REGISTRATION_CLOSED")) throw new PublicCheckoutError("As inscrições deste evento estão encerradas.");
    throw new PublicCheckoutError("Não foi possível iniciar a inscrição.");
  }
  return { checkoutToken, checkout: result.data as AnyRow };
}

export async function createPublicPixPayment(input: {
  publicCode: string;
  slug: string;
  checkoutToken: string;
  payerEmail: string;
  payerCpf: string;
  idempotencyKey: string;
}) {
  const rows = await checkoutRows(input.checkoutToken, input.publicCode, input.slug);
  if (rows.checkout.payment_method !== "PIX" || number(rows.registration.total_amount) <= 0) {
    throw new PublicCheckoutError("Esta inscrição não utiliza pagamento por Pix.");
  }
  if (rows.registration.status === "CONFIRMED") return getPublicCheckoutStatus(input.publicCode, input.slug, input.checkoutToken, true);

  if (rows.payment?.provider_payment_id && rows.payment.payment_status === "PENDING") {
    const simulated = isSimulatedPaymentId(rows.payment.provider_payment_id);
    if (simulated && !isPaymentSimulationEnabled()) {
      throw new PublicCheckoutError("Esta sessão usa um pagamento de teste, mas a simulação está desativada.");
    }
    const existing = simulated
      ? simulatedProviderPayment(rows.payment)
      : await getMercadoPagoPayment(String(rows.payment.provider_payment_id));
    const normalized = simulated ? "PENDING" : await applyProviderPayment(existing);
    if (normalized !== "EXPIRED" && normalized !== "FAILED" && normalized !== "CANCELLED") {
      return {
        checkout: await getPublicCheckoutStatus(input.publicCode, input.slug, input.checkoutToken, false, existing),
        pix: checkoutPixData(existing, simulated),
      };
    }
  }

  const expirationMinutes = Math.min(Math.max(Number(process.env.MERCADO_PAGO_PIX_EXPIRATION_MINUTES ?? 30), 10), 60);
  const expiresAt = new Date(Date.now() + expirationMinutes * 60_000).toISOString();
  const externalReference = `event:${rows.event.id}:registration:${rows.registration.id}`;
  const simulationEnabled = isPaymentSimulationEnabled();
  const payment = simulationEnabled
    ? simulatedProviderPayment({
      provider_payment_id: `${SIMULATED_PAYMENT_PREFIX}${randomUUID()}`,
      provider_status: "pending",
      payment_status: "PENDING",
      amount: number(rows.registration.total_amount),
      external_reference: externalReference,
      expires_at: expiresAt,
      created_at: new Date().toISOString(),
    })
    : await createMercadoPagoPixCharge({
      amount: number(rows.registration.total_amount),
      participantName: String(rows.registration.participant_name),
      payerEmail: input.payerEmail,
      payerCpf: input.payerCpf,
      eventName: String(rows.event.name),
      externalReference,
      idempotencyKey: input.idempotencyKey,
      expiresAt,
    });
  const providerExpiration = payment.date_of_expiration ?? expiresAt;
  const attached = await rows.admin.rpc("attach_event_pix_payment", {
    p_checkout_id: rows.checkout.id,
    p_provider_payment_id: String(payment.id),
    p_provider_status: payment.status,
    p_amount: number(payment.transaction_amount),
    p_expires_at: providerExpiration,
    p_external_reference: externalReference,
    p_idempotency_key: input.idempotencyKey,
  });
  if (attached.error) throw new PublicCheckoutError("O Pix foi criado, mas não foi possível vinculá-lo. Tente novamente.");
  await rows.admin.from("event_registrations").update({ participant_email: input.payerEmail }).eq("id", rows.registration.id);
  if (!simulationEnabled) await applyProviderPayment(payment);
  return {
    checkout: await getPublicCheckoutStatus(input.publicCode, input.slug, input.checkoutToken, false, payment),
    pix: checkoutPixData(payment, simulationEnabled),
  };
}

export async function approveSimulatedPublicPixPayment(input: {
  publicCode: string;
  slug: string;
  checkoutToken: string;
}) {
  if (!isPaymentSimulationEnabled()) {
    throw new PublicCheckoutError("A aprovação de pagamento de teste não está disponível neste ambiente.");
  }
  const rows = await checkoutRows(input.checkoutToken, input.publicCode, input.slug);
  if (rows.registration.status === "CONFIRMED") {
    return getPublicCheckoutStatus(input.publicCode, input.slug, input.checkoutToken, false);
  }
  if (rows.checkout.payment_method !== "PIX" || !rows.payment?.provider_payment_id || !isSimulatedPaymentId(rows.payment.provider_payment_id)) {
    throw new PublicCheckoutError("Gere um Pix de teste antes de seguir.");
  }
  if (rows.payment.payment_status !== "PENDING") {
    throw new PublicCheckoutError("Este pagamento de teste não está mais pendente.");
  }
  if (rows.payment.expires_at && Date.parse(String(rows.payment.expires_at)) <= Date.now()) {
    throw new PublicCheckoutError("O Pix de teste expirou. Gere um novo código para continuar.");
  }
  await applyProviderPayment(simulatedProviderPayment(rows.payment, "approved"), {
    simulated: true,
    simulationSource: "LOCAL_PUBLIC_CHECKOUT",
    approvedByTestAction: true,
  });
  const checkout = await getPublicCheckoutStatus(input.publicCode, input.slug, input.checkoutToken, false);
  if (checkout.registrationStatus !== "CONFIRMED") {
    throw new PublicCheckoutError("Não foi possível concluir o pagamento de teste.");
  }
  return checkout;
}

export async function getPublicCheckoutStatus(
  publicCode: string,
  slug: string,
  checkoutToken: string,
  refreshProvider = false,
  knownPayment?: MercadoPagoPayment,
): Promise<PublicCheckoutStatus> {
  let rows = await checkoutRows(checkoutToken, publicCode, slug);
  let providerPayment = knownPayment;
  const simulatedPayment = isSimulatedPaymentId(rows.payment?.provider_payment_id);
  if (simulatedPayment && rows.payment) {
    providerPayment = simulatedProviderPayment(rows.payment);
    if (refreshProvider && rows.payment.payment_status === "PENDING" && rows.payment.expires_at && Date.parse(String(rows.payment.expires_at)) <= Date.now()) {
      await applyProviderPayment(simulatedProviderPayment(rows.payment, "expired"), { simulated: true, simulationSource: "LOCAL_PUBLIC_CHECKOUT" });
      rows = await checkoutRows(checkoutToken, publicCode, slug);
      providerPayment = rows.payment ? simulatedProviderPayment(rows.payment) : undefined;
    }
  } else if (rows.payment?.provider_payment_id && (refreshProvider || knownPayment)) {
    providerPayment = knownPayment ?? await getMercadoPagoPayment(String(rows.payment.provider_payment_id));
    await applyProviderPayment(providerPayment);
    rows = await checkoutRows(checkoutToken, publicCode, slug);
  }
  if (rows.registration.status === "CONFIRMED" && rows.checkout.status !== "COMPLETED") {
    await rows.admin.from("event_public_checkouts").update({ status: "COMPLETED", completed_at: rows.registration.confirmed_at ?? new Date().toISOString(), expires_at: null, updated_at: new Date().toISOString() }).eq("id", rows.checkout.id);
    rows.checkout.status = "COMPLETED";
  }
  const credentialToken = await ensureEventCredential({
    id: String(rows.registration.id),
    credentialVersion: number(rows.registration.credential_version),
    status: String(rows.registration.status),
  });
  const eventLocation = [rows.event.location_name, rows.event.city, rows.event.state].filter(Boolean).join(" · ") || null;
  const congregationRelation = rows.registration.congregations as AnyRow | AnyRow[] | null | undefined;
  const congregation = Array.isArray(congregationRelation) ? congregationRelation[0] : congregationRelation;
  const items: PublicCheckoutItem[] = rows.items.map((item) => ({
    id: String(item.event_item_id),
    name: String(item.item_name),
    quantity: number(item.quantity),
    unitPrice: number(item.unit_price),
    totalPrice: number(item.total_price) || number(item.unit_price) * number(item.quantity),
  }));
  return {
    checkoutId: String(rows.checkout.id),
    eventId: String(rows.event.id),
    eventName: String(rows.event.name),
    eventStartsAt: String(rows.event.starts_at),
    eventLocation,
    registrationId: String(rows.registration.id),
    registrationNumber: String(rows.registration.registration_number),
    participantName: String(rows.registration.participant_name),
    congregationName: congregation?.name ? String(congregation.name) : null,
    registeredAt: String(rows.registration.registered_at),
    confirmedAt: rows.registration.confirmed_at ? String(rows.registration.confirmed_at) : null,
    registrationStatus: String(rows.registration.status),
    paymentStatus: String(rows.registration.payment_status),
    paymentMethod: String(rows.checkout.payment_method) as PublicCheckoutStatus["paymentMethod"],
    checkoutStatus: String(rows.checkout.status),
    totalAmount: number(rows.registration.total_amount),
    items,
    expiresAt: providerPayment?.date_of_expiration ?? (rows.payment?.expires_at ? String(rows.payment.expires_at) : rows.checkout.expires_at ? String(rows.checkout.expires_at) : null),
    credentialToken,
    providerPaymentId: rows.payment?.provider_payment_id ? String(rows.payment.provider_payment_id) : null,
    providerStatus: providerPayment?.status ?? (rows.payment?.provider_status ? String(rows.payment.provider_status) : null),
    paymentSimulationEnabled: isPaymentSimulationEnabled(),
    isSimulatedPayment: simulatedPayment,
    pix: providerPayment ? {
      qrCode: providerPayment.point_of_interaction?.transaction_data?.qr_code ?? null,
      qrCodeBase64: providerPayment.point_of_interaction?.transaction_data?.qr_code_base64 ?? null,
      ticketUrl: providerPayment.point_of_interaction?.transaction_data?.ticket_url ?? null,
      isSimulated: simulatedPayment,
    } : null,
  };
}

export async function reconcileMercadoPagoPayment(providerPaymentId: string) {
  const payment = await getMercadoPagoPayment(providerPaymentId);
  return applyProviderPayment(payment);
}

export async function registerMercadoPagoWebhookEvent(input: { eventId: string; paymentId: string }) {
  const admin = createAdminClient();
  const existing = await admin.from("event_payment_webhook_events").select("id,processing_status").eq("provider", "MERCADO_PAGO").eq("provider_event_id", input.eventId).maybeSingle();
  if (existing.data?.processing_status === "PROCESSED") return false;
  if (!existing.data) {
    const inserted = await admin.from("event_payment_webhook_events").insert({ provider: "MERCADO_PAGO", provider_event_id: input.eventId, provider_payment_id: input.paymentId, payload: { topic: "payment" } });
    if (inserted.error && inserted.error.code !== "23505") throw new PublicCheckoutError("Não foi possível registrar a notificação.");
  }
  return true;
}

export async function finishMercadoPagoWebhookEvent(eventId: string, status: "PROCESSED" | "IGNORED" | "FAILED") {
  const admin = createAdminClient();
  await admin.from("event_payment_webhook_events").update({ processing_status: status, processed_at: new Date().toISOString() }).eq("provider", "MERCADO_PAGO").eq("provider_event_id", eventId);
}

export async function cleanupExpiredPublicEventCheckouts() {
  const admin = createAdminClient();
  const expired = await admin.from("event_public_checkouts").select("id,registration_id").in("status", ["AWAITING_PAYMENT", "PROCESSING"]).lt("expires_at", new Date().toISOString()).limit(100);
  if (expired.error) throw new PublicCheckoutError("Não foi possível localizar checkouts expirados.");
  let reconciled = 0;
  for (const checkout of expired.data ?? []) {
    const payment = await admin.from("event_payments").select("provider_payment_id").eq("event_registration_id", checkout.registration_id).eq("provider", "MERCADO_PAGO").is("deleted_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!payment.data?.provider_payment_id) continue;
    if (isSimulatedPaymentId(payment.data.provider_payment_id)) {
      await admin.rpc("apply_event_provider_payment", {
        p_provider_payment_id: String(payment.data.provider_payment_id),
        p_provider_status: "expired",
        p_normalized_status: "EXPIRED",
        p_paid_at: null,
        p_metadata: { simulated: true, simulationSource: "CHECKOUT_CLEANUP" },
      });
      reconciled += 1;
      continue;
    }
    const remote = await getMercadoPagoPayment(String(payment.data.provider_payment_id));
    await applyProviderPayment({ ...remote, date_of_expiration: remote.date_of_expiration ?? new Date(0).toISOString() });
    reconciled += 1;
  }
  return { examined: expired.data?.length ?? 0, reconciled };
}
