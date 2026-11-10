import "server-only";
import ExcelJS from "exceljs";
import { PDFDocument, type PDFPage } from "pdf-lib";
import {
  createChurchPdfAssets,
  drawChurchHeader,
  drawChurchWatermark,
  finishChurchPdf,
  wrapPdfText,
  PDF_COLORS,
} from "@/lib/pdf/church-document";
import { formatPersonName } from "@/utils/person-name";
import type { MemberFinancialDocument } from "../types/member-finance.types";
import { formatDateOnly } from "../utils/member-formatters";
import {
  financeDirectionLabel,
  financeStatusLabel,
  formatMemberMoney,
} from "../utils/member-finance-formatters";
const labels = [
  "Data",
  "Tipo",
  "Categoria",
  "Descrição",
  "Pagamento",
  "Situação",
  "Valor",
];
const values = (row: MemberFinancialDocument["items"][number]) => [
  formatDateOnly(row.transactionDate),
  financeDirectionLabel(row.transactionType),
  row.category,
  row.description || row.transactionNumber || "—",
  row.paymentMethod || "Não informado",
  financeStatusLabel(row.status),
  formatMemberMoney(row.amount),
];
const summary = (data: MemberFinancialDocument) =>
  `Entradas confirmadas: ${formatMemberMoney(data.summary.incomeCents / 100)} · Saídas confirmadas: ${formatMemberMoney(data.summary.expenseCents / 100)} · Cancelados: ${formatMemberMoney(data.summary.cancelledCents / 100)} · Não confirmados: ${formatMemberMoney(data.summary.pendingCents / 100)}`;
