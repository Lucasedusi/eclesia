import "server-only";

import { Buffer } from "node:buffer";
import { createHash, createHmac, randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PublicCaravanTrackingStatus, PublicCheckoutItem, PublicCheckoutStatus, PublicTrackingStatus } from "../types/event.types";
import type { z } from "zod";
import { resolveEventRoleSnapshot } from "./event.service";
import type { publicRegistrationSchema, publicStaticPixReceiptSchema, publicStaticPixReceiptUploadSchema } from "../validations/event.schemas";
import { ensureEventCredential } from "./event-credential.service";
import {
  createMercadoPagoPixCharge,
  getMercadoPagoPayment,
  mercadoPagoPaymentMetadata,
  normalizeMercadoPagoStatus,
  publicPixData,
  type MercadoPagoPayment,
} from "./mercado-pago-pix.service";
import { createMercadoPagoPixExternalReference, createMercadoPagoPixIdempotencyKey, resolveMercadoPagoPixExpirationMinutes } from "../utils/mercado-pago-pix";
import { buildPublicRegistrationPayload, resolvePublicMemberId } from "./public-member-link";
import { readCheckoutPaymentSnapshot } from "../utils/checkout-payment-snapshot";
import { isStaticPixReceiptPath, safeStaticPixReceiptName } from "../utils/static-pix-receipt";

type PublicRegistrationInput = z.infer<typeof publicRegistrationSchema>;
type PublicStaticPixReceiptInput = z.infer<typeof publicStaticPixReceiptSchema>;
type PublicStaticPixReceiptUploadInput = z.infer<typeof publicStaticPixReceiptUploadSchema>;
type AnyRow = Record<string, unknown>;
const SIMULATED_PAYMENT_PREFIX = "MOCK-";

export class PublicCheckoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PublicCheckoutError";
  }
}

export async function hasPublicCheckoutReplay(eventId: string, churchId: string, idempotencyKey: string) {
  const admin = createAdminClient();
  const result = await admin.from("event_public_checkouts")
    .select("id")
    .eq("event_id", eventId)
    .eq("church_id", churchId)
    .eq("idempotency_key", idempotencyKey)
    .eq("checkout_type", "INDIVIDUAL")
    .maybeSingle();
  if (result.error) throw new PublicCheckoutError("Não foi possível consultar a inscrição.");
  return Boolean(result.data);
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

function validStaticPixReceiptContent(buffer: Buffer, mimeType: string) {
  if (mimeType === "application/pdf") return buffer.subarray(0, 5).toString("ascii") === "%PDF-";
  if (mimeType === "image/jpeg") return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mimeType === "image/png") return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mimeType === "image/webp") return buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  return false;
}

