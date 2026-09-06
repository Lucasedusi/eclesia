import type { PublicCheckoutStatus } from "../types/event.types";
import { createQrMatrix } from "../utils/qr-code";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" }[character] ?? character));
}

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function date(value: string | null) {
  return value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value)) : "—";
}

function method(value: PublicCheckoutStatus["paymentMethod"]) {
  return { PIX: "Pix", CASH: "Dinheiro", DEBIT_CARD: "Cartão de débito", CREDIT_CARD: "Cartão de crédito", NOT_APPLICABLE: "Não necessário" }[value];
}

function qrSvg(value: string) {
  const matrix = createQrMatrix(value);
  const quiet = 4;
  const size = matrix.length + quiet * 2;
  const paths: string[] = [];
  matrix.forEach((row, y) => row.forEach((dark, x) => { if (dark) paths.push(`<rect x="${x + quiet}" y="${y + quiet}" width="1" height="1"/>`); }));
  return `<svg viewBox="0 0 ${size} ${size}" role="img" aria-label="QR Code da credencial"><rect width="${size}" height="${size}" fill="#fff"/><g fill="#071426">${paths.join("")}</g></svg>`;
}

export function createEventThermalReceiptHtml(checkout: PublicCheckoutStatus) {
  const confirmed = ["CONFIRMED", "CHECKED_IN"].includes(checkout.registrationStatus);
  const status = confirmed ? "CONFIRMADA" : ["CANCELLED", "EXPIRED", "FAILED"].includes(checkout.registrationStatus) ? checkout.registrationStatus : "PENDENTE";
  const items = checkout.items.map((item) => `<tr><td>${item.quantity}× ${escapeHtml(item.name)}</td><td>${escapeHtml(money(item.totalPrice))}</td></tr>`).join("");
  const credential = checkout.credentialToken ? `<section class="credential"><strong>CREDENCIAL</strong>${qrSvg(checkout.credentialToken)}<b>${escapeHtml(checkout.registrationNumber)}</b><small>Apresente na entrada do evento</small></section>` : `<section class="waiting"><strong>CREDENCIAL AGUARDANDO LIBERAÇÃO</strong><small>Disponível após a confirmação do pagamento.</small></section>`;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Comprovante ${escapeHtml(checkout.registrationNumber)}</title><style>
@page{size:80mm auto;margin:3mm}*{box-sizing:border-box}body{width:74mm;margin:0 auto;background:#fff;color:#111;font-family:Arial,sans-serif;font-size:10px;line-height:1.35}header{text-align:center;border-bottom:1px dashed #777;padding:2mm 0 3mm}h1{margin:0 0 1mm;font-size:15px}header p{margin:0;font-size:9px}.status{display:block;margin:3mm 0;border:1px solid #111;padding:1.5mm;text-align:center;font-size:11px;letter-spacing:.08em}.details{display:grid;gap:1.3mm;margin-bottom:3mm}.details div{display:flex;justify-content:space-between;gap:3mm}.details span{color:#555}.details b{text-align:right}table{width:100%;border-collapse:collapse;border-top:1px dashed #777;border-bottom:1px dashed #777}td{padding:1.6mm 0;vertical-align:top}td:last-child{text-align:right;font-weight:700}.total{display:flex;justify-content:space-between;margin:2.5mm 0;font-size:12px}.credential,.waiting{display:grid;justify-items:center;gap:1.5mm;border-top:1px dashed #777;padding-top:3mm;text-align:center}.credential svg{width:34mm;height:34mm}.credential b{font-size:12px}.waiting{padding-bottom:3mm}.issued{margin:3mm 0 0;text-align:center;color:#555;font-size:8px}.print{display:flex;justify-content:center;margin:5mm 0}.print button{border:0;border-radius:4px;background:#071426;padding:3mm 6mm;color:#fff;font-weight:700}@media print{.print{display:none}body{width:auto}}
</style></head><body><header><h1>${escapeHtml(checkout.eventName)}</h1><p>COMPROVANTE DE INSCRIÇÃO</p></header><strong class="status">${escapeHtml(status)}</strong><section class="details"><div><span>Participante</span><b>${escapeHtml(checkout.participantName)}</b></div><div><span>Inscrição</span><b>${escapeHtml(checkout.registrationNumber)}</b></div><div><span>Congregação</span><b>${escapeHtml(checkout.congregationName ?? "Não informada")}</b></div><div><span>Regional</span><b>${escapeHtml(checkout.regionName ?? "Não informada")}</b></div><div><span>Pagamento</span><b>${escapeHtml(method(checkout.paymentMethod))}</b></div><div><span>Inscrição em</span><b>${escapeHtml(date(checkout.registeredAt))}</b></div></section><table><tbody>${items}</tbody></table><div class="total"><span>Total</span><strong>${escapeHtml(checkout.totalAmount > 0 ? money(checkout.totalAmount) : "Gratuito")}</strong></div>${credential}<p class="issued">Emitido em ${escapeHtml(date(new Date().toISOString()))}</p><div class="print"><button type="button" onclick="window.print()">IMPRIMIR</button></div></body></html>`;
}
