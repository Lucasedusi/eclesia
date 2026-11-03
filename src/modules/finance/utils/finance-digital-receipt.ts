import { formatBrazilPhone } from "@/utils/input-masks";

export const DIGITAL_RECEIPT_TOKEN = /^[A-Za-z0-9_-]{43}$/;
export const SHAREABLE_RECEIPT_STATUSES = ["ISSUED", "PRINTED", "REPRINTED"];

export function formatReceiptPhone(value: string): string {
  const text = value.trimStart();
  if (!text.startsWith("+")) return formatBrazilPhone(text);
  const digits = text.replace(/\D/g, "");
  if (digits.startsWith("55")) {
    const national = formatBrazilPhone(digits.slice(2, 13));
    return national ? `+55 ${national}` : "+55";
  }
  // Keep explicit foreign country codes; Brazilian grouping does not apply to them.
  return `+${text.slice(1).replace(/[^\d\s().-]/g, "")}`.slice(0, 30);
}

export function normalizeReceiptPhone(value: string): string {
  const text = value.trim();
  if (!/^[+\d\s().-]{8,30}$/.test(text) || text.slice(1).includes("+")) {
    throw new Error("Informe um telefone válido com DDD.");
  }
  const digits = text.replace(/\D/g, "");
  if (text.startsWith("+")) {
    if (!/^[1-9]\d{7,14}$/.test(digits)) throw new Error("Informe o código do país e um telefone válido.");
    return digits;
  }
  const national = digits.startsWith("55") && [12, 13].includes(digits.length) ? digits.slice(2) : digits;
  if (!/^[1-9]{2}(?:[2-5]\d{7}|9\d{8})$/.test(national)) {
    throw new Error("Informe um telefone válido com DDD.");
  }
  return `55${national}`;
}

export function buildDigitalReceiptUrl(token: string, siteUrl: string): string {
  if (!DIGITAL_RECEIPT_TOKEN.test(token)) throw new Error("INVALID_INPUT");
  let url: URL;
  try { url = new URL(siteUrl); } catch { throw new Error("RECEIPT_SITE_URL_INVALID"); }
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.username || url.password || (url.protocol !== "https:" && !(loopback && url.protocol === "http:"))) {
    throw new Error("RECEIPT_SITE_URL_INVALID");
  }
  return new URL(`/comprovante/${token}`, url.origin).toString();
}

export function buildReceiptWhatsAppUrl(phone: string, receiptUrl: string): string {
  const url = new URL(`https://wa.me/${normalizeReceiptPhone(phone)}`);
  url.searchParams.set("text", `Olá! Seu comprovante está disponível neste link: ${receiptUrl}`);
  return url.toString();
}
