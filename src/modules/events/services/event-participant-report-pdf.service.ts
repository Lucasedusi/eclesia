import "server-only";

import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import {
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  REGISTRATION_STATUSES,
  eventLabel,
} from "../constants/events";
import type {
  EventParticipantReportPreview,
  EventParticipantReportRow,
} from "../types/event.types";

const colors = {
  blue: rgb(0.045, 0.318, 0.718),
  blueDark: rgb(0.035, 0.18, 0.39),
  blueSoft: rgb(0.93, 0.95, 1),
  ink: rgb(0.063, 0.094, 0.157),
  body: rgb(0.28, 0.33, 0.42),
  muted: rgb(0.47, 0.52, 0.61),
  line: rgb(0.89, 0.91, 0.94),
  surface: rgb(0.975, 0.98, 0.99),
  white: rgb(1, 1, 1),
};

type Column = {
  key: string;
  label: string;
  weight: number;
  align?: "left" | "right";
  value: (row: EventParticipantReportRow) => string;
};

const paymentMethodLabels = new Map<string, string>([
  ...PAYMENT_METHODS,
  ["NOT_APPLICABLE", "Não aplicável"] as const,
]);

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
    if (font.widthOfTextAtSize(word, size) > maxWidth) {
      lines.push(fitText(word, font, size, maxWidth));
      current = "";
      if (lines.length >= maxLines && index < words.length - 1) truncated = true;
    } else {
      current = word;
    }
  }
  if (lines.length < maxLines && current) lines.push(current);
  if (truncated && lines.length) {
    let last = lines.at(-1) ?? "";
    last = last.replace(/\.{3}$/, "");
    while (last && font.widthOfTextAtSize(`${last}...`, size) > maxWidth) last = last.slice(0, -1);
    lines[lines.length - 1] = `${last}...`;
  }
  return lines;
}