async function checkoutRows(checkoutToken: string, publicCode: string, slug: string) {
  if (!validCheckoutToken(checkoutToken)) throw new PublicCheckoutError("Sessão de inscrição inválida.");
  const admin = createAdminClient();
  const checkoutResult = await admin.from("event_public_checkouts")
    .select("id,event_id,registration_id,status,payment_method,payment_flow,expires_at,draft_payload")
    .eq("access_token_hash", tokenHash(checkoutToken)).maybeSingle();
  if (checkoutResult.error || !checkoutResult.data) throw new PublicCheckoutError("Sessão de inscrição não encontrada.");
  const [eventResult, registrationResult, itemResult, paymentResult, staticReceiptResult] = await Promise.all([
    admin.from("events").select("id,church_id,name,public_code,slug,starts_at,location_name,city,state").eq("id", checkoutResult.data.event_id).eq("public_code", publicCode).eq("slug", slug).eq("visibility", "PUBLIC").is("deleted_at", null).maybeSingle(),
    admin.from("event_registrations").select("id,registration_number,participant_name,congregation_id,status,payment_status,total_amount,registered_at,confirmed_at,credential_version,congregations!event_registrations_congregation_tenant_fkey(name,regions(name))").eq("id", checkoutResult.data.registration_id).is("deleted_at", null).maybeSingle(),
    admin.from("event_registration_items").select("event_item_id,item_name,quantity,unit_price,total_price").eq("event_registration_id", checkoutResult.data.registration_id).is("deleted_at", null).order("created_at"),
    admin.from("event_payments").select("id,provider,provider_payment_id,provider_status,payment_status,amount,external_reference,expires_at,created_at,paid_at,receipt_storage_path").eq("event_registration_id", checkoutResult.data.registration_id).is("deleted_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    admin.from("event_payments").select("receipt_storage_path").eq("event_registration_id", checkoutResult.data.registration_id).eq("payment_method", "PIX").eq("payment_channel", "INTERNAL_MANUAL").contains("metadata", { paymentFlow: "STATIC_PIX" }).is("deleted_at", null).order("created_at", { ascending: true }).limit(1).maybeSingle(),
  ]);
  if (eventResult.error || !eventResult.data || registrationResult.error || !registrationResult.data
    || itemResult.error || paymentResult.error || staticReceiptResult.error) {
    throw new PublicCheckoutError("Esta inscrição não está mais disponível.");
  }
  return {
    admin,
    checkout: checkoutResult.data as AnyRow,
    event: eventResult.data as AnyRow,
    registration: registrationResult.data as AnyRow,
    items: (itemResult.data ?? []) as AnyRow[],
    payment: (paymentResult.data ?? null) as AnyRow | null,
    staticReceipt: (staticReceiptResult.data ?? null) as AnyRow | null,
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
    p_metadata: { ...mercadoPagoPaymentMetadata(payment), ...extraMetadata },
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
  const eventResult = await admin.from("events").select("id,church_id").eq("id", input.eventId).eq("public_code", publicCode).eq("slug", slug).eq("visibility", "PUBLIC").is("deleted_at", null).maybeSingle();
  if (eventResult.error || !eventResult.data) throw new PublicCheckoutError("Evento público indisponível.");
  const eventRow = eventResult.data;
  const checkoutToken = createCheckoutToken(input.eventId, idempotencyKey);
  const replayResult = await admin.from("event_public_checkouts")
    .select("id")
    .eq("event_id", input.eventId)
    .eq("church_id", eventRow.church_id)
    .eq("idempotency_key", idempotencyKey)
    .eq("checkout_type", "INDIVIDUAL")
    .maybeSingle();
  if (replayResult.error) throw new PublicCheckoutError("Não foi possível iniciar a inscrição.");
  if (replayResult.data) {
    return {
      checkoutToken,
      checkout: await getPublicCheckoutStatus(publicCode, slug, checkoutToken, false),
    };
  }
  const memberId = await resolvePublicMemberId(input, async (cpf, birthDate) => {
    const identityResult = await admin.from("member_sensitive_identity")
      .select("member_id")
      .eq("church_id", eventRow.church_id)
      .eq("cpf", cpf)
      .is("deleted_at", null)
      .maybeSingle();
    if (identityResult.error || !identityResult.data) return null;
    const memberResult = await admin.from("members")
      .select("id")
      .eq("id", identityResult.data.member_id)
      .eq("church_id", eventRow.church_id)
      .eq("birth_date", birthDate)
      .eq("member_status", "ACTIVE")
      .is("deleted_at", null)
      .maybeSingle();
    if (memberResult.error || !memberResult.data) return null;
    return memberResult.data.id;
  });
  if (input.participantKind === "MEMBER" && !memberId) {
    throw new PublicCheckoutError("Não foi possível confirmar seu cadastro de membro. Revise o CPF e a data de nascimento ou inscreva-se como visitante.");
  }
  const role = await resolveEventRoleSnapshot(String(eventRow.church_id), input.participantRoleId, input.participantGender);
  const result = await admin.rpc("start_event_public_checkout", {
    p_event_id: input.eventId,
    p_payload: buildPublicRegistrationPayload({
      ...input,
      metadata: role ? { participantRoleId: role.id, participantRoleName: role.name } : {},
    }, memberId),
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
  const checkout = await getPublicCheckoutStatus(publicCode, slug, checkoutToken, false);
  return { checkoutToken, checkout };
}

export async function createPublicPixPayment(input: {
  publicCode: string;
  slug: string;
  checkoutToken: string;
  payerEmail: string;
  payerCpf: string;
}) {
  const rows = await checkoutRows(input.checkoutToken, input.publicCode, input.slug);
  if (rows.checkout.payment_method !== "PIX" || rows.checkout.payment_flow !== "AUTOMATIC_PIX" || number(rows.registration.total_amount) <= 0) {
    throw new PublicCheckoutError("Esta inscrição não utiliza Pix automático.");
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

  const expirationMinutes = resolveMercadoPagoPixExpirationMinutes(process.env.MERCADO_PAGO_PIX_EXPIRATION_MINUTES);
  const expiresAt = new Date(Date.now() + expirationMinutes * 60_000).toISOString();
  const externalReference = createMercadoPagoPixExternalReference(String(rows.registration.id));
  const checkoutSecret = process.env.EVENT_CHECKOUT_SECRET?.trim();
  if (!checkoutSecret || checkoutSecret.length < 32) {
    throw new PublicCheckoutError("O checkout público ainda não está configurado para este ambiente.");
  }
  const paymentIdempotencyKey = createMercadoPagoPixIdempotencyKey(
    checkoutSecret,
    String(rows.checkout.id),
    rows.payment?.provider_payment_id ? String(rows.payment.provider_payment_id) : null,
  );
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
      externalReference,
      idempotencyKey: paymentIdempotencyKey,
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
    p_idempotency_key: paymentIdempotencyKey,
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
  if (rows.checkout.payment_method !== "PIX" || rows.checkout.payment_flow !== "AUTOMATIC_PIX" || !rows.payment?.provider_payment_id || !isSimulatedPaymentId(rows.payment.provider_payment_id)) {
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
  const regionRelation = congregation?.regions as AnyRow | AnyRow[] | null | undefined;
  const region = Array.isArray(regionRelation) ? regionRelation[0] : regionRelation;
  const items: PublicCheckoutItem[] = rows.items.map((item) => ({
    id: String(item.event_item_id),
    name: String(item.item_name),
    quantity: number(item.quantity),
    unitPrice: number(item.unit_price),
    totalPrice: number(item.total_price) || number(item.unit_price) * number(item.quantity),
  }));
  const paymentSnapshot = readCheckoutPaymentSnapshot(rows.checkout.draft_payload);
  const staticPix = paymentSnapshot.staticPix ? {
    key: paymentSnapshot.staticPix.key,
    holderName: paymentSnapshot.staticPix.holderName,
    qrUrl: paymentSnapshot.staticPix.qrStorageBucket === "event-public-media"
      && paymentSnapshot.staticPix.qrStoragePath?.startsWith(`${String(rows.event.church_id)}/events/${String(rows.event.id)}/individual-pix/`)
      ? rows.admin.storage.from("event-public-media").getPublicUrl(paymentSnapshot.staticPix.qrStoragePath).data.publicUrl
      : null,
    paymentInstructions: paymentSnapshot.staticPix.paymentInstructions,
  } : null;
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
    regionName: region?.name ? String(region.name) : null,
    registeredAt: String(rows.registration.registered_at),
    confirmedAt: rows.registration.confirmed_at ? String(rows.registration.confirmed_at) : null,
    registrationStatus: String(rows.registration.status),
    paymentStatus: String(rows.registration.payment_status),
    paymentMethod: String(rows.checkout.payment_method) as PublicCheckoutStatus["paymentMethod"],
    paymentFlow: String(rows.checkout.payment_flow) as PublicCheckoutStatus["paymentFlow"],
    checkoutStatus: String(rows.checkout.status),
    totalAmount: number(rows.registration.total_amount),
    items,
    expiresAt: providerPayment?.date_of_expiration ?? (rows.payment?.expires_at ? String(rows.payment.expires_at) : rows.checkout.expires_at ? String(rows.checkout.expires_at) : null),
    credentialToken,
    providerPaymentId: rows.payment?.provider_payment_id ? String(rows.payment.provider_payment_id) : null,
    providerStatus: providerPayment?.status ?? (rows.payment?.provider_status ? String(rows.payment.provider_status) : null),
    paymentSimulationEnabled: isPaymentSimulationEnabled(),
    isSimulatedPayment: simulatedPayment,
    receiptSubmitted: rows.checkout.payment_flow === "STATIC_PIX" && Boolean(rows.staticReceipt?.receipt_storage_path),
    staticPix,
    manualPayment: paymentSnapshot.manualPayment,
    pix: providerPayment ? {
      qrCode: providerPayment.point_of_interaction?.transaction_data?.qr_code ?? null,
      qrCodeBase64: providerPayment.point_of_interaction?.transaction_data?.qr_code_base64 ?? null,
      ticketUrl: providerPayment.point_of_interaction?.transaction_data?.ticket_url ?? null,
      isSimulated: simulatedPayment,
    } : null,
  };
}

export async function preparePublicStaticPixReceiptUpload(input: {
  publicCode: string;
  slug: string;
} & PublicStaticPixReceiptUploadInput) {
  const rows = await checkoutRows(input.checkoutToken, input.publicCode, input.slug);
  if (rows.checkout.payment_method !== "PIX" || rows.checkout.payment_flow !== "STATIC_PIX" || rows.checkout.status !== "AWAITING_PAYMENT") {
    throw new PublicCheckoutError("Esta inscrição não utiliza Pix estático.");
  }
  if (rows.registration.status !== "PENDING" || rows.registration.payment_status !== "PENDING") {
    throw new PublicCheckoutError("Esta inscrição não aceita mais comprovantes.");
  }
  const safeName = safeStaticPixReceiptName(input.fileName);
  const path = `${String(rows.event.church_id)}/events/${String(rows.event.id)}/public-individuals/${String(rows.checkout.id)}/static-pix/${randomUUID()}/${safeName}`;
  const signed = await rows.admin.storage.from("event-documents").createSignedUploadUrl(path);
  if (signed.error) throw new PublicCheckoutError("Não foi possível preparar o comprovante.");
  return { path, token: signed.data.token };
}

export async function submitPublicStaticPixReceipt(input: {
  publicCode: string;
  slug: string;
  idempotencyKey: string;
} & PublicStaticPixReceiptInput) {
  const rows = await checkoutRows(input.checkoutToken, input.publicCode, input.slug);
  if (rows.checkout.payment_method !== "PIX" || rows.checkout.payment_flow !== "STATIC_PIX" || rows.checkout.status !== "AWAITING_PAYMENT") {
    throw new PublicCheckoutError("Esta inscrição não utiliza Pix estático.");
  }
  const expectedPrefix = `${String(rows.event.church_id)}/events/${String(rows.event.id)}/public-individuals/${String(rows.checkout.id)}/static-pix/`;
  if (!isStaticPixReceiptPath(input.receiptPath, expectedPrefix)) throw new PublicCheckoutError("O comprovante não pertence a esta inscrição.");

  const downloaded = await rows.admin.storage.from("event-documents").download(input.receiptPath);
  if (downloaded.error || !downloaded.data) throw new PublicCheckoutError("Não foi possível validar o comprovante enviado.");
  const buffer = Buffer.from(await downloaded.data.arrayBuffer());
  if (buffer.length !== input.receiptFileSize || buffer.length > 10 * 1024 * 1024 || !validStaticPixReceiptContent(buffer, input.receiptMimeType)) {
    throw new PublicCheckoutError("O conteúdo do comprovante não corresponde ao formato informado.");
  }

  const result = await rows.admin.rpc("submit_event_public_static_pix_receipt", {
    p_event_id: rows.event.id,
    p_checkout_id: rows.checkout.id,
    p_payload: {
      receiptPath: input.receiptPath,
      receiptFileName: input.receiptFileName,
      receiptMimeType: input.receiptMimeType,
      receiptFileSize: input.receiptFileSize,
    },
    p_idempotency_key: input.idempotencyKey,
  });
  if (result.error) throw new PublicCheckoutError("Não foi possível registrar o comprovante.");
  return getPublicCheckoutStatus(input.publicCode, input.slug, input.checkoutToken, false);
}

export async function getPublicTrackingStatus(
  publicCode: string,
  slug: string,
  token: string,
  refreshProvider = false,
): Promise<PublicTrackingStatus> {
  if (!validCheckoutToken(token)) throw new PublicCheckoutError("Link de acompanhamento inválido.");
  const admin = createAdminClient();
  const checkout = await admin.from("event_public_checkouts")
    .select("id,event_id,registration_id,group_id,checkout_type,status,payment_method")
    .eq("access_token_hash", tokenHash(token)).maybeSingle();
  if (checkout.error || !checkout.data) throw new PublicCheckoutError("Inscrição não encontrada.");

  const event = await admin.from("events").select("id,name,starts_at,location_name,city,state")
    .eq("id", checkout.data.event_id).eq("public_code", publicCode).eq("slug", slug)
    .eq("visibility", "PUBLIC").is("deleted_at", null).maybeSingle();
  if (event.error || !event.data) throw new PublicCheckoutError("Inscrição não encontrada.");

  if (checkout.data.checkout_type !== "CARAVAN") {
    const data = await getPublicCheckoutStatus(publicCode, slug, token, refreshProvider);
    return { kind: "INDIVIDUAL", status: data.registrationStatus, data };
  }
  if (!checkout.data.group_id) throw new PublicCheckoutError("A caravana ainda não foi concluída.");

  const [group, itemResult] = await Promise.all([
    admin.from("event_groups")
      .select("id,group_number,origin_church_name,origin_city,origin_state,responsible_name,responsible_phone,pastor_name,total_registrations,male_count,female_count,status,payment_status,total_amount,paid_amount,created_at,updated_at")
      .eq("id", checkout.data.group_id).eq("event_id", checkout.data.event_id).is("deleted_at", null).maybeSingle(),
    admin.from("event_registration_items").select("event_item_id,item_name,quantity,unit_price,total_price")
      .eq("event_group_id", checkout.data.group_id).is("deleted_at", null).order("created_at"),
  ]);
  if (group.error || !group.data) throw new PublicCheckoutError("Esta caravana não está mais disponível.");
  const groupStatus = String(group.data.status);
  const paymentStatus = String(group.data.payment_status);
  const status = ["CANCELLED", "EXPIRED", "FAILED"].includes(groupStatus)
    ? groupStatus
    : ["PAID", "NOT_REQUIRED"].includes(paymentStatus) ? "CONFIRMED" : "PENDING";
  const eventLocation = [event.data.location_name, event.data.city, event.data.state].filter(Boolean).join(" · ") || null;
  const totalAmount = number(group.data.total_amount);
  const paidAmount = number(group.data.paid_amount);
  const data: PublicCaravanTrackingStatus = {
    eventId: String(event.data.id), eventName: String(event.data.name), eventStartsAt: String(event.data.starts_at), eventLocation,
    groupId: String(group.data.id), groupNumber: String(group.data.group_number), originChurchName: String(group.data.origin_church_name),
    originCity: String(group.data.origin_city), originState: String(group.data.origin_state), responsibleName: String(group.data.responsible_name),
    responsiblePhone: String(group.data.responsible_phone), pastorName: String(group.data.pastor_name), totalRegistrations: number(group.data.total_registrations),
    maleCount: number(group.data.male_count), femaleCount: number(group.data.female_count), registrationStatus: groupStatus, paymentStatus,
    paymentMethod: String(checkout.data.payment_method) as PublicCaravanTrackingStatus["paymentMethod"], totalAmount, paidAmount,
    remainingAmount: Math.max(totalAmount - paidAmount, 0), registeredAt: String(group.data.created_at), updatedAt: String(group.data.updated_at),
    items: ((itemResult.data ?? []) as AnyRow[]).map((item) => ({
      id: String(item.event_item_id), name: String(item.item_name), quantity: number(item.quantity),
      unitPrice: number(item.unit_price), totalPrice: number(item.total_price) || number(item.unit_price) * number(item.quantity),
    })),
  };
  return { kind: "CARAVAN", status, data };
}

export async function reconcileMercadoPagoOrder(orderId: string) {
  const payment = await getMercadoPagoPayment(orderId);
  return applyProviderPayment(payment);
}

export async function cleanupExpiredPublicEventCheckouts() {
  const admin = createAdminClient();
  const now=new Date().toISOString();
  const drafts=await admin.from("event_public_checkouts").select("id").eq("checkout_type","CARAVAN").eq("status","DRAFT").lt("expires_at",now).limit(100);
  if(drafts.error)throw new PublicCheckoutError("Não foi possível localizar checkouts de caravana expirados.");
  const draftIds=(drafts.data??[]).map((checkout)=>checkout.id);
  if(draftIds.length){const expiredDrafts=await admin.from("event_public_checkouts").update({status:"EXPIRED",draft_payload:{},updated_at:now}).in("id",draftIds).eq("status","DRAFT");if(expiredDrafts.error)throw new PublicCheckoutError("Não foi possível expirar checkouts de caravana.");}
  const expired = await admin.from("event_public_checkouts").select("id,registration_id").eq("checkout_type","INDIVIDUAL").in("status", ["AWAITING_PAYMENT", "PROCESSING"]).lt("expires_at", now).limit(100);
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
    await applyProviderPayment(remote);
    reconciled += 1;
  }
  return { examined: expired.data?.length ?? 0, reconciled,expiredCaravanDrafts:draftIds.length };
}
