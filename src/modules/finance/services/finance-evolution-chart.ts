import "server-only";
import { rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import type { FinanceInformativeReportDocument } from "../types/finance-informative-report.types";
import { formatFinanceMonth } from "../utils/finance-period";
import { formatMoney } from "../utils/finance-money";

const green = rgb(0.02, 0.4, 0.28);
const red = rgb(0.6, 0.23, 0.26);
const orange = rgb(0.7, 0.36, 0.08);
const blue = rgb(0.16, 0.34, 0.63);
const muted = rgb(0.34, 0.4, 0.38);

export function drawFinanceEvolutionChart({
  page,
  months,
  x,
  top,
  width,
  height,
  regular,
  bold,
}: {
  page: PDFPage;
  months: FinanceInformativeReportDocument["months"];
  x: number;
  top: number;
  width: number;
  height: number;
  regular: PDFFont;
  bold: PDFFont;
}) {
  const series = [
    {
      label: "Entradas",
      color: green,
      dash: [],
      values: months.map(({ summary }) => summary.incomeCents / 100),
    },
    {
      label: "Saídas",
      color: orange,
      dash: [5, 3],
      values: months.map(({ summary }) => summary.expenseCents / 100),
    },
    {
      label: "Resultado do mês",
      color: blue,
      dash: [2, 2],
      values: months.map(
        ({ summary }) => (summary.incomeCents - summary.expenseCents) / 100,
      ),
    },
  ];
  page.drawText("Evolução financeira mensal", {
    x,
    y: top - 13,
    size: 12,
    font: bold,
    color: green,
  });
  page.drawText("Resultado do mês = Entradas menos saídas", {
    x,
    y: top - 30,
    size: 9,
    font: regular,
    color: muted,
  });
  let legendX = x;
  for (const item of series) {
    page.drawLine({
      start: { x: legendX, y: top - 49 },
      end: { x: legendX + 23, y: top - 49 },
      thickness: 1.8,
      color: item.color,
      dashArray: item.dash,
    });
    page.drawText(item.label, {
      x: legendX + 29,
      y: top - 52,
      size: 9,
      font: regular,
      color: muted,
    });
    legendX += regular.widthOfTextAtSize(item.label, 9) + 54;
  }

  // Keep zero in the scale and use readable intervals, including all-zero periods.
  const values = series.flatMap((item) => item.values);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const target = (max - min || 1) / 4;
  const magnitude = 10 ** Math.floor(Math.log10(target));
  const step =
    [1, 2, 5, 10].find((factor) => factor * magnitude >= target)! * magnitude;
  const lower = Math.floor(min / step) * step;
  const upper = Math.ceil((max || (min === 0 ? 1 : 0)) / step) * step;
  const tickCount = Math.round((upper - lower) / step);
  const ticks = Array.from(
    { length: tickCount + 1 },
    (_, index) => lower + step * index,
  );
  const tickLabels = ticks.map((value) => formatMoney(Math.round(value * 100)));
  const labelWidth = Math.max(
    ...tickLabels.map((label) => regular.widthOfTextAtSize(label, 8)),
  );
  const plotLeft = x + labelWidth + 14;
  const plotRight = x + width - 30;
  const plotTop = top - 74;
  const plotBottom = top - height + 28;
  const pointX = (index: number) =>
    months.length === 1
      ? (plotLeft + plotRight) / 2
      : plotLeft + (index * (plotRight - plotLeft)) / (months.length - 1);
  const pointY = (value: number) =>
    plotBottom + ((value - lower) * (plotTop - plotBottom)) / (upper - lower);

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

  // Thin the labels, not the monthly data. Always label the first and last month.
  const monthLabelWidth = Math.max(
    ...months.map(({ month }) =>
      regular.widthOfTextAtSize(formatFinanceMonth(month), 8),
    ),
  );
  const labelIntervals = Math.min(
    months.length - 1,
    Math.floor((plotRight - plotLeft) / (monthLabelWidth + 20)),
  );
  const labelIndices =
    labelIntervals === 0
      ? [0]
      : Array.from({ length: labelIntervals + 1 }, (_, index) =>
          Math.round((index * (months.length - 1)) / labelIntervals),
        );
  for (const index of labelIndices) {
    const label = formatFinanceMonth(months[index].month);
    page.drawText(label, {
      x: pointX(index) - regular.widthOfTextAtSize(label, 8) / 2,
      y: plotBottom - 17,
      size: 8,
      font: regular,
      color: muted,
    });
  }
  for (const item of series) {
    for (let index = 0; index < item.values.length; index++) {
      const value = item.values[index];
      const point = { x: pointX(index), y: pointY(value) };
      if (index > 0) {
        const previous = item.values[index - 1];
        const start = { x: pointX(index - 1), y: pointY(previous) };
        const segment = (from: typeof start, to: typeof point, color: RGB) =>
          page.drawLine({
            start: from,
            end: to,
            thickness: 1.7,
            color,
            dashArray: item.dash,
          });
        if ((previous < 0 && value > 0) || (previous > 0 && value < 0)) {
          const zero = {
            x: start.x + (point.x - start.x) * (-previous / (value - previous)),
            y: pointY(0),
          };
          segment(start, zero, previous < 0 ? red : item.color);
          segment(zero, point, value < 0 ? red : item.color);
        } else {
          segment(start, point, previous < 0 || value < 0 ? red : item.color);
        }
      }
      page.drawCircle({
        x: point.x,
        y: point.y,
        size: 2.2,
        color: value < 0 ? red : item.color,
        borderColor: rgb(1, 1, 1),
        borderWidth: 0.6,
      });
    }
  }
}
