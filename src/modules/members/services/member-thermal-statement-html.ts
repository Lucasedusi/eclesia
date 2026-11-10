import "server-only";
import type { MemberThermalStatement } from "../types/member-thermal-statement.types";
import { formatMemberMoney } from "../utils/member-finance-formatters";
import { formatDateOnly } from "../utils/member-formatters";
import { formatPersonName } from "@/utils/person-name";

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );

export function renderMemberThermalStatement(
  data: MemberThermalStatement,
  width: 80 | 58,
) {
  // Match the tested printable strip of the Finance receipt, including the 58 mm reserve.
  const printableWidth = width === 58 ? 47 : 74;
  const left = width === 58 ? 5 : 3;
  const right = width - printableWidth - left;
  const logo =
    data.logoDataUri &&
    /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(data.logoDataUri)
      ? data.logoDataUri
      : null;
  const money = (cents: number) => escapeHtml(formatMemberMoney(cents / 100));
  const issued = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(data.issuedAt));
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>Extrato do contribuinte</title><style>
  *{box-sizing:border-box}html,body{margin:0;background:#fff;color:#000;font-family:Arial,sans-serif;font-size:12px;line-height:1.4}body{padding:3mm ${right}mm 3mm ${left}mm}article{width:${printableWidth}mm;max-width:100%;overflow-wrap:anywhere}header{text-align:center;display:grid;justify-items:center;gap:6px;border-bottom:1px dashed #000;padding-bottom:8px}header img{width:14mm;height:14mm;object-fit:contain;filter:grayscale(1) contrast(1.2)}h1{font-size:13px;line-height:1.35;margin:0}p{margin:0}h2{font-size:12px;text-align:center;margin:12px 0 8px}section{margin-bottom:12px}.identity strong{display:block;margin-bottom:5px}.filters{font-size:11px}.items{border-top:1px dashed #000;border-bottom:1px dashed #000;padding:8px 0}.item{break-inside:avoid;page-break-inside:avoid;margin-bottom:9px}.item:last-child{margin:0}.amount-row{display:flex;justify-content:space-between;align-items:baseline;gap:4px 8px;flex-wrap:wrap}.amount-row strong{margin-left:auto;white-space:nowrap;font-weight:600}.category{display:block;font-size:11px;margin-top:2px}.totals{break-inside:avoid;font-size:12px}.totals .amount-row{margin-top:5px}footer{border-top:1px dashed #000;padding-top:8px;text-align:center;font-size:9px;break-inside:avoid}footer p+p{margin-top:4px}
  @media print{@page{size:auto;margin:3mm ${right}mm 3mm ${left}mm}html,body{margin:0!important;padding:0!important;background:white!important}article{width:${printableWidth}mm!important;margin:0!important}}
  </style></head><body><article aria-label="Extrato do contribuinte">
  <header>${logo ? `<img src="${logo}" alt="Logo da igreja">` : ""}<h1>${escapeHtml(data.churchName)}</h1>${data.congregationName ? `<p>Congregação do membro<br><strong>${escapeHtml(data.congregationName)}</strong></p>` : ""}</header>
  <h2>EXTRATO DO CONTRIBUINTE</h2><section class="identity"><strong>${escapeHtml(formatPersonName(data.memberName))}</strong><div class="filters"><p>${escapeHtml(data.period)}</p>${data.category ? `<p>Categoria: ${escapeHtml(data.category)}</p>` : ""}<p>Somente entradas confirmadas</p></div></section>
  <section class="items">${data.items.length ? data.items.map((item) => `<div class="item"><div class="amount-row"><time datetime="${escapeHtml(item.date)}">${escapeHtml(formatDateOnly(item.date).replace(/(\d{2}\/\d{2}\/)\d{2}(\d{2})$/, "$1$2"))}</time><strong>${money(item.amountCents)}</strong></div><span class="category">${escapeHtml(item.category)}</span></div>`).join("") : "<p>Nenhuma entrada confirmada para os filtros selecionados.</p>"}</section>
  <section class="totals"><p>${data.items.length} lançamento(s)</p><div class="amount-row"><span>Total</span><strong>${money(data.totalCents)}</strong></div></section><footer><p>Eklesias</p><p>Emitido em ${escapeHtml(issued)}</p></footer>
  </article></body></html>`;
}