export async function createMemberFinancialPdf(data: MemberFinancialDocument) {
  const doc = await PDFDocument.create(),
    assets = await createChurchPdfAssets(doc, data.church.logoDataUri),
    { regular, bold } = assets;
  const width = 841.89,
    height = 595.28,
    margin = 36,
    bottom = height - 57,
    widths = [65, 55, 100, 245, 95, 95, 114.89];
  let page: PDFPage,
    y = 0;
  const draw = (
    text: string,
    x: number,
    top: number,
    size = 9,
    font = regular,
    color = PDF_COLORS.navy,
  ) => page.drawText(text, { x, y: height - top - size, size, font, color });
  function paragraph(text: string, size = 10, font = regular) {
    for (const line of wrapPdfText(text, font, size, width - 2 * margin)) {
      if (y + size + 5 > bottom) newPage();
      draw(line, margin, y, size, font);
      y += size + 5;
    }
    y += 7;
  }
  function newPage() {
    page = doc.addPage([width, height]);
    drawChurchWatermark(page, assets);
    y =
      drawChurchHeader(page, data.church, assets, {
        verticalAlign: "center",
        detailLines: data.church.pastorNames?.length
          ? [
              `Presidentes: ${data.church.pastorNames.map(formatPersonName).join(" e ")}`,
            ]
          : [],
      }) + 22;
  }
  function tableHeader() {
    const h = 30;
    page.drawRectangle({
      x: margin,
      y: height - y - h,
      width: width - 2 * margin,
      height: h,
      color: PDF_COLORS.navy,
    });
    let x = margin;
    labels.forEach((label, i) => {
      draw(
        label.toLocaleUpperCase("pt-BR"),
        x + 6,
        y + 9,
        8,
        bold,
        PDF_COLORS.white,
      );
      x += widths[i];
    });
    y += h;
  }
  newPage();
  paragraph("RELATÓRIO FINANCEIRO DO MEMBRO", 16, bold);
  paragraph(
    `${formatPersonName(data.member.name)} · Matrícula: ${data.member.code || "Não informada"}`,
    11,
    bold,
  );
  if (data.period !== "Todo o período") paragraph(data.period, 9);
  if (data.category) paragraph(`Categoria: ${data.category}`, 9);
  y += 8;
  const count = `${data.items.length} lançamento(s)`;
  const summarySize = 9;
  const available =
    width - margin * 2 - bold.widthOfTextAtSize(count, summarySize) - 20;
  const groups = [
    ["Entradas", data.summary.incomeCents],
    ["Saídas", data.summary.expenseCents],
    ["Cancelados", data.summary.cancelledCents],
    ["Não confirmados", data.summary.pendingCents],
  ] as const;
  const rows: { text: string; font: typeof regular }[][] = [[]];
  const segmentWidth = (segments: (typeof rows)[number]) =>
    segments.reduce(
      (total, segment) =>
        total + segment.font.widthOfTextAtSize(segment.text, summarySize),
      0,
    );
  for (const [label, cents] of groups) {
    const segments = [
      { text: `${label}: `, font: regular },
      { text: formatMemberMoney(cents / 100), font: bold },
    ];
    const current = rows[rows.length - 1];
    const separator = current.length ? [{ text: " · ", font: regular }] : [];
    if (
      current.length &&
      segmentWidth([...current, ...separator, ...segments]) > available
    ) {
      rows.push(segments);
    } else current.push(...separator, ...segments);
  }
  draw(count, margin, y, summarySize, bold);
  for (const segments of rows) {
    let x = width - margin - segmentWidth(segments);
    for (const segment of segments) {
      draw(segment.text, x, y, summarySize, segment.font);
      x += segment.font.widthOfTextAtSize(segment.text, summarySize);
    }
    y += 14;
  }
  y += 16;
  if (y + 65 > bottom) newPage();
  tableHeader();
  if (!data.items.length) {
    y += 16;
    paragraph("Nenhum lançamento encontrado para o período.");
  }
  data.items.forEach((row, index) => {
    const cells = values(row).map((text, i) =>
      wrapPdfText(text, i === 6 ? bold : regular, 9, widths[i] - 12),
    );
    const fullHeight = Math.max(...cells.map((c) => c.length)) * 12 + 18;
    if (y + Math.min(fullHeight, 140) > bottom) {
      newPage();
      tableHeader();
    }
    while (cells.some((c) => c.length)) {
      if (y + 30 > bottom) {
        newPage();
        tableHeader();
      }
      const capacity = Math.max(1, Math.floor((bottom - y - 18) / 12)),
        portion = cells.map((c) => c.splice(0, capacity)),
        h = Math.max(...portion.map((c) => c.length)) * 12 + 18;
      page.drawRectangle({
        x: margin,
        y: height - y - h,
        width: width - margin * 2,
        height: h,
        color: index % 2 ? PDF_COLORS.white : PDF_COLORS.paper,
        opacity: assets.logo ? 0.3 : 1,
      });
      let x = margin;
      portion.forEach((lines, i) => {
        lines.forEach((text, n) =>
          draw(
            text,
            x + 6,
            y + 8 + n * 12,
            9,
            i === 6 ? bold : regular,
            row.transactionType === "EXPENSE" && (i === 1 || i === 6)
              ? PDF_COLORS.danger
              : PDF_COLORS.navy,
          ),
        );
        x += widths[i];
      });
      y += h;
    }
  });
  return finishChurchPdf(
    doc,
    regular,
    data.issuedAt,
    "Relatório financeiro do membro",
  );
}
export async function createMemberFinancialWorkbook(
  data: MemberFinancialDocument,
) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Eklesias";
  wb.created = new Date(data.issuedAt);
  const sheet = wb.addWorksheet("Financeiro do membro", {
    views: [{ state: "frozen", ySplit: 7 }],
    pageSetup: {
      orientation: "landscape",
      paperSize: 9,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
    headerFooter: { oddFooter: "&LEklesias&R Página &P de &N" },
  });
  sheet.columns = [14, 14, 24, 55, 24, 19, 19].map((width) => ({ width }));
  [
    data.church.name,
    "Relatório financeiro do membro",
    `${formatPersonName(data.member.name)} · Matrícula: ${data.member.code || "Não informada"}`,
    [data.period, data.category && `Categoria: ${data.category}`]
      .filter(Boolean)
      .join(" · "),
    summary(data),
    `Presidentes: ${(data.church.pastorNames ?? []).join(" e ")} · Emissão: ${formatDateOnly(data.issuedAt)}`,
  ].forEach((text, i) => {
    sheet.mergeCells(i + 1, 1, i + 1, 7);
    const cell = sheet.getCell(i + 1, 1);
    cell.value = text;
    cell.font = {
      name: "Calibri",
      size: i < 2 ? 14 : 11,
      bold: i < 2,
      color: { argb: i < 2 ? "FFFFFFFF" : "FF344054" },
    };
    cell.alignment = { wrapText: true, vertical: "middle" };
    sheet.getRow(i + 1).height =
      i === 3 && data.category ? 44 : i === 4 ? 40 : 30;
    if (i < 2)
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF0A294F" },
      };
  });
  sheet.addRow(labels);
  sheet.getRow(7).height = 28;
  sheet.getRow(7).eachCell((c) => {
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0A294F" },
    };
  });
  data.items.forEach((item) => {
    const row = sheet.addRow([...values(item).slice(0, 6), item.amount]);
    row.height = Math.min(
      409,
      Math.max(30, Math.ceil((item.description?.length ?? 0) / 50) * 15 + 12),
    );
    row.eachCell((c) => {
      c.alignment = { vertical: "middle", wrapText: true };
      c.font = { name: "Calibri", size: 11 };
    });
    row.getCell(7).numFmt = '"R$" #,##0.00';
  });
  sheet.autoFilter = {
    from: { row: 7, column: 1 },
    to: { row: Math.max(7, sheet.rowCount), column: 7 },
  };
  return Buffer.from(await wb.xlsx.writeBuffer());
}
