import "server-only";

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { PublicCheckoutStatus } from "../types/event.types";
import { createQrMatrix } from "../utils/qr-code";

const blue = rgb(0.25, 0.36, 0.65);
const ink = rgb(0.06, 0.1, 0.18);
const muted = rgb(0.4, 0.45, 0.54);
const line = rgb(0.89, 0.91, 0.94);

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function date(value: string | null) {
  return value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value)) : "—";
}

function paymentMethod(value: PublicCheckoutStatus["paymentMethod"]) {
  return { PIX: "Pix", CASH: "Dinheiro", DEBIT_CARD: "Cartão de débito", CREDIT_CARD: "Cartão de crédito", NOT_APPLICABLE: "Não necessário" }[value];
}

export async function createEventReceiptPdf(checkout: PublicCheckoutStatus) {
  if (!checkout.credentialToken || checkout.registrationStatus !== "CONFIRMED") throw new Error("EVENT_RECEIPT_NOT_AVAILABLE");
  const document = await PDFDocument.create();
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const page = document.addPage([595.28, 841.89]);
  const { height } = page.getSize();

  page.drawRectangle({ x: 0, y: height - 118, width: 595.28, height: 118, color: blue });
  page.drawText("EKLESIA · EVENTOS", { x: 44, y: height - 48, size: 11, font: bold, color: rgb(1, 1, 1) });
  page.drawText("Comprovante de inscrição", { x: 44, y: height - 78, size: 23, font: bold, color: rgb(1, 1, 1) });
  page.drawText(checkout.eventName.slice(0, 68), { x: 44, y: height - 100, size: 10, font: regular, color: rgb(0.9, 0.93, 1) });

  let y = height - 154;
  const row = (label: string, value: string) => {
    page.drawText(label, { x: 44, y, size: 9, font: regular, color: muted });
    page.drawText(value.slice(0, 72), { x: 220, y, size: 10, font: bold, color: ink });
    y -= 27;
  };
  row("Participante", checkout.participantName);
  row("Número da inscrição", checkout.registrationNumber);
  row("Data da inscrição", date(checkout.registeredAt));
  row("Confirmação", date(checkout.confirmedAt));
  row("Forma de pagamento", paymentMethod(checkout.paymentMethod));
  row("Situação", checkout.paymentStatus === "NOT_REQUIRED" ? "Pagamento não necessário" : "Pagamento confirmado");
  if (checkout.providerPaymentId) row("Referência do pagamento", checkout.providerPaymentId);
  page.drawLine({ start: { x: 44, y: y + 9 }, end: { x: 551, y: y + 9 }, thickness: 1, color: line });

  page.drawText("Itens da inscrição", { x: 44, y: y - 13, size: 12, font: bold, color: ink });
  y -= 42;
  for (const item of checkout.items.slice(0, 10)) {
    page.drawText(`${item.quantity}x  ${item.name}`.slice(0, 58), { x: 44, y, size: 9, font: regular, color: ink });
    const price = money(item.totalPrice);
    page.drawText(price, { x: 551 - bold.widthOfTextAtSize(price, 9), y, size: 9, font: bold, color: ink });
    y -= 23;
  }
  page.drawLine({ start: { x: 44, y: y + 7 }, end: { x: 551, y: y + 7 }, thickness: 1, color: line });
  page.drawText("Total", { x: 44, y: y - 17, size: 12, font: bold, color: ink });
  const total = checkout.totalAmount > 0 ? money(checkout.totalAmount) : "Gratuito";
  page.drawText(total, { x: 551 - bold.widthOfTextAtSize(total, 13), y: y - 17, size: 13, font: bold, color: blue });

  const credentialY = 88;
  page.drawRectangle({ x: 44, y: credentialY, width: 507, height: 205, color: rgb(0.965, 0.975, 1), borderColor: rgb(0.82, 0.86, 0.95), borderWidth: 1 });
  page.drawText("CREDENCIAL", { x: 65, y: credentialY + 169, size: 9, font: bold, color: blue });
  page.drawText(checkout.participantName.slice(0, 38), { x: 65, y: credentialY + 139, size: 17, font: bold, color: ink });
  page.drawText(checkout.registrationNumber, { x: 65, y: credentialY + 114, size: 10, font: regular, color: muted });
  page.drawText("Apresente esta credencial na entrada.", { x: 65, y: credentialY + 66, size: 9, font: regular, color: muted });
  page.drawText("Este comprovante não substitui documento pessoal.", { x: 65, y: credentialY + 46, size: 8, font: regular, color: muted });

  const matrix = createQrMatrix(checkout.credentialToken);
  const qrSize = 145;
  const quiet = 4;
  const moduleSize = qrSize / (matrix.length + quiet * 2);
  const qrX = 386;
  const qrY = credentialY + 29;
  page.drawRectangle({ x: qrX, y: qrY, width: qrSize, height: qrSize, color: rgb(1, 1, 1) });
  matrix.forEach((modules, rowIndex) => modules.forEach((dark, columnIndex) => {
    if (dark) page.drawRectangle({
      x: qrX + (columnIndex + quiet) * moduleSize,
      y: qrY + qrSize - (rowIndex + quiet + 1) * moduleSize,
      width: moduleSize + 0.05,
      height: moduleSize + 0.05,
      color: ink,
    });
  }));

  page.drawText(`Gerado em ${date(new Date().toISOString())}`, { x: 44, y: 48, size: 8, font: regular, color: muted });
  page.drawText("EKLESIA", { x: 551 - bold.widthOfTextAtSize("EKLESIA", 8), y: 48, size: 8, font: bold, color: blue });
  return Buffer.from(await document.save());
}