function formatIssuedAt(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function formatRegisteredAt(value: string) {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Sao_Paulo",
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("day")}/${part("month")}/${part("year")} - ${part("hour")}h${part("minute")}`;
}

function genderLabel(value: string | null) {
  if (value === "FEMALE") return "Feminino";
  if (value === "MALE") return "Masculino";
  return "Não informado";
}

function columnsFor(report: EventParticipantReportPreview): Column[] {
  const columns: Column[] = [];
  if (report.config.columns.index) columns.push({ key: "index", label: "#", weight: 0.42, align: "right", value: (row) => String(row.index) });
  columns.push({ key: "name", label: "Nome do participante", weight: 2.2, value: (row) => row.participantName });
  columns.push({ key: "location", label: "Congregação / Regional", weight: 2.25, value: (row) => row.congregationAndRegion });
  if (report.config.columns.registrationNumber) columns.push({ key: "registrationNumber", label: "Inscrição", weight: 1.15, value: (row) => row.registrationNumber ?? "-" });
  if (report.config.columns.role) columns.push({ key: "role", label: "Cargo", weight: 1.3, value: (row) => row.roleName ?? "Sem cargo" });
  if (report.config.columns.gender) columns.push({ key: "gender", label: "Sexo", weight: 0.9, value: (row) => genderLabel(row.participantGender) });
  if (report.config.columns.phone) columns.push({ key: "phone", label: "Telefone", weight: 1.2, value: (row) => row.participantPhone ?? "-" });
  if (report.config.columns.registrationStatus) columns.push({ key: "registrationStatus", label: "Situação", weight: 1.05, value: (row) => eventLabel(REGISTRATION_STATUSES, row.registrationStatus) });
  if (report.config.columns.paymentMethod) columns.push({ key: "paymentMethod", label: "Pagamento", weight: 1.1, value: (row) => paymentMethodLabels.get(row.paymentMethod ?? "") ?? "Não informado" });
  if (report.config.columns.paymentStatus) columns.push({ key: "paymentStatus", label: "Situação pgto.", weight: 1.1, value: (row) => eventLabel(PAYMENT_STATUSES, row.paymentStatus) });
  if (report.config.columns.registeredAt) columns.push({ key: "registeredAt", label: "Data da inscrição", weight: 1.25, value: (row) => formatRegisteredAt(row.registeredAt) });
  if (report.config.columns.items) columns.push({ key: "items", label: "Itens", weight: 1.65, value: (row) => row.itemNames.join(", ") || "Nenhum" });
  return columns;
}

export async function createEventParticipantReportPdf(report: EventParticipantReportPreview) {
  const document = await PDFDocument.create();
  document.setTitle(`Relatório de participantes - ${report.event.name}`);
  document.setAuthor("Eclésia");
  document.setSubject("Relação de participantes do evento");
  document.setCreator("Eclésia");
  document.setProducer("Eclésia");
  document.setCreationDate(new Date(report.issuedAt));

  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const pageSize: [number, number] = [595.28, 841.89];
  const margin = 34;
  const footerTop = 44;
  let page!: PDFPage;
  let width = pageSize[0];
  let height = pageSize[1];
  let y = 0;

  const addPage = (first: boolean) => {
    page = document.addPage(pageSize);
    ({ width, height } = page.getSize());
    const headerHeight = first ? 90 : 56;
    page.drawRectangle({ x: 0, y: height - headerHeight, width, height: headerHeight, color: colors.blueDark });
    if (first) {
      page.drawText(fitText(report.churchName.toLocaleUpperCase("pt-BR"), bold, 8.5, width - margin * 2), { x: margin, y: height - 27, size: 8.5, font: bold, color: rgb(0.79, 0.86, 1) });
      page.drawText(fitText(report.event.name, bold, 18, width - margin * 2), { x: margin, y: height - 53, size: 18, font: bold, color: colors.white });
      page.drawText("Relatório de participantes", { x: margin, y: height - 73, size: 9.5, font: regular, color: rgb(0.86, 0.9, 1) });
      y = height - 112;
    } else {
      page.drawText("RELATÓRIO DE PARTICIPANTES", { x: margin, y: height - 23, size: 7.5, font: bold, color: rgb(0.79, 0.86, 1) });
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

  const drawSummary = () => {
    ensureSpace(70);
    page.drawRectangle({ x: margin, y: y - 60, width: width - margin * 2, height: 60, color: colors.blueSoft, borderColor: rgb(0.80, 0.85, 0.95), borderWidth: 0.8 });
    page.drawText("TOTAL DE PARTICIPANTES", { x: margin + 15, y: y - 21, size: 8, font: bold, color: colors.muted });
    page.drawText(new Intl.NumberFormat("pt-BR").format(report.totalParticipants), { x: margin + 15, y: y - 48, size: 24, font: bold, color: colors.blueDark });
    y -= 76;
  };

  const drawSectionTitle = () => {
    ensureSpace(38);
    y -= 4;
    page.drawRectangle({ x: margin, y: y - 18, width: 4, height: 20, color: colors.blue });
    page.drawText("PARTICIPANTES", { x: margin + 12, y: y - 14, size: 11.5, font: bold, color: colors.ink });
    y -= 34;
  };

  const drawTable = () => {
    const columns = columnsFor(report);
    const availableWidth = width - margin * 2;
    const totalWeight = columns.reduce((sum, column) => sum + column.weight, 0);
    const columnWidths = columns.map((column) => (availableWidth * column.weight) / totalWeight);
    const bodySize = columns.length <= 5 ? 7.6 : columns.length <= 8 ? 6.5 : 5.35;
    const headerSize = Math.max(4.9, bodySize - 0.55);
    const lineHeight = bodySize + 2.2;

    const drawHeader = () => {
      const headerHeight = columns.length > 8 ? 29 : 26;
      page.drawRectangle({ x: margin, y: y - headerHeight, width: availableWidth, height: headerHeight, color: colors.blue });
      let x = margin;
      columns.forEach((column, index) => {
        const labels = wrapText(column.label.toLocaleUpperCase("pt-BR"), bold, headerSize, columnWidths[index] - 8, 2);
        labels.forEach((label, lineIndex) => {
          const textWidth = bold.widthOfTextAtSize(label, headerSize);
          page.drawText(label, {
            x: column.align === "right" ? x + columnWidths[index] - textWidth - 5 : x + 5,
            y: y - 11 - lineIndex * (headerSize + 1.5),
            size: headerSize,
            font: bold,
            color: colors.white,
          });
        });
        x += columnWidths[index];
      });
      y -= headerHeight;
    };

    ensureSpace(62);
    drawHeader();
    report.participants.forEach((row, rowIndex) => {
      const cellLines = columns.map((column, index) => wrapText(column.value(row), regular, bodySize, columnWidths[index] - 10, column.key === "items" ? 3 : 2));
      const rowHeight = Math.max(25, Math.max(...cellLines.map((lines) => lines.length)) * lineHeight + 9);
      if (y - rowHeight < footerTop) {
        addPage(false);
        page.drawText("PARTICIPANTES - CONTINUAÇÃO", { x: margin, y, size: 7.8, font: bold, color: colors.body });
        y -= 17;
        drawHeader();
      }
      if (rowIndex % 2 === 1) page.drawRectangle({ x: margin, y: y - rowHeight, width: availableWidth, height: rowHeight, color: colors.surface });
      page.drawLine({ start: { x: margin, y: y - rowHeight }, end: { x: width - margin, y: y - rowHeight }, thickness: 0.55, color: colors.line });
      let x = margin;
      columns.forEach((column, index) => {
        const lines = cellLines[index];
        const cellFont = column.key === "name" ? bold : regular;
        lines.forEach((line, lineIndex) => {
          const textWidth = cellFont.widthOfTextAtSize(line, bodySize);
          page.drawText(line, {
            x: column.align === "right" ? x + columnWidths[index] - textWidth - 5 : x + 5,
            y: y - 15 - lineIndex * lineHeight,
            size: bodySize,
            font: cellFont,
            color: column.key === "name" ? colors.ink : colors.body,
          });
        });
        x += columnWidths[index];
      });
      y -= rowHeight;
    });
  };

  addPage(true);
  if (report.config.showIssuedAt) {
    page.drawText(`Emitido em ${formatIssuedAt(report.issuedAt)}`, { x: margin, y, size: 7.8, font: regular, color: colors.muted });
    y -= 20;
  }
  if (report.config.showAppliedFilters && report.appliedFilters.length > 0) {
    drawParagraphBox(`Filtros aplicados: ${report.appliedFilters.map((filter) => `${filter.label}: ${filter.value}`).join(" | ")}`);
  }
  drawSummary();
  drawSectionTitle();
  drawTable();

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
