import "server-only";

import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import type {
  EventGeneralReportPreview,
  EventReportCongregationRow,
  EventReportRegionRow,
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
  danger: rgb(0.72, 0.14, 0.12),
  dangerLine: rgb(0.94, 0.66, 0.64),
  dangerSoft: rgb(1, 0.94, 0.935),
  warning: rgb(1, 0.975, 0.89),
  warningText: rgb(0.48, 0.34, 0.09),
};

type Column = {
  key: string;
  label: string;
  weight: number;
  align?: "left" | "right";
};

type TableRow = {
  cells: Record<string, string>;
  danger?: boolean;
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

function formatIssuedAt(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function quotaText(value: number | null) {
  return value === null ? "Não definida" : formatNumber(value);
}

function percentageText(value: number | null) {
  return value === null ? "-" : `${formatNumber(value)}%`;
}

function hasUnmetQuota(row: { registrations: number; quota: number | null }) {
  return row.quota !== null && row.registrations < row.quota;
}

function withPastorPrefix(value: string | null) {
  const normalized = cleanText(value).trim();
  if (!normalized) return "-";
  const withoutPrefix = normalized.replace(/^(?:pr(?:a)?\.?|pastor(?:a)?)\s*/i, "").trim();
  return withoutPrefix ? `Pr. ${withoutPrefix}` : "-";
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number, maxLines = Number.POSITIVE_INFINITY) {
  const normalized = cleanText(text).trim();
  if (!normalized) return [""];
  const words = normalized.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth || !current) {
      current = candidate;
      continue;
    }
    lines.push(current);
    current = word;
    if (lines.length === maxLines) break;
  }
  if (lines.length < maxLines && current) lines.push(current);
  if (lines.length === maxLines && words.join(" ") !== lines.join(" ")) {
    let last = lines.at(-1) ?? "";
    while (last && font.widthOfTextAtSize(`${last}...`, size) > maxWidth) last = last.slice(0, -1);
    lines[lines.length - 1] = `${last}...`;
  }
  return lines;
}

function fitText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const normalized = cleanText(text);
  if (font.widthOfTextAtSize(normalized, size) <= maxWidth) return normalized;
  let shortened = normalized;
  while (shortened.length && font.widthOfTextAtSize(`${shortened}...`, size) > maxWidth) shortened = shortened.slice(0, -1);
  return `${shortened}...`;
}

function regionRows(rows: EventReportRegionRow[], report: EventGeneralReportPreview) {
  const columns: Column[] = [{ key: "name", label: "Regional", weight: 2.15 }];
  if (report.config.columns.regionalCoordinator) columns.push({ key: "coordinator", label: "Coordenador", weight: 2.15 });
  if (report.config.columns.regionalQuota) columns.push({ key: "quota", label: "Meta", weight: 1, align: "right" });
  columns.push({ key: "registrations", label: "Inscrições", weight: 1.05, align: "right" });
  if (report.config.columns.regionalPercentage) columns.push({ key: "percentage", label: "% meta", weight: 1, align: "right" });
  return {
    columns,
    rows: rows.map((row): TableRow => ({
      danger: hasUnmetQuota(row),
      cells: {
        name: row.name,
        coordinator: withPastorPrefix(row.coordinatorName),
        quota: quotaText(row.quota),
        registrations: formatNumber(row.registrations),
        percentage: percentageText(row.percentage),
      },
    })),
  };
}

