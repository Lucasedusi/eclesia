import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFPage, type PDFFont } from "pdf-lib";
import sharp from "sharp";
import type { DigitalReceipt } from "../types/finance-digital-receipt.types";
import { formatMoney } from "../utils/finance-money";
import { wrapReportText } from "../utils/finance-report-layout";

const W = 420, MIN_HEIGHT = 595.28, M = 32, CW = W - M * 2;
const ink = rgb(.14, .25, .2), green = rgb(.09, .39, .28), muted = rgb(.45, .52, .48), pale = rgb(.94, .97, .95), line = rgb(.87, .91, .88);
let fonts: Promise<Buffer[]> | undefined;

export async function createFinanceDigitalReceiptPdf(data: DigitalReceipt): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const [regularBytes, boldBytes] = await (fonts ??= Promise.all(["Rubik-400.ttf", "Rubik-600.ttf"].map((name) => readFile(path.join(process.cwd(), "public/fonts/credential", name)))));
  const regular = await doc.embedFont(regularBytes, { subset: true }), bold = await doc.embedFont(boldBytes, { subset: true });
  doc.setTitle("Comprovante digital");
  doc.setCreator("Eklesias");
  // Measure the full receipt first, then draw on one page at readable font sizes.
  const draw: Array<(page: PDFPage, height: number) => void> = [];
  let y = M;
  function text(value: string, size = 10, font: PDFFont = regular, color = ink, center = false, width = CW) {
    for (const row of wrapReportText(value, width, (s) => font.widthOfTextAtSize(s, size))) {
      const top = y;
      draw.push((page, height) => page.drawText(row, { x: center ? (W - font.widthOfTextAtSize(row, size)) / 2 : M, y: height - top - size, size, font, color }));
      y += size + 5;
    }
  }
  function rule() {
    const top = y;
    draw.push((page, height) => page.drawLine({ start: { x: M, y: height - top }, end: { x: W - M, y: height - top }, color: line, thickness: .6 }));
    y += 14;
  }
  if (data.logoDataUri && /^data:image\/(png|jpeg|webp);base64,/.test(data.logoDataUri)) {
    try {
      const bytes = await sharp(Buffer.from(data.logoDataUri.split(",")[1], "base64"), { limitInputPixels: 16_000_000 }).resize(160, 160, { fit: "inside", withoutEnlargement: true }).png().toBuffer();
      const logo = await doc.embedPng(bytes), size = logo.scaleToFit(46, 46);
      const top = y;
      draw.push((page, height) => page.drawImage(logo, { x: (W - size.width) / 2, y: height - top - size.height, ...size }));
      y += size.height + 12;
    } catch { /* A damaged optional logo does not prevent receipt delivery. */ }
  }
  text(data.churchName, 13, bold, ink, true);
  text(data.congregationName, 9, regular, muted, true);
  y += 14;
  text("CONFIRMADO", 8, bold, green, true);
  text(data.direction === "INCOME" ? "Comprovante de contribuição" : "Comprovante de saída", 15, bold, ink, true);
  const total = formatMoney(data.totalCents);
  text(total, Math.min(28, 28 * CW / bold.widthOfTextAtSize(total, 28)), bold, green, true);
  y += 12;
  rule();
  text(data.direction === "INCOME" ? "Recebido de" : "Pago a", 8, regular, muted);
  text(data.personName || (data.direction === "INCOME" ? "Contribuição coletiva" : "Não informado"), 11, bold);
  y += 8;
  text(`Data da movimentação: ${data.date.split("-").reverse().join("/")}`, 9);
  text(`Forma de pagamento: ${data.paymentMethodName}`, 9);
  y += 14;
  text(data.direction === "INCOME" ? "CONTRIBUIÇÕES" : "DETALHAMENTO", 8, bold, muted);
  y += 5;
  for (const item of data.items) {
    const amount = formatMoney(item.amountCents), amountWidth = regular.widthOfTextAtSize(amount, 10);
    const category = wrapReportText(item.categoryName, CW - amountWidth - 20, (s) => bold.widthOfTextAtSize(s, 10));
    const top = y;
    draw.push((page, height) => page.drawText(amount, { x: W - M - amountWidth, y: height - top - 10, font: regular, size: 10, color: ink }));
    for (const row of category) text(row, 10, bold, ink, false, CW - amountWidth - 20);
    text([item.departmentName, item.classificationName].filter(Boolean).join(" · "), 8, regular, muted);
    y += 9;
  }
  const totalTop = y;
  draw.push((page, height) => {
    page.drawRectangle({ x: M, y: height - totalTop - 32, width: CW, height: 32, color: pale });
    page.drawText("Total", { x: M + 12, y: height - totalTop - 21, size: 11, font: bold, color: green });
    page.drawText(total, { x: W - M - 12 - bold.widthOfTextAtSize(total, 12), y: height - totalTop - 21, size: 12, font: bold, color: green });
  });
  y += 49;
  text(data.direction === "INCOME" ? "Obrigado por sua contribuição." : "Registro de saída de recursos.", 9, regular, muted, true);
  if (data.direction === "INCOME") text("Deus ama quem dá com alegria.", 8, regular, muted, true);
  y += 16;
  rule();
  text("Número do comprovante", 7, regular, muted);
  text(data.number, 7, regular, muted);
  text(`Registrado em ${new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date(data.registeredAt))}`, 7, regular, muted);
  if (data.congregationAddress) { y += 6; text(data.congregationAddress, 7, regular, muted); }
  if (data.churchDocument) text(`CNPJ: ${data.churchDocument}`, 7, regular, muted);
  const height = Math.max(MIN_HEIGHT, Math.ceil(y + 52));
  const page = doc.addPage([W, height]);
  page.drawRectangle({ x: 0, y: height - 4, width: W, height: 4, color: green });
  for (const render of draw) render(page, height);
  page.drawText("Emitido com Eklesias", { x: M, y: 20, size: 7, font: regular, color: muted });
  return doc.save();
}
