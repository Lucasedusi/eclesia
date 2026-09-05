import "server-only";

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type {
  EventFinancialItemRow,
  EventFinancialExpenseRow,
  EventFinancialPaymentMethodRow,
  EventFinancialReportPreview,
} from "../types/event.types";

const colors = {
  blue: rgb(0.045, 0.318, 0.718),
  blueDark: rgb(0.035, 0.18, 0.39),
  blueSoft: rgb(0.93, 0.95, 1),
  green: rgb(0.02, 0.45, 0.30),
  greenSoft: rgb(0.92, 0.98, 0.95),
  ink: rgb(0.063, 0.094, 0.157),
  body: rgb(0.28, 0.33, 0.42),
  muted: rgb(0.47, 0.52, 0.61),
  line: rgb(0.89, 0.91, 0.94),
  surface: rgb(0.975, 0.98, 0.99),
  white: rgb(1, 1, 1),
};

type Column<Row> = {
  key: string;
  label: string;
  weight: number;
  align?: "left" | "right";
  bold?: boolean;
  value: (row: Row) => string;
};

function cleanText(value: unknown) {
  return String(value ?? "")
    .normalize("NFC")
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, "...")
    .replace(/\u2022/g, "-")
    .replace(/[^\u0009\u000A\u000D\u0020-\u007E\u00A0-\u00FF]/g, "?");
}