function congregationRows(rows: EventReportCongregationRow[], report: EventGeneralReportPreview, showRegion: boolean) {
  const columns: Column[] = [];
  if (showRegion) columns.push({ key: "index", label: "#", weight: 0.42, align: "right" });
  columns.push({ key: "name", label: "Congregação", weight: 1.9 });
  if (showRegion) columns.push({ key: "region", label: "Regional", weight: 1.35 });
  if (report.config.columns.congregationPastor) columns.push({ key: "pastor", label: "Pastor dirigente", weight: 1.95 });
  if (report.config.columns.congregationQuota) columns.push({ key: "quota", label: "Meta", weight: 1, align: "right" });
  columns.push({ key: "registrations", label: "Inscrições", weight: 1.05, align: "right" });
  if (report.config.columns.congregationPercentage) columns.push({ key: "percentage", label: "% meta", weight: 1, align: "right" });
  return {
    columns,
    rows: rows.map((row, index): TableRow => ({
      danger: hasUnmetQuota(row),
      cells: {
        index: String(index + 1),
        name: row.name,
        region: row.regionName,
        pastor: withPastorPrefix(row.pastorName),
        quota: quotaText(row.quota),
        registrations: formatNumber(row.registrations),
        percentage: percentageText(row.percentage),
      },
    })),
  };
}

