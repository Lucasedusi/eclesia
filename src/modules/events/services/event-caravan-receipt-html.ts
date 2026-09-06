import type { CaravanReceiptData } from "./event-caravan-receipt.service";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" }[character] ?? character));
}

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value).replace(/\u00a0/g, "&nbsp;");
}

function date(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value));
}

function status(value: string) {
  return ({ NOT_REQUIRED: "PAGAMENTO NÃO NECESSÁRIO", PENDING: "PAGAMENTO PENDENTE", PARTIAL: "PAGAMENTO PARCIAL", PAID: "PAGAMENTO CONFIRMADO", REFUNDED: "PAGAMENTO ESTORNADO" } as Record<string, string>)[value] ?? value;
}

export function createCaravanThermalReceiptHtml(data: CaravanReceiptData) {
  const items = data.items.map((item) => `<tr><td>${item.quantity}× ${escapeHtml(item.name)}</td><td>${money(item.totalPrice)}</td></tr>`).join("");
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Caravana ${escapeHtml(data.groupNumber)}</title><style>
@page{size:80mm auto;margin:3mm}*{box-sizing:border-box}body{width:74mm;margin:0 auto;background:#fff;color:#111;font-family:Arial,sans-serif;font-size:10px;line-height:1.35}header{text-align:center;border-bottom:1px dashed #777;padding:2mm 0 3mm}h1{margin:0 0 1mm;font-size:15px}header p{margin:0;font-size:9px}.status{display:block;margin:3mm 0;border:1px solid #111;padding:1.5mm;text-align:center;font-size:10px;letter-spacing:.06em}.details{display:grid;gap:1.3mm;margin-bottom:3mm}.details div,.totals div{display:flex;justify-content:space-between;gap:3mm}.details span,.totals span{color:#555}.details b,.totals b{text-align:right}table{width:100%;border-collapse:collapse;border-top:1px dashed #777;border-bottom:1px dashed #777}td{padding:1.6mm 0;vertical-align:top}td:last-child{text-align:right;font-weight:700}.totals{display:grid;gap:1.4mm;margin:2.5mm 0;border-bottom:1px dashed #777;padding-bottom:2.5mm}.number{text-align:center;margin:3mm 0}.number strong{display:block;font-size:14px}.number small{display:block;margin-top:1mm;color:#555}.issued{margin:3mm 0 0;text-align:center;color:#555;font-size:8px}.print{display:flex;justify-content:center;margin:5mm 0}.print button{border:0;border-radius:4px;background:#071426;padding:3mm 6mm;color:#fff;font-weight:700}@media print{.print{display:none}body{width:auto}}
</style></head><body><header><h1>${escapeHtml(data.eventName)}</h1><p>COMPROVANTE DE CARAVANA</p></header><strong class="status">${escapeHtml(status(data.paymentStatus))}</strong><section class="details"><div><span>Caravana</span><b>${escapeHtml(data.groupNumber)}</b></div><div><span>Igreja/origem</span><b>${escapeHtml(data.originChurchName)}</b></div><div><span>Cidade/UF</span><b>${escapeHtml(`${data.originCity}/${data.originState}`)}</b></div><div><span>Responsável</span><b>${escapeHtml(data.responsibleName)}</b></div><div><span>Pastor(a)</span><b>${escapeHtml(data.pastorName)}</b></div><div><span>Participantes</span><b>${data.totalRegistrations} (${data.maleCount} M / ${data.femaleCount} F)</b></div><div><span>Inscrição em</span><b>${escapeHtml(date(data.createdAt))}</b></div></section><table><tbody>${items}</tbody></table><section class="totals"><div><span>Total</span><b>${money(data.totalAmount)}</b></div><div><span>Pago</span><b>${money(data.paidAmount)}</b></div><div><span>Saldo</span><b>${money(data.remainingAmount)}</b></div></section><section class="number"><strong>${escapeHtml(data.groupNumber)}</strong><small>Código de validação: ${escapeHtml(data.verificationToken)}</small></section><p class="issued">Emitido em ${escapeHtml(date(new Date().toISOString()))}</p><div class="print"><button type="button" onclick="window.print()">IMPRIMIR</button></div></body></html>`;
}