function fitText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const normalized = cleanText(text);
  if (font.widthOfTextAtSize(normalized, size) <= maxWidth) return normalized;
  let shortened = normalized;
  while (shortened.length && font.widthOfTextAtSize(`${shortened}...`, size) > maxWidth) shortened = shortened.slice(0, -1);
  return `${shortened}...`;
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number, maxLines = 2) {
  const normalized = cleanText(text).trim();
  if (!normalized) return ["-"];
  const words = normalized.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  let truncated = false;
  for (let index = 0; index < words.length; index += 1) {
    const word = words[index];
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    if (lines.length >= maxLines) {
      truncated = true;
      current = "";
      break;
    }
    current = font.widthOfTextAtSize(word, size) > maxWidth ? fitText(word, font, size, maxWidth) : word;
  }
  if (lines.length < maxLines && current) lines.push(current);
  if (truncated && lines.length) lines[lines.length - 1] = fitText(`${lines.at(-1)}...`, font, size, maxWidth);
  return lines;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function formatPercentage(value: number) {
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value)}%`;
}

function formatIssuedAt(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value));
}

function formatExpenseDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
}

export async function createEventFinancialReportPdf(report: EventFinancialReportPreview) {
  const document = await PDFDocument.create();
  document.setTitle(`Relatório financeiro - ${report.event.name}`);
  document.setAuthor("Eclésia");
  document.setSubject("Entradas, despesas, saldo e itens selecionados do evento");
  document.setCreator("Eclésia");
  document.setProducer("Eclésia");
  document.setCreationDate(new Date(report.issuedAt));

  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const pageSize: [number, number] = [595.28, 841.89];
  const margin = 38;
  const footerTop = 44;
  let page!: PDFPage;
  let width = pageSize[0];
  let height = pageSize[1];
  let y = 0;
  let listSectionStarted = false;

  const addPage = (first: boolean) => {
    page = document.addPage(pageSize);
    ({ width, height } = page.getSize());
    const headerHeight = first ? 90 : 56;
    page.drawRectangle({ x: 0, y: height - headerHeight, width, height: headerHeight, color: colors.blueDark });
    if (first) {
      page.drawText(fitText(report.churchName.toLocaleUpperCase("pt-BR"), bold, 8.5, width - margin * 2), { x: margin, y: height - 27, size: 8.5, font: bold, color: rgb(0.79, 0.86, 1) });
      page.drawText(fitText(report.event.name, bold, 18, width - margin * 2), { x: margin, y: height - 53, size: 18, font: bold, color: colors.white });
      page.drawText("Relatório financeiro", { x: margin, y: height - 73, size: 9.5, font: regular, color: rgb(0.86, 0.9, 1) });
      y = height - 112;
    } else {
      page.drawText("RELATÓRIO FINANCEIRO", { x: margin, y: height - 23, size: 7.5, font: bold, color: rgb(0.79, 0.86, 1) });
      page.drawText(fitText(report.event.name, bold, 12, width - margin * 2), { x: margin, y: height - 42, size: 12, font: bold, color: colors.white });
      y = height - 78;
    }
  };

  const ensureSpace = (needed: number) => {
    if (y - needed >= footerTop) return false;
    addPage(false);
    return true;
  };

  const drawParagraphBox = (text: string) => {
    const lines = wrapText(text, regular, 8.1, width - margin * 2 - 24, 4);
    const boxHeight = Math.max(34, 18 + lines.length * 10.5);
    ensureSpace(boxHeight + 8);
    page.drawRectangle({ x: margin, y: y - boxHeight, width: width - margin * 2, height: boxHeight, color: colors.surface, borderColor: colors.line, borderWidth: 0.7 });
    lines.forEach((line, index) => page.drawText(line, { x: margin + 12, y: y - 18 - index * 10.5, size: 8.1, font: regular, color: colors.body }));
    y -= boxHeight + 12;
  };

  const drawSectionTitle = (title: string) => {
    ensureSpace(38);
    y -= 8;
    page.drawRectangle({ x: margin, y: y - 18, width: 4, height: 20, color: colors.blue });
    page.drawText(cleanText(title).toLocaleUpperCase("pt-BR"), { x: margin + 12, y: y - 14, size: 11.5, font: bold, color: colors.ink });
    y -= 34;
  };

  const drawMetricCard = (x: number, cardWidth: number, label: string, value: string, primary = false) => {
    page.drawRectangle({ x, y: y - 62, width: cardWidth, height: 62, color: primary ? colors.greenSoft : colors.surface, borderColor: primary ? rgb(0.68, 0.87, 0.78) : colors.line, borderWidth: 0.8 });
    page.drawText(fitText(label.toLocaleUpperCase("pt-BR"), bold, 7.2, cardWidth - 24), { x: x + 12, y: y - 20, size: 7.2, font: bold, color: colors.muted });
    page.drawText(fitText(value, bold, primary ? 19 : 15, cardWidth - 24), { x: x + 12, y: y - 47, size: primary ? 19 : 15, font: bold, color: primary ? colors.green : colors.blueDark });
  };

  const drawSummary = () => {
    const includesEntries = report.config.scope !== "EXPENSES_ONLY" || report.config.sections.showPaymentMethods || report.config.sections.showItems;
    const includesExpenses = report.config.scope !== "ENTRIES_ONLY" || report.config.sections.showExpenses;
    const secondary: { label: string; value: string }[] = [];
    if (includesEntries && includesExpenses) secondary.push(
      { label: "Total de despesas", value: formatMoney(report.totalExpenses) },
      { label: "Saldo", value: formatMoney(report.balance) },
    );
    if (includesEntries && report.config.columns.summaryExpectedAmount) secondary.push({ label: "Valor previsto", value: formatMoney(report.expectedAmount) });
    if (includesEntries && report.config.columns.summaryPendingAmount) secondary.push({ label: "Valor pendente", value: formatMoney(report.pendingAmount) });
    if (includesEntries && report.config.columns.summaryPaidRegistrationCount) secondary.push({ label: "Inscrições pagas", value: formatNumber(report.paidRegistrationCount) });
    const gap = 8;
    const secondaryRows = Math.ceil(secondary.length / 3);
    ensureSpace(secondary.length ? 78 + secondaryRows * 70 : 76);
    drawMetricCard(margin, width - margin * 2, includesEntries ? "Total recebido" : "Total de despesas", formatMoney(includesEntries ? report.totalReceived : report.totalExpenses), true);
    y -= 70;
    if (secondary.length) {
      for (let offset = 0; offset < secondary.length; offset += 3) {
        const row = secondary.slice(offset, offset + 3);
        const cardWidth = (width - margin * 2 - gap * (row.length - 1)) / row.length;
        row.forEach((metric, index) => drawMetricCard(margin + index * (cardWidth + gap), cardWidth, metric.label, metric.value));
        y -= 70;
      }
      y -= 8;
    } else {
      y -= 8;
    }
  };

  const drawTable = <Row,>(columns: Column<Row>[], rows: Row[], continuationTitle: string) => {
    const availableWidth = width - margin * 2;
    const totalWeight = columns.reduce((sum, column) => sum + column.weight, 0);
    const widths = columns.map((column) => availableWidth * column.weight / totalWeight);
    const drawHeader = () => {
      const headerHeight = 27;
      page.drawRectangle({ x: margin, y: y - headerHeight, width: availableWidth, height: headerHeight, color: colors.blue });
      let x = margin;
      columns.forEach((column, index) => {
        const label = fitText(column.label.toLocaleUpperCase("pt-BR"), bold, 6.7, widths[index] - 12);
        const labelWidth = bold.widthOfTextAtSize(label, 6.7);
        page.drawText(label, { x: column.align === "right" ? x + widths[index] - labelWidth - 6 : x + 6, y: y - 17, size: 6.7, font: bold, color: colors.white });
        x += widths[index];
      });
      y -= headerHeight;
    };
    ensureSpace(62);
    drawHeader();
    rows.forEach((row, rowIndex) => {
      const cells = columns.map((column, index) => wrapText(column.value(row), regular, 8, widths[index] - 12, 2));
      const rowHeight = Math.max(28, Math.max(...cells.map((cell) => cell.length)) * 10.3 + 9);
      const remainingRows = rows.length - rowIndex;
      const wouldOrphanFinalRows = remainingRows <= 6 && y - rowHeight * remainingRows < footerTop + 84;
      if (y - rowHeight < footerTop || wouldOrphanFinalRows) {
        addPage(false);
        page.drawText(fitText(`${continuationTitle} - continuação`.toLocaleUpperCase("pt-BR"), bold, 8, width - margin * 2), { x: margin, y, size: 8, font: bold, color: colors.body });
        y -= 17;
        drawHeader();
      }
      if (rowIndex % 2 === 1) page.drawRectangle({ x: margin, y: y - rowHeight, width: availableWidth, height: rowHeight, color: colors.surface });
      page.drawLine({ start: { x: margin, y: y - rowHeight }, end: { x: width - margin, y: y - rowHeight }, thickness: 0.55, color: colors.line });
      let x = margin;
      columns.forEach((column, index) => {
        const cellFont = column.bold ? bold : regular;
        cells[index].forEach((line, lineIndex) => {
          const lineWidth = cellFont.widthOfTextAtSize(line, 8);
          page.drawText(line, { x: column.align === "right" ? x + widths[index] - lineWidth - 6 : x + 6, y: y - 17 - lineIndex * 10.3, size: 8, font: cellFont, color: column.bold ? colors.ink : colors.body });
        });
        x += widths[index];
      });
      y -= rowHeight;
    });
    y -= 18;
  };

  const beginListSection = (title: string) => {
    if (listSectionStarted) addPage(false);
    else ensureSpace(110);
    listSectionStarted = true;
    drawSectionTitle(title);
  };

  addPage(true);
  if (report.config.sections.showIssuedAt) {
    page.drawText(`Emitido em ${formatIssuedAt(report.issuedAt)}`, { x: margin, y, size: 7.8, font: regular, color: colors.muted });
    y -= 20;
  }
  if (report.config.sections.showAppliedFilters && report.appliedFilters.length) {
    drawParagraphBox(`Filtros aplicados: ${report.appliedFilters.map((filter) => `${filter.label}: ${filter.value}`).join(" | ")}`);
  }
  if (report.config.sections.showSummary) {
    drawSectionTitle("Resumo financeiro");
    drawSummary();
  }

  if (report.config.sections.showPaymentMethods) {
    beginListSection("Valores por forma de pagamento");
    if (!report.paymentMethods.length) drawParagraphBox("Nenhum pagamento confirmado possui correspondência com os filtros selecionados.");
    else {
      const columns: Column<EventFinancialPaymentMethodRow>[] = [
        { key:"method",label:"Forma de pagamento",weight:2.7,bold:true,value:(row)=>row.name },
      ];
      if (report.config.columns.paymentConfirmedCount) columns.push({ key:"count",label:"Pagamentos confirmados",weight:1.4,align:"right",value:(row)=>formatNumber(row.confirmedPaymentCount) });
      columns.push({ key:"received",label:"Valor recebido",weight:1.6,align:"right",bold:true,value:(row)=>formatMoney(row.amountReceived) });
      if (report.config.columns.paymentPercentage) columns.push({ key:"percentage",label:"% do total",weight:1.05,align:"right",value:(row)=>formatPercentage(row.percentage) });
      drawTable(columns, report.paymentMethods, "Valores por forma de pagamento");
    }
  }

  if (report.config.sections.showItems) {
    beginListSection("Itens selecionados");
    if (!report.items.length) drawParagraphBox("Nenhum item foi selecionado nas inscrições correspondentes aos filtros.");
    else {
      const columns: Column<EventFinancialItemRow>[] = [
        { key:"item",label:"Item",weight:2.8,bold:true,value:(row)=>row.name },
      ];
      if (report.config.columns.itemParticipantCount) columns.push({ key:"participants",label:"Participantes",weight:1.25,align:"right",value:(row)=>formatNumber(row.participantCount) });
      columns.push({ key:"units",label:"Unidades",weight:1.05,align:"right",bold:true,value:(row)=>formatNumber(row.units) });
      if (report.config.columns.itemExpectedAmount) columns.push({ key:"expected",label:"Valor previsto",weight:1.55,align:"right",value:(row)=>formatMoney(row.expectedAmount) });
      drawTable(columns, report.items, "Itens selecionados");
      drawParagraphBox("O valor dos itens é previsto com base no preço registrado na inscrição. O total recebido considera somente pagamentos confirmados.");
    }
  }

  if (report.config.sections.showExpenses) {
    beginListSection("Despesas do evento");
    if (!report.expenses.length) drawParagraphBox("Nenhuma despesa possui correspondência com os filtros selecionados.");
    else {
      const columns: Column<EventFinancialExpenseRow>[] = [];
      if (report.config.columns.expenseIndex) columns.push({ key:"index",label:"#",weight:.45,align:"right",value:(row)=>String(row.index) });
      columns.push(
        { key:"name",label:"Despesa",weight:3,bold:true,value:(row)=>row.name },
        { key:"date",label:"Data",weight:1.15,value:(row)=>formatExpenseDate(row.expenseDate) },
        { key:"amount",label:"Valor",weight:1.35,align:"right",bold:true,value:(row)=>formatMoney(row.amount) },
      );
      if (report.config.columns.expenseReceipt) columns.push({ key:"receipt",label:"Comprovante",weight:1.05,value:(row)=>row.hasReceipt?"Sim":"Não" });
      drawTable(columns, report.expenses, "Despesas do evento");
      drawParagraphBox(`Total de despesas: ${formatMoney(report.totalExpenses)}`);
    }
  }

  const pages = document.getPages();
  pages.forEach((currentPage, index) => {
    const pageWidth = currentPage.getWidth();
    currentPage.drawLine({ start: { x: margin, y: 31 }, end: { x: pageWidth - margin, y: 31 }, thickness: 0.6, color: colors.line });
    currentPage.drawText("Relatório gerado pelo sistema Eclésia", { x: margin, y: 17, size: 7, font: regular, color: colors.muted });
    const pageNumber = `Página ${index + 1} de ${pages.length}`;
    currentPage.drawText(pageNumber, { x: pageWidth - margin - regular.widthOfTextAtSize(pageNumber, 7), y: 17, size: 7, font: regular, color: colors.muted });
  });

  return Buffer.from(await document.save());
}