export async function createEventGeneralReportPdf(report: EventGeneralReportPreview) {
  const document = await PDFDocument.create();
  document.setTitle(`Relatório geral de inscrições - ${report.event.name}`);
  document.setAuthor("Eclésia");
  document.setSubject("Relatório geral de inscrições por regionais, congregações, cargos e sexo");
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
      page.drawText(fitText(report.churchName.toLocaleUpperCase("pt-BR"), bold, 8.5, width - margin * 2), {
        x: margin,
        y: height - 27,
        size: 8.5,
        font: bold,
        color: rgb(0.79, 0.86, 1),
      });
      page.drawText(fitText(report.event.name, bold, 18, width - margin * 2), {
        x: margin,
        y: height - 53,
        size: 18,
        font: bold,
        color: colors.white,
      });
      page.drawText("Relatório geral de inscrições", {
        x: margin,
        y: height - 73,
        size: 9.5,
        font: regular,
        color: rgb(0.86, 0.9, 1),
      });
      y = height - 112;
    } else {
      page.drawText("RELATÓRIO GERAL DE INSCRIÇÕES", { x: margin, y: height - 23, size: 7.5, font: bold, color: rgb(0.79, 0.86, 1) });
      page.drawText(fitText(report.event.name, bold, 12, width - margin * 2), { x: margin, y: height - 42, size: 12, font: bold, color: colors.white });
      y = height - 78;
    }
  };

  const ensureSpace = (needed: number) => {
    if (y - needed >= footerTop) return false;
    addPage(false);
    return true;
  };

  const drawSectionTitle = (title: string) => {
    ensureSpace(38);
    y -= 8;
    page.drawRectangle({ x: margin, y: y - 18, width: 4, height: 20, color: colors.blue });
    page.drawText(cleanText(title).toLocaleUpperCase("pt-BR"), { x: margin + 12, y: y - 14, size: 11.5, font: bold, color: colors.ink });
    y -= 34;
  };

  const drawParagraphBox = (text: string, warning = false) => {
    const lines = wrapText(text, regular, 8.2, width - margin * 2 - 24);
    const boxHeight = Math.max(34, 18 + lines.length * 10.5);
    ensureSpace(boxHeight + 8);
    page.drawRectangle({
      x: margin,
      y: y - boxHeight,
      width: width - margin * 2,
      height: boxHeight,
      color: warning ? colors.warning : colors.surface,
      borderColor: warning ? rgb(0.92, 0.79, 0.43) : colors.line,
      borderWidth: 0.7,
    });
    lines.forEach((line, index) => page.drawText(line, {
      x: margin + 12,
      y: y - 18 - index * 10.5,
      size: 8.2,
      font: regular,
      color: warning ? colors.warningText : colors.body,
    }));
    y -= boxHeight + 12;
  };

  const drawSummary = () => {
    ensureSpace(76);
    page.drawRectangle({
      x: margin,
      y: y - 66,
      width: width - margin * 2,
      height: 66,
      color: colors.blueSoft,
      borderColor: rgb(0.80, 0.85, 0.95),
      borderWidth: 0.8,
    });
    page.drawText("TOTAL DE INSCRIÇÕES", { x: margin + 15, y: y - 22, size: 8, font: bold, color: colors.muted });
    page.drawText(formatNumber(report.totalRegistrations), { x: margin + 15, y: y - 51, size: 25, font: bold, color: colors.blueDark });
    y -= 82;
  };

  const drawEmpty = (message: string) => drawParagraphBox(message);

  const drawTable = (columns: Column[], rows: TableRow[], continuationTitle: string) => {
    const availableWidth = width - margin * 2;
    const totalWeight = columns.reduce((sum, column) => sum + column.weight, 0);
    const widths = columns.map((column) => (availableWidth * column.weight) / totalWeight);

    const drawHeader = () => {
      const headerHeight = 26;
      page.drawRectangle({ x: margin, y: y - headerHeight, width: availableWidth, height: headerHeight, color: colors.blue });
      let x = margin;
      columns.forEach((column, index) => {
        const label = fitText(column.label.toLocaleUpperCase("pt-BR"), bold, 6.6, widths[index] - 10);
        const textWidth = bold.widthOfTextAtSize(label, 6.6);
        page.drawText(label, {
          x: column.align === "right" ? x + widths[index] - textWidth - 6 : x + 6,
          y: y - 17,
          size: 6.6,
          font: bold,
          color: colors.white,
        });
        x += widths[index];
      });
      y -= headerHeight;
    };

    ensureSpace(62);
    drawHeader();
    const rowLayouts = rows.map((row) => {
      const cellLines = columns.map((column, index) => wrapText(row.cells[column.key] ?? "", regular, 7.7, widths[index] - 18, 2));
      const rowHeight = Math.max(27, Math.max(...cellLines.map((lines) => lines.length)) * 10 + 9);
      return { ...row, cellLines, rowHeight };
    });

    rowLayouts.forEach(({ cellLines, rowHeight, danger }, rowIndex) => {
      if (y - rowHeight < footerTop) {
        addPage(false);
        page.drawText(fitText(`${continuationTitle} - continuação`.toLocaleUpperCase("pt-BR"), bold, 8, width - margin * 2), { x: margin, y, size: 8, font: bold, color: colors.body });
        y -= 17;
        drawHeader();
      }
      if (danger || rowIndex % 2 === 1) {
        page.drawRectangle({ x: margin, y: y - rowHeight, width: availableWidth, height: rowHeight, color: danger ? colors.dangerSoft : colors.surface });
      }
      if (danger) page.drawRectangle({ x: margin, y: y - rowHeight, width: 3, height: rowHeight, color: colors.danger });
      page.drawLine({ start: { x: margin, y: y - rowHeight }, end: { x: width - margin, y: y - rowHeight }, thickness: 0.55, color: danger ? colors.dangerLine : colors.line });
      let x = margin;
      columns.forEach((column, index) => {
        const lines = cellLines[index];
        const registrationsColumn = column.key === "registrations";
        const cellFont = registrationsColumn ? bold : regular;
        const cellSize = registrationsColumn ? 9.2 : 7.7;
        lines.forEach((line, lineIndex) => {
          const textWidth = cellFont.widthOfTextAtSize(line, cellSize);
          page.drawText(line, {
            x: column.align === "right" ? x + widths[index] - textWidth - 6 : x + 6,
            y: y - 16 - lineIndex * 10,
            size: cellSize,
            font: cellFont,
            color: danger && ["quota", "registrations", "percentage"].includes(column.key) ? colors.danger : colors.body,
          });
        });
        x += widths[index];
      });
      y -= rowHeight;
    });
    y -= 18;
  };

  const beginListSection = (title: string) => {
    if (listSectionStarted) addPage(false);
    else ensureSpace(105);
    listSectionStarted = true;
    drawSectionTitle(title);
  };

  addPage(true);

  if (report.config.sections.showIssuedAt) {
    page.drawText(`Emitido em ${formatIssuedAt(report.issuedAt)}`, { x: margin, y, size: 7.8, font: regular, color: colors.muted });
    y -= 20;
  }

  if (report.config.sections.showAppliedFilters && report.appliedFilters.length > 0) {
    drawParagraphBox(`Filtros aplicados: ${report.appliedFilters.map((filter) => `${filter.label}: ${filter.value}`).join(" | ")}`);
  }

  if (report.config.sections.showSummary) {
    drawSectionTitle("Resumo geral");
    drawSummary();
  }

  if (report.config.sections.showRegions) {
    beginListSection("Inscrições por regionais");
    if (report.regions.length) {
      const table = regionRows(report.regions, report);
      drawTable(table.columns, table.rows, "Inscrições por regionais");
    } else {
      drawEmpty("Nenhuma regional está disponível para a configuração selecionada.");
    }
  }

  if (report.config.sections.showCongregations) {
    beginListSection("Inscrições por congregações");
    if (!report.congregations.length) {
      drawEmpty("Nenhuma congregação possui resultados para a configuração selecionada.");
    } else if (report.config.organization === "ALPHABETICAL") {
      const table = congregationRows(report.congregations, report, true);
      drawTable(table.columns, table.rows, "Inscrições por congregações");
    } else {
      for (const region of report.regions) {
        const rows = report.congregations.filter((congregation) => region.unassigned ? !congregation.regionId : congregation.regionId === region.id);
        if (!rows.length) continue;
        ensureSpace(94);
        const danger = hasUnmetQuota(region);
        page.drawRectangle({
          x: margin,
          y: y - 32,
          width: width - margin * 2,
          height: 32,
          color: danger ? colors.dangerSoft : colors.blueSoft,
          borderColor: danger ? colors.dangerLine : rgb(0.82, 0.86, 0.95),
          borderWidth: 0.6,
        });
        if (danger) page.drawRectangle({ x: margin, y: y - 32, width: 4, height: 32, color: colors.danger });
        page.drawText(fitText(region.name, bold, 9.5, width - margin * 2 - 140), { x: margin + 11, y: y - 20, size: 9.5, font: bold, color: danger ? colors.danger : colors.blueDark });
        const groupSummary = `${formatNumber(rows.reduce((sum, row) => sum + row.registrations, 0))} inscrições`;
        page.drawText(groupSummary, { x: width - margin - bold.widthOfTextAtSize(groupSummary, 9) - 10, y: y - 20, size: 9, font: bold, color: danger ? colors.danger : colors.blue });
        y -= 40;
        const table = congregationRows(rows, report, false);
        drawTable(table.columns, table.rows, `Congregações - ${region.name}`);
      }
    }
  }

  if (report.config.sections.showRoles) {
    beginListSection("Inscrições por cargos");
    if (report.roles.length) {
      drawTable(
        [
          { key: "name", label: "Cargo", weight: 4 },
          { key: "registrations", label: "Inscrições", weight: 1, align: "right" },
        ],
        report.roles.map((role) => ({ cells: { name: role.name, registrations: formatNumber(role.registrations) } })),
        "Inscrições por cargos",
      );
    } else {
      drawEmpty("Nenhum cargo possui inscrições para a configuração selecionada.");
    }
  }

  if (report.config.sections.showGenders) {
    beginListSection("Inscrições por sexo");
    if (report.genders.length) {
      drawTable(
        [
          { key: "name", label: "Sexo", weight: 4 },
          { key: "registrations", label: "Inscrições", weight: 1, align: "right" },
        ],
        report.genders.map((gender) => ({ cells: { name: gender.name, registrations: formatNumber(gender.registrations) } })),
        "Inscrições por sexo",
      );
    } else {
      drawEmpty("Nenhuma inscrição possui informação de sexo para a configuração selecionada.");
    }
  }

  const filteredReport = report.activeFilterCount > 0;
  const showsQuotaComparison = (report.config.sections.showRegions && (report.config.columns.regionalQuota || report.config.columns.regionalPercentage))
    || (report.config.sections.showCongregations && (report.config.columns.congregationQuota || report.config.columns.congregationPercentage));
  if (filteredReport && showsQuotaComparison) {
    drawParagraphBox("Observação: as metas apresentadas correspondem às metas gerais definidas para o evento e não aos filtros específicos deste relatório.", true);
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
