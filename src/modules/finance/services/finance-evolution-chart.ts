import "server-only";
import { rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { FinanceInformativeReportDocument } from "../types/finance-informative-report.types";
import { formatFinanceMonth } from "../utils/finance-period";
import { formatMoney } from "../utils/finance-money";

const green = rgb(0.02, 0.4, 0.28);
const red = rgb(0.6, 0.23, 0.26);
const orange = rgb(0.7, 0.36, 0.08);
const muted = rgb(0.34, 0.4, 0.38);
export const FINANCE_CHART_MONTHS = 12;

export function drawFinanceEvolutionChart({
  page,
  months,
  startIndex,
  x,
  top,
  width,
  height,
  regular,
  bold,
}: {
  page: PDFPage;
  months: FinanceInformativeReportDocument["months"];
  startIndex: number;
  x: number;
  top: number;
  width: number;
  height: number;
  regular: PDFFont;
  bold: PDFFont;
}) {
  const block = months.slice(startIndex, startIndex + FINANCE_CHART_MONTHS);
  const series = [
    {
      label: "Entradas",
      color: green,
      values: block.map(({ summary }) => summary.incomeCents),
    },
    {
      label: "Saídas",
      color: orange,
      values: block.map(({ summary }) => summary.expenseCents),
    },
  ];

  // Every block uses the full period's scale so heights can be compared across pages.
  const values = months.flatMap(({ summary }) => [
    summary.incomeCents,
    summary.expenseCents,
  ]);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);

  page.drawText("Evolução financeira mensal", {
    x,
    y: top - 13,
    size: 12,
    font: bold,
    color: green,
  });
  page.drawText(
    `${formatFinanceMonth(block[0].month)} a ${formatFinanceMonth(block.at(-1)!.month)} · Valores em reais`,
    { x, y: top - 30, size: 9, font: regular, color: muted },
  );
  let legendX = x;
  for (const item of series) {
    page.drawRectangle({
      x: legendX,
      y: top - 53,
      width: 10,
      height: 10,
      color: item.color,
    });
    page.drawText(item.label, {
      x: legendX + 16,
      y: top - 52,
      size: 9,
      font: regular,
      color: muted,
    });
    legendX += regular.widthOfTextAtSize(item.label, 9) + 44;
  }

  // Include zero and choose readable grid intervals, including all-zero periods.
  const target = (max - min || 100) / 4;
  const magnitude = 10 ** Math.floor(Math.log10(target));
  const step = Math.max(
    1,
    [1, 2, 5, 10].find((factor) => factor * magnitude >= target)! * magnitude,
  );
  const lower = Math.floor(min / step) * step;
  const upper = Math.ceil((max || (min === 0 ? 100 : 0)) / step) * step;
  const tickCount = Math.round((upper - lower) / step);
  const ticks = Array.from({ length: tickCount + 1 }, (_, index) =>
    Math.round(lower + step * index),
  );
  const tickLabels = ticks.map(formatMoney);
  const labelWidth = Math.max(
    ...tickLabels.map((label) => regular.widthOfTextAtSize(label, 8)),
  );
  const plotLeft = x + labelWidth + 14;
  const plotRight = x + width - 8;
  const plotTop = top - 90;
  const plotBottom = top - height + 45;
  const pointY = (value: number) =>
    plotBottom + ((value - lower) * (plotTop - plotBottom)) / (upper - lower);
  const zeroY = pointY(0);

  ticks.forEach((value, index) => {
    const y = pointY(value);
    page.drawText(tickLabels[index], {
      x: plotLeft - 9 - regular.widthOfTextAtSize(tickLabels[index], 8),
      y: y - 3,
      size: 8,
      font: regular,
      color: value < 0 ? red : muted,
    });
    page.drawLine({
      start: { x: plotLeft, y },
      end: { x: plotRight, y },
      thickness: value === 0 ? 1 : 0.5,
      color: value === 0 ? muted : rgb(0.89, 0.91, 0.9),
    });
  });

  const groupWidth = (plotRight - plotLeft) / block.length;
  const barWidth = Math.min(32, (groupWidth - 12) / 2);
  for (let index = 0; index < block.length; index++) {
    const center = plotLeft + groupWidth * (index + 0.5);
    const month = formatFinanceMonth(block[index].month);
    page.drawText(month, {
      x: center - regular.widthOfTextAtSize(month, 8) / 2,
      y: plotBottom - 36,
      size: 8,
      font: regular,
      color: muted,
    });
    series.forEach((item, seriesIndex) => {
      const value = item.values[index];
      const endY = pointY(value);
      const left = center + (seriesIndex - 1) * (barWidth + 2) + 1;
      const color = value < 0 ? red : item.color;
      page.drawRectangle({
        x: left,
        y: Math.min(zeroY, endY),
        width: barWidth,
        height: Math.abs(endY - zeroY),
        color,
        opacity: 0.9,
      });
      const label = formatMoney(value);
      const size = Math.min(
        8,
        (groupWidth - 6) / regular.widthOfTextAtSize(label, 1),
      );
      // Stack the full currency labels within each month to prevent overlap.
      const pair = series.map((entry) => entry.values[index]);
      const labelY =
        value < 0
          ? pointY(Math.min(0, ...pair)) - size - 3 - seriesIndex * 11
          : pointY(Math.max(0, ...pair)) + 4 + (1 - seriesIndex) * 11;
      page.drawText(label, {
        x: center - regular.widthOfTextAtSize(label, size) / 2,
        y: labelY,
        size,
        font: regular,
        color,
      });
    });
  }
}
