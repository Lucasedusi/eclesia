import { createHmac, timingSafeEqual } from "node:crypto";

export type NormalizedPaymentStatus = "PENDING" | "CONFIRMED" | "FAILED" | "CANCELLED" | "REFUNDED" | "EXPIRED";

export function normalizeMercadoPagoStatus(status: string, expiresAt?: string | null): NormalizedPaymentStatus {
  if (status === "approved") return "CONFIRMED";
  if (status === "refunded" || status === "charged_back") return "REFUNDED";
  if (status === "cancelled") return "CANCELLED";
  if (status === "rejected") return "FAILED";
  if (expiresAt && Date.parse(expiresAt) <= Date.now()) return "EXPIRED";
  return "PENDING";
}

function signatureParts(header: string) {
  return Object.fromEntries(header.split(",").map((part) => part.trim().split("=", 2)).filter((part) => part.length === 2));
}

export function verifyMercadoPagoWebhookSignature(input: { signature: string; requestId: string; dataId: string; secret?: string; now?: number }) {
  const secret = input.secret ?? process.env.MERCADO_PAGO_WEBHOOK_SECRET?.trim();
  if (!secret || !input.signature || !input.requestId || !input.dataId) return false;
  const parts = signatureParts(input.signature);
  if (!parts.ts || !parts.v1 || !/^\d+$/.test(parts.ts) || !/^[a-f0-9]{64}$/i.test(parts.v1)) return false;
  const timestamp = Number(parts.ts);
  const timestampMs = timestamp < 10_000_000_000 ? timestamp * 1000 : timestamp;
  if (Math.abs((input.now ?? Date.now()) - timestampMs) > 10 * 60_000) return false;
  const manifest = `id:${input.dataId.toLowerCase()};request-id:${input.requestId};ts:${parts.ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest();
  const received = Buffer.from(parts.v1, "hex");
  return expected.length === received.length && timingSafeEqual(expected, received);
}
