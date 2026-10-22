import "server-only";
import type {
  RankingDocument,
  DeliveryDocument,
} from "../types/finance-administrative.types";
import { deliveryTimeliness } from "../utils/finance-administrative";
import { financeMonthIndex } from "../validations/finance-informative-report.schemas";
import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFPage, type PDFImage } from "pdf-lib";
import sharp from "sharp";
import type { FinanceInformativeReportDocument } from "../types/finance-informative-report.types";
import { formatFinanceMonth } from "../utils/finance-period";
import type { FinanceReportDocument } from "../types/finance-report.types";
import { wrapReportText } from "../utils/finance-report-layout";
import { formatMoney } from "../utils/finance-money";
import { groupReportClassifications } from "../utils/finance-report-groups";
const W = 595.28,
  H = 841.89,
  M = 34.02,
  CW = W - M * 2,
  BOTTOM = H - 49;
const ink = rgb(0.09, 0.19, 0.16),
  muted = rgb(0.34, 0.4, 0.38),
  green = rgb(0.02, 0.4, 0.28),
  red = rgb(0.6, 0.23, 0.26),
  line = rgb(0.89, 0.91, 0.9),
  pale = rgb(0.96, 0.975, 0.967);
let fontBytes: Promise<Buffer[]> | undefined;
function fonts() {
  return (fontBytes ??= Promise.all(
    ["Rubik-400.ttf", "Rubik-600.ttf"].map((f) =>
      readFile(path.join(process.cwd(), "public/fonts/credential", f)),
    ),
  ));
}
export async function createFinanceReportPdf(
  data:
    | FinanceReportDocument
    | FinanceInformativeReportDocument
    | RankingDocument
    | DeliveryDocument,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const [r, b] = await fonts();
  const regular = await doc.embedFont(r, { subset: true }),
    bold = await doc.embedFont(b, { subset: true });
  const globalReport = data.type === "RANKING" || data.type === "DELIVERIES";
  const kind =
    data.type === "RANKING"
      ? "Informativo geral"
      : data.type === "DELIVERIES"
        ? "Entrega de relatórios"
        : data.type === "INFORMATIVE"
          ? "Informativo"
          : data.type === "ANALYTIC"
            ? "Analítico"
            : "Sintético";
  const analytic = data.type === "ANALYTIC";
  const month =
    data.type === "INFORMATIVE" || data.type === "RANKING"
      ? `${formatFinanceMonth(data.startMonth)} a ${formatFinanceMonth(data.endMonth)}`
      : new Date(`${data.month}-15T12:00:00Z`).toLocaleDateString("pt-BR", {
          month: "long",
          year: "numeric",
          timeZone: "UTC",
        });
  doc.setTitle(`Relatório ${kind} · ${data.congregationName} · ${month}`);
  doc.setAuthor(data.church.name);
  doc.setCreator("Eclesias");
  let activeCashboxName = "";
  let activeBankDetails = "";
  const bankDescription = (box: FinanceReportDocument["cashboxes"][number]) => {
    const bank = box.bankDetails;
    return bank
      ? [
          bank.bankName?.trim(),
          bank.agency?.trim() ? `Agência ${bank.agency.trim()}` : null,
          bank.accountNumber?.trim()
            ? `Conta ${bank.accountNumber.trim()}`
            : null,
        ]
          .filter(Boolean)
          .join(" · ")
      : "";
  };
  let page: PDFPage,
    y = M;
  const wrap = (text: string, width: number, size = 9, font = regular) =>
    wrapReportText(text, width, (s) => font.widthOfTextAtSize(s, size));
  function draw(
    text: string,
    x: number,
    top: number,
    size = 9,
    font = regular,
    color = ink,
  ) {
    if (text) page.drawText(text, { x, y: H - top - size, size, font, color });
  }
  function rule(top: number) {
    page.drawLine({
      start: { x: M, y: H - top },
      end: { x: W - M, y: H - top },
      thickness: 0.5,
      color: line,
    });
  }
  function roundedSurface(
    x: number,
    top: number,
    width: number,
    height: number,
    color: ReturnType<typeof rgb>,
  ) {
    const r = 4;
    page.drawSvgPath(
      `M ${r},0 H ${width - r} Q ${width},0 ${width},${r} V ${height - r} Q ${width},${height} ${width - r},${height} H ${r} Q 0,${height} 0,${height - r} V ${r} Q 0,0 ${r},0 Z`,
      {
        x,
        y: H - top,
        color,
      },
    );
  }
  function newPage(first = false) {
    page = doc.addPage([W, H]);
    y = M;
    if (!first) {
      for (const l of wrap(data.church.name, CW, 9, bold)) {
        draw(l, M, y, 9, bold);
        y += 12;
      }
      for (const l of wrap(
        `${kind} · ${data.congregationName} · ${month}`,
        CW,
        8.5,
      )) {
        draw(l, M, y, 8.5, regular, muted);
        y += 11;
      }
      if (activeCashboxName) {
        for (const l of wrap(activeCashboxName, CW, 8, bold)) {
          draw(l, M, y, 8, bold, muted);
          y += 11;
        }
      }
      if (activeBankDetails) {
        for (const l of wrap(activeBankDetails, CW, 7)) {
          draw(l, M, y, 7, regular, muted);
          y += 10;
        }
      }
      y += 5;
      rule(y);
      y += 14;
    }
  }
  function ensure(height: number) {
    if (y + height > BOTTOM) newPage();
  }
  function paragraph(text: string, size = 9, color = muted, gap = 7) {
    for (const l of wrap(text, CW, size)) {
      ensure(size + 5);
      draw(l, M, y, size, regular, color);
      y += size + 4;
    }
    y += gap;
  }
  function heading(text: string, color = ink, reserve = 65) {
    ensure(reserve);
    y += 9;
    draw(text, M, y, 11, bold, color);
    y += 22;
  }
  type TableOptions = {
    title: string;
    headers: string[];
    widths: number[];
    right?: number[];
    color?: ReturnType<typeof rgb>;
    keepAfter?: number;
    bodySize?: number;
    columnColors?: Record<number, ReturnType<typeof rgb>>;
    rowStyles?: {
      indent?: number;
      gap?: number;
      keepNext?: boolean;
      continuationGroup?: string;
    }[];
  };
  type Cell = string | { text: string; bold?: boolean }[];
  function table(options: TableOptions, rows: Cell[][]) {
    const {
      title,
      headers,
      widths,
      right = [],
      color = ink,
      keepAfter = analytic ? 37 : 10,
      rowStyles = [],
      bodySize = 7.5,
      columnColors = {},
    } = options;
    const headerSize = 7;
    const leading = 10;
    const padding = analytic ? 8 : 6;
    function header(continued = false) {
      ensure(49);
      if (continued) {
        for (const l of wrap(`${title} · continuação`, CW, 9, bold)) {
          draw(l, M, y, 9, bold, color);
          y += 12;
        }
        y += 6;
      }
      const lines = headers.map((v, i) =>
        wrap(v, widths[i] - 12, headerSize, bold),
      );
      const hh = Math.max(...lines.map((l) => l.length)) * 11 + padding;
      page.drawRectangle({
        x: M,
        y: H - y - hh,
        width: CW,
        height: hh,
        color: pale,
      });
      let x = M;
      lines.forEach((ls, i) => {
        ls.forEach((l, j) =>
          draw(
            l,
            right.includes(i)
              ? x + widths[i] - 6 - bold.widthOfTextAtSize(l, headerSize)
              : x + 6,
            y + padding / 2 + j * 11,
            headerSize,
            bold,
            muted,
          ),
        );
        x += widths[i];
      });
      y += hh;
    }
    header();
    const cellLines = (row: Cell[], indent = 0) =>
      row.map((v, i) =>
        (typeof v === "string" ? [{ text: v }] : v).flatMap((part) => {
          const font = "bold" in part && part.bold ? bold : regular;
          return wrap(
            part.text,
            widths[i] - 12 - (i === 0 ? indent : 0),
            bodySize,
            font,
          ).map((text) => ({ text, font }));
        }),
      );
    for (const [rowIndex, row] of rows.entries()) {
      const style = rowStyles[rowIndex];
      const indent = style?.indent ?? 0;
      const cells = cellLines(row, indent);
      const totalLines = Math.max(...cells.map((ls) => ls.length));
      let nextHeight = 0;
      for (
        let next = rowIndex + 1;
        rowStyles[next - 1]?.keepNext && rows[next];
        next++
      ) {
        nextHeight +=
          Math.max(
            ...cellLines(rows[next], rowStyles[next]?.indent).map(
              (ls) => ls.length,
            ),
          ) *
            leading +
          padding +
          (rowStyles[next]?.gap ?? 0) +
          (next === rows.length - 1 ? keepAfter : 0);
      }
      const continuation = () => {
        header(true);
        if (style?.continuationGroup) {
          for (const l of wrap(
            `${style.continuationGroup} · continuação`,
            widths[0] - 12,
            bodySize,
            bold,
          )) {
            draw(l, M + 6, y + 3, bodySize, bold);
            y += leading;
          }
          y += padding;
        }
      };
      let offset = 0;
      // Keep ordinary rows intact; split only a row larger than a whole page.
      if (
        y +
          totalLines * leading +
          padding +
          nextHeight +
          (style?.gap ?? 0) +
          (rowIndex === rows.length - 1 ? keepAfter : 0) >
          BOTTOM &&
        totalLines * leading + padding < 620
      ) {
        newPage();
        continuation();
      }
      y += style?.gap ?? 0;
      while (offset < totalLines) {
        if (BOTTOM - y < 30) {
          newPage();
          continuation();
        }
        const count = Math.min(
          totalLines - offset,
          Math.floor((BOTTOM - y - padding) / leading),
        );
        let x = M;
        cells.forEach((ls, i) => {
          ls.slice(offset, offset + count).forEach(({ text: l, font }, j) =>
            draw(
              l,
              right.includes(i)
                ? x + widths[i] - 6 - font.widthOfTextAtSize(l, bodySize)
                : x + 6 + (i === 0 ? indent : 0),
              y + padding / 2 + j * leading,
              bodySize,
              font,
              columnColors[i] ?? (i === row.length - 1 ? color : ink),
            ),
          );
          x += widths[i];
        });
        y += count * leading + padding;
        rule(y);
        offset += count;
        if (offset < totalLines) {
          newPage();
          const cellText = (cell: Cell) =>
            typeof cell === "string"
              ? cell
              : cell.map((p) => p.text).join("\n");
          paragraph(
            `Continuação: ${cellText(row[0])} · ${cellText(row[1] ?? "").split("\n")[0]}`,
            8.5,
            muted,
            3,
          );
          continuation();
        }
      }
    }
    y += 8;
  }
  function band(
    label: string,
    color: ReturnType<typeof rgb>,
    amount?: number,
    cashbox?: string,
    bankDetails?: string,
    followingHeight = analytic ? 97 : 75,
  ) {
    const boxLines = cashbox ? wrap(cashbox, CW * 0.65, 9, bold) : [];
    const detailLines = bankDetails ? wrap(bankDetails, CW * 0.65, 7) : [];
    const height = Math.max(
      26,
      boxLines.length * 12 + detailLines.length * 10 + 14,
    );
    ensure(amount === undefined ? height + followingHeight : height + 4);
    const tint =
      color === red ? rgb(0.985, 0.953, 0.955) : rgb(0.935, 0.97, 0.952);
    roundedSurface(M, y, CW, height, tint);
    if (amount === undefined) {
      page.drawLine({
        start: { x: M + 1.5, y: H - y - 7 },
        end: { x: M + 1.5, y: H - y - height + 7 },
        thickness: 2,
        color,
      });
    } else rule(y);

    boxLines.forEach((l, i) =>
      draw(
        l,
        W - M - 9 - bold.widthOfTextAtSize(l, 9),
        y + 8 + i * 12,
        9,
        bold,
        color,
      ),
    );
    detailLines.forEach((l, i) =>
      draw(
        l,
        W - M - 9 - regular.widthOfTextAtSize(l, 7),
        y + 8 + boxLines.length * 12 + i * 10,
        7,
        regular,
        muted,
      ),
    );
    draw(
      label.toLocaleUpperCase("pt-BR"),
      M + 9,
      y + 8,
      amount === undefined ? 9.5 : 9,
      bold,
      color,
    );
    if (amount !== undefined) {
      const value = formatMoney(amount);
      draw(
        value,
        W - M - 9 - bold.widthOfTextAtSize(value, 10),
        y + 8,
        10,
        bold,
        color,
      );
    }
    y += height + 8;
  }
  function subtotal(
    label: string,
    amount: number,
    color: ReturnType<typeof rgb>,
  ) {
    const value = formatMoney(amount);
    const valueWidth = bold.widthOfTextAtSize(value, 8);
    const lines = wrap(label, CW - valueWidth - 26, 8, bold);
    const height = Math.max(22, lines.length * 11 + 10);
    ensure(height);
    lines.forEach((l, i) =>
      draw(
        l,
        W - M - 20 - valueWidth - bold.widthOfTextAtSize(l, 8),
        y + 4 + i * 11,
        8,
        bold,
        muted,
      ),
    );
    draw(value, W - M - 6 - valueWidth, y + 4, 8, bold, color);
    y += height;
  }

  function groupHeading(text: string, size: number, gap: number, after = 70) {
    const lines = wrap(text, CW, size, bold);
    ensure(gap + lines.length * (size + 4) + 8 + after);
    y += gap;
    for (const l of lines) {
      draw(l, M, y, size, bold);
      y += size + 4;
    }
    y += 6;
  }
  function finish() {
    const issued = new Date(data.generatedAt).toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
    });
    doc.getPages().forEach((p, i) => {
      page = p;
      rule(H - 37);
      draw(
        `Emissão ${data.emissionId.slice(0, 8)} · ${issued}`,
        M,
        H - 28,
        8,
        regular,
        muted,
      );
      const label = `Página ${i + 1} de ${doc.getPageCount()}`;
      draw(
        label,
        W - M - regular.widthOfTextAtSize(label, 8),
        H - 28,
        8,
        regular,
        muted,
      );
    });
    return doc.save();
  }
  newPage(true);
  let logoWidth = 0;
  let logo: { image: PDFImage; width: number; height: number } | null = null;
  if (data.church.logoDataUri) {
    const match =
      /^data:image\/(?:png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(
        data.church.logoDataUri,
      );
    if (match)
      try {
        const png = await sharp(Buffer.from(match[1], "base64"), {
          limitInputPixels: 20_000_000,
        })
          .resize(300, 300, { fit: "inside", withoutEnlargement: true })
          .png()
          .toBuffer();
        const image = await doc.embedPng(png),
          dimensions = image.scaleToFit(42, 42);
        logo = { image, ...dimensions };
        logoWidth = 55;
      } catch {
        /* A missing or invalid logo must not prevent a financial report. */
      }
  }
  const titleX = M + logoWidth;
  const churchLines = wrap(data.church.name, CW - logoWidth, 12, bold);
  const identityLines = wrap(
    [
      data.church.city,
      data.church.document ? `CNPJ ${data.church.document}` : null,
    ]
      .filter(Boolean)
      .join(" · "),
    CW - logoWidth,
    8.5,
  );
  const addressLines = globalReport
    ? []
    : wrap(
        data.congregationAddress
          ? `Endereço: ${data.congregationAddress}`
          : "Endereço não informado",
        CW - logoWidth,
        8,
      );
  const identityHeight =
    churchLines.length * 16 +
    identityLines.length * 12 +
    addressLines.length * 11;
  const headerHeight = Math.max(identityHeight, 42);
  if (logo)
    page!.drawImage(logo.image, {
      x: M,
      y: H - M - logo.height - (headerHeight - logo.height) / 2,
      width: logo.width,
      height: logo.height,
    });
  y += (headerHeight - identityHeight) / 2;
  for (const l of churchLines) {
    draw(l, titleX, y, 12, bold);
    y += 16;
  }
  for (const l of identityLines) {
    draw(l, titleX, y, 8.5, regular, muted);
    y += 12;
  }
  for (const l of addressLines) {
    draw(l, titleX, y, 8, regular, muted);
    y += 11;
  }
  y = M + headerHeight + 12;
  rule(y);
  y += 17;
  {
    const titleLines = wrap(
      data.type === "DELIVERIES"
        ? "ENTREGA DE RELATÓRIOS"
        : `RELATÓRIO FINANCEIRO ${kind.toLocaleUpperCase("pt-BR")}`,
      data.type === "INFORMATIVE" || globalReport ? CW - 236 : CW,
      10,
      bold,
    );
    titleLines.forEach((l, i) => draw(l, M, y + i * 13, 10, bold));
    const unitLines = wrap(data.congregationName, 220, 9, bold);
    unitLines.forEach((l, i) =>
      draw(l, W - M - bold.widthOfTextAtSize(l, 9), y + i * 12, 9, bold),
    );
    draw(
      month,
      W - M - regular.widthOfTextAtSize(month, 8),
      y + unitLines.length * 12,
      8,
      regular,
      muted,
    );
    y += Math.max(30, titleLines.length * 13 + 10, unitLines.length * 12 + 23);
  }
  if (data.type === "RANKING") {
    const money = (value: number) => formatMoney(value).replace(/R\$\s*/, "");
    const months =
      financeMonthIndex(data.endMonth) - financeMonthIndex(data.startMonth) + 1;
    const optional = (value: number, missing: number, stale = false) =>
      missing === months
        ? "Não disponível"
        : `${money(value)}${missing ? " (parcial)" : ""}${stale ? "*" : ""}`;
    const headers = [
      "Congregação",
      "Entradas",
      "Saídas",
      "Saldo final",
      ...(data.includeTransfer ? ["Repasse"] : []),
      ...(data.includePrebend ? ["Prebenda bruta"] : []),
    ];
    band("Ranking por entradas", green);
    table(
      {
        title: "Ranking por entradas",
        headers,
        widths: [
          165,
          ...Array(headers.length - 1).fill((CW - 165) / (headers.length - 1)),
        ],
        right: headers.map((_, i) => i).slice(1),
        bodySize: headers.length === 6 ? 7 : 7.5,
        columnColors: { 1: green, 2: red },
      },
      [
        ...data.rows.map((row) => [
          `${row.name}${row.status !== "ACTIVE" ? " · Inativa" : ""}`,
          money(row.incomeCents),
          money(row.expenseCents),
          money(row.closingCents),
          ...(data.includeTransfer
            ? [
                optional(
                  row.transferCents,
                  row.missingMonths,
                  row.staleMonths.length > 0,
                ),
              ]
            : []),
          ...(data.includePrebend
            ? [
                optional(
                  row.grossPrebendCents,
                  row.missingMonths,
                  row.staleMonths.length > 0,
                ),
              ]
            : []),
        ]),
        [
          "Total geral",
          money(data.totals.incomeCents),
          money(data.totals.expenseCents),
          money(data.totals.closingCents),
          ...(data.includeTransfer
            ? [
                `${money(data.totals.transferCents)}${data.totals.missingMonths ? " (parcial)" : ""}`,
              ]
            : []),
          ...(data.includePrebend
            ? [
                `${money(data.totals.grossPrebendCents)}${data.totals.missingMonths ? " (parcial)" : ""}`,
              ]
            : []),
        ].map((text) => [{ text, bold: true }]),
      ],
    );
    if (!data.rows.length)
      paragraph(
        "Nenhuma congregação encontrada para os filtros selecionados.",
        8,
      );
    if (data.includePrebend || data.includeTransfer) {
      if (data.totals.missingMonths)
        paragraph(
          "Valores e totais parciais: há meses sem demonstrativo. Não disponível indica ausência em todo o período.",
          8,
        );
      if (data.rows.some((r) => r.staleMonths.length))
        paragraph("* Inclui valores de demonstrativos desatualizados.", 8);
    }
    return finish();
  }
  if (data.type === "DELIVERIES") {
    const date = (v: string) => v.split("-").reverse().join("/");
    const label = {
      ALL: "Todas",
      DELIVERED: "Entregues",
      PENDING: "Não entregues",
    }[data.filter];
    band(`Entrega de relatórios · ${label}`, green);
    paragraph(
      `Prazo: ${date(data.dueDate)}${data.includeInactive ? " · Inclui inativas" : ""}${data.search ? ` · Busca: ${data.search}` : ""}`,
      8,
    );
    table(
      {
        title: "Entrega de relatórios",
        headers: ["Congregação", "Situação", "Data da entrega", "Prazo"],
        widths: [220, 95, 105, CW - 420],
      },
      data.rows.map((row) => [
        `${row.name}${row.status !== "ACTIVE" ? " · Inativa" : ""}`,
        row.deliveryDate ? "Entregue" : "Não entregue",
        row.deliveryDate ? date(row.deliveryDate) : "—",
        deliveryTimeliness(row.deliveryDate, data.dueDate, data.today),
      ]),
    );
    if (!data.rows.length)
      paragraph(
        "Nenhuma congregação encontrada para os filtros selecionados.",
        8,
      );
    const delivered = data.rows.filter((r) => r.deliveryDate).length;
    paragraph(
      `Total: ${data.rows.length} congregações · Entregues: ${delivered} · Não entregues: ${data.rows.length - delivered}`,
      8,
    );
    return finish();
  }
  const s = data.summary;
  const metrics = [
    [
      data.type === "INFORMATIVE" ? "Saldo inicial" : "Saldo anterior",
      s.openingCents,
    ],
    ["Entradas", s.incomeCents],
    ["Saídas", s.expenseCents],
    ["Saldo final", s.closingCents],
  ] as const;
  function indicators() {
    ensure(62);
    metrics.forEach(([label, value], i) => {
      const width = CW / 4,
        x = M + i * width;
      roundedSurface(x, y, width - 5, 53, pale);
      draw(label, x + 8, y + 8, 8.5, regular, muted);
      const text = formatMoney(value),
        size = bold.widthOfTextAtSize(text, 11) > width - 16 ? 9 : 11;
      draw(
        text,
        x + 8,
        y + 27,
        size,
        bold,
        i === 2 ? red : i === 1 ? green : ink,
      );
    });
    y += 63;
  }
  if (data.type === "INFORMATIVE") {
    const headers = [
      "Mês",
      "Saldo inicial",
      "Entradas",
      "Saídas",
      ...(data.includePrebend ? ["Prebenda bruta"] : []),
      ...(data.includeTransfer ? ["Repasse"] : []),
      "Saldo final",
    ];
    const money = (value: number) => formatMoney(value).replace(/R\$\s*/, "");
    const calculated = (value: number | null | undefined, stale: boolean) =>
      value === null || value === undefined
        ? "Não disponível"
        : `${money(value)}${stale ? "*" : ""}`;
    band("Evolução Mensal", green);
    table(
      {
        title: "Evolução mensal",
        headers,
        widths: [
          58,
          ...Array(headers.length - 1).fill((CW - 58) / (headers.length - 1)),
        ],
        right: headers.map((_, i) => i).slice(1),
        bodySize: headers.length === 7 ? 7 : 7.5,
        columnColors: { 2: green, 3: red },
      },
      data.months.map((row) => [
        formatFinanceMonth(row.month),
        money(row.summary.openingCents),
        money(row.summary.incomeCents),
        money(row.summary.expenseCents),
        ...(data.includePrebend
          ? [
              calculated(
                row.statement?.grossPrebendCents,
                row.statement?.stale ?? false,
              ),
            ]
          : []),
        ...(data.includeTransfer
          ? [
              calculated(
                row.statement?.transferCents,
                row.statement?.stale ?? false,
              ),
            ]
          : []),
        money(row.summary.closingCents),
      ]),
    );
    if (data.includePrebend || data.includeTransfer) {
      if (data.months.some((row) => !row.statement))
        paragraph(
          "Não disponível: demonstrativo ainda não gerado para o mês.",
          8,
          muted,
          5,
        );
      const stale = data.months
        .filter((row) => row.statement?.stale)
        .map(
          (row) =>
            `${formatFinanceMonth(row.month)} (versão ${row.statement!.revision})`,
        );
      if (stale.length)
        paragraph(
          `* Demonstrativo desatualizado: ${stale.join(", ")}. Os valores calculados preservam essa versão; entradas, saídas e saldos refletem os registros atuais.`,
          8,
          muted,
          5,
        );
    }
    return finish();
  }
  indicators();
  y += 20;
  const directions = ["INCOME", "EXPENSE"] as const;
  const sections = data.cashboxes.flatMap((box) =>
    directions.map((direction) => ({ direction, box })),
  );
  if (!analytic && !sections.length)
    paragraph("Nenhuma movimentação registrada no período.", 7.5);
  for (const [sectionIndex, { direction, box }] of sections.entries()) {
    if (direction === "INCOME") {
      activeCashboxName = box?.name ?? "";
      activeBankDetails = box ? bankDescription(box) : "";
      if (analytic && sectionIndex > 0) newPage();
      else if (!analytic && sectionIndex > 0) {
        y += 12;
        rule(y);
        y += 8;
      }
    }
    const name = direction === "INCOME" ? "Entradas" : "Saídas",
      color = direction === "INCOME" ? green : red;
    y += direction === "EXPENSE" ? (analytic ? 16 : 12) : 8;
    const populated = (
      data.type === "ANALYTIC" ? data.rows : data.cashboxCategories
    ).some((row) => row.direction === direction && row.cashboxId === box.id);
    if (!populated) {
      band(name, color, undefined, box.name, activeBankDetails, 44);
      paragraph(
        `Nenhuma ${direction === "INCOME" ? "entrada registrada" : "saída registrada"} no período.`,
        8,
        muted,
        4,
      );
      draw(
        `TOTAL DE ${name.toLocaleUpperCase("pt-BR")}`,
        M + 6,
        y,
        8,
        bold,
        muted,
      );
      const amount = formatMoney(
        direction === "INCOME" ? box.incomeCents : box.expenseCents,
      );
      draw(
        amount,
        W - M - 6 - bold.widthOfTextAtSize(amount, 9),
        y,
        9,
        bold,
        muted,
      );
      y += 22;
      continue;
    }
    if (data.type === "SYNTHETIC") {
      const categories = data.cashboxCategories.filter(
        (c) => c.direction === direction && c.cashboxId === box.id,
      );
      if (!categories.length) {
        band(name, color, undefined, box.name, activeBankDetails);
        paragraph(
          `Nenhuma ${direction === "INCOME" ? "entrada registrada" : "saída registrada"} no período.`,
          9,
        );
      } else {
        const categoryRows: Cell[][] = [];
        const rowStyles: NonNullable<TableOptions["rowStyles"]> = [];
        for (const group of Map.groupBy(
          categories,
          (c) => c.categoryId,
        ).values()) {
          const names = [...new Set(group.map((c) => c.categoryName))].join(
            " / ",
          );
          const amount = group.reduce((sum, c) => sum + c.amountCents, 0);
          const classified = group.some(
            (c) => c.classificationId || c.classificationName,
          );
          const gap = categoryRows.length ? 10 : 0;
          if (classified) {
            categoryRows.push([[{ text: names, bold: true }], ""]);
            rowStyles.push({ gap, keepNext: true });
            const classifications = groupReportClassifications(group);
            for (const [index, classification] of classifications.entries()) {
              categoryRows.push([
                classification.name,
                formatMoney(classification.totalCents),
              ]);
              rowStyles.push({
                indent: 12,
                keepNext: index === classifications.length - 1,
                continuationGroup: names,
              });
            }
            categoryRows.push([
              [{ text: `Subtotal ${names}`, bold: true }],
              [{ text: formatMoney(amount), bold: true }],
            ]);
            rowStyles.push({ continuationGroup: names });
          } else {
            categoryRows.push([
              [{ text: names, bold: true }],
              [{ text: formatMoney(amount), bold: true }],
            ]);
            rowStyles.push({ gap });
          }
        }
        // Reserve the section header together with the first category and its
        // first classification (and subtotal when it is a single-row group).
        let firstRowsHeight = 8 + 17; // band gap + table header
        for (let i = 0; i < categoryRows.length; i++) {
          const height =
            Math.max(
              ...categoryRows[i].map((cell, column) =>
                (typeof cell === "string" ? [{ text: cell }] : cell).reduce(
                  (lines, part) =>
                    lines +
                    wrap(
                      part.text,
                      (column === 0
                        ? CW - 110 - (rowStyles[i]?.indent ?? 0)
                        : 110) - 12,
                      7.5,
                      "bold" in part && part.bold ? bold : regular,
                    ).length,
                  0,
                ),
              ),
            ) *
              10 +
            6;
          firstRowsHeight +=
            height +
            (rowStyles[i]?.gap ?? 0) +
            (i === categoryRows.length - 1 ? 32 : 0);
          if (!rowStyles[i]?.keepNext) break;
        }
        band(
          name,
          color,
          undefined,
          box.name,
          activeBankDetails,
          firstRowsHeight,
        );
        table(
          {
            title: `${name} · ${box.name}`,
            headers: ["Categoria / classificação", "Total"],
            widths: [CW - 110, 110],
            right: [1],
            color,
            rowStyles,
            keepAfter: 32,
          },
          categoryRows,
        );
      }
    } else {
      band(name, color, undefined, box?.name, activeBankDetails);
      const rows = data.rows.filter(
        (r) => r.direction === direction && r.cashboxId === box?.id,
      );
      if (!rows.length)
        paragraph(
          `Nenhuma ${direction === "INCOME" ? "entrada registrada" : "saída registrada"} no período.`,
          9,
        );
      const categoryGroups = [
        ...Map.groupBy(rows, (r) => r.categoryId).values(),
      ];
      const widths = [58, CW - 58 - 84 - 78 - 80, 84, 78, 80];
      const reportRows = (items: typeof rows): Cell[][] =>
        items.map((r) => [
          r.date.split("-").reverse().join("/"),
          [
            r.personName ||
              (direction === "INCOME"
                ? "Contribuição coletiva"
                : "Saída registrada"),
            r.description,
            r.documentNumber ? `Doc. ${r.documentNumber}` : null,
          ]
            .filter(Boolean)
            .join("\n"),
          r.departmentName,
          [{ text: r.paymentMethodName, bold: true }],
          formatMoney(r.amountCents),
        ]);
      const firstRowReserve = (row: Cell[]) => {
        const height =
          Math.max(
            ...row.map((cell, i) =>
              (typeof cell === "string" ? [{ text: cell }] : cell).reduce(
                (count, part) =>
                  count +
                  wrap(
                    part.text,
                    widths[i] - 12,
                    7.5,
                    "bold" in part && part.bold ? bold : regular,
                  ).length,
                0,
              ),
            ),
          ) *
            10 +
          8;
        return 19 + (height < 620 ? height : 34);
      };
      for (const [categoryIndex, group] of categoryGroups.entries()) {
        const names = [...new Set(group.map((r) => r.categoryName))].join(
          " / ",
        );
        const classified = group.some(
          (r) => r.classificationId || r.classificationName,
        );
        const classifications = groupReportClassifications(group);
        for (const [
          classificationIndex,
          classification,
        ] of classifications.entries()) {
          const tableRows = reportRows(classification.rows);
          const groupName = `${names}${classified ? ` — ${classification.name}` : ""}`;
          const lastGroup = classificationIndex === classifications.length - 1;
          const keepAfter =
            8 +
            Math.max(
              22,
              wrap(`Subtotal ${groupName}`, CW - 140, 8, bold).length * 11 + 10,
            ) +
            (lastGroup && categoryIndex === categoryGroups.length - 1 ? 32 : 0);
          // A single-row group must keep its heading, row and named subtotal together.
          groupHeading(
            groupName,
            9,
            10,
            firstRowReserve(tableRows[0]) +
              (tableRows.length === 1 ? keepAfter : 0),
          );
          table(
            {
              title: `${name} · ${names}${classified ? ` · ${classification.name}` : ""}`,
              headers: [
                "Data",
                "Pessoa / descrição",
                "Departamento",
                "Pagamento",
                "Valor",
              ],
              widths,
              right: [4],
              color,
              keepAfter,
            },
            tableRows,
          );
          subtotal(`Subtotal ${groupName}`, classification.totalCents, color);
        }
      }
    }
    const totals = box ?? s;
    const amount =
      direction === "INCOME" ? totals.incomeCents : totals.expenseCents;
    band(`Total de ${name}`, color, amount);
  }
  activeCashboxName = "";
  activeBankDetails = "";
  const notes = data.cashboxes.flatMap((b) => {
    const details = [
      b.openingMovementCents
        ? `abertura no mês ${formatMoney(b.openingMovementCents)}`
        : null,
      b.adjustmentCents ? `ajustes ${formatMoney(b.adjustmentCents)}` : null,
      b.transferNetCents
        ? `transferências líquidas ${formatMoney(b.transferNetCents)}`
        : null,
    ].filter(Boolean);
    return details.length ? [`${b.name}: ${details.join(" · ")}.`] : [];
  });
  const rowHeight = (cells: string[], widths: number[]) =>
    Math.max(
      ...cells.map((text, i) => wrap(text, widths[i] - 12, 7.5).length),
    ) *
      10 +
    (analytic ? 8 : 6);
  const balanceHeight = data.cashboxes.length
    ? 31 +
      (analytic ? 19 : 17) +
      8 +
      data.cashboxes.reduce(
        (sum, b) =>
          sum +
          rowHeight(
            [
              b.name,
              formatMoney(b.openingCents),
              formatMoney(b.incomeCents),
              formatMoney(b.expenseCents),
              formatMoney(b.closingCents),
            ],
            [CW - 380, 95, 95, 95, 95],
          ),
        0,
      )
    : 0;
  const departmentHeight =
    !analytic && data.departments.length
      ? 31 +
        17 +
        8 +
        data.departments.reduce(
          (sum, d) =>
            sum +
            rowHeight(
              [d.name, formatMoney(d.incomeCents), formatMoney(d.expenseCents)],
              [CW - 220, 110, 110],
            ),
          0,
        )
      : 0;
  const endingHeight =
    balanceHeight +
    departmentHeight +
    notes.reduce(
      (sum, note) => sum + wrap(note, CW, 8.5).length * 12.5 + 3,
      0,
    ) +
    130;
  // Long summaries can span pages; ordinary summaries stay with the final indicators.
  ensure(endingHeight <= 620 ? endingHeight : 90);
  if (!analytic && data.departments.length) {
    heading("Resumo por departamento", ink, 65);
    table(
      {
        title: "Resumo por departamento",
        headers: ["Departamento", "Entradas", "Saídas"],
        widths: [CW - 220, 110, 110],
        right: [1, 2],
      },
      data.departments.map((d) => [
        d.name,
        formatMoney(d.incomeCents),
        formatMoney(d.expenseCents),
      ]),
    );
  }
  if (data.cashboxes.length) {
    heading(
      analytic ? "Caixas e contas" : "Saldos por caixa",
      ink,
      analytic ? Math.min(200, 65 + data.cashboxes.length * 23) : 65,
    );
    table(
      {
        title: analytic ? "Caixas e contas" : "Saldos por caixa",
        headers: [
          "Caixa / conta",
          "Saldo anterior",
          "Entradas",
          "Saídas",
          "Saldo final",
        ],
        widths: [CW - 380, 95, 95, 95, 95],
        right: [1, 2, 3, 4],
      },
      data.cashboxes.map((b) => [
        b.name,
        formatMoney(b.openingCents),
        formatMoney(b.incomeCents),
        formatMoney(b.expenseCents),
        formatMoney(b.closingCents),
      ]),
    );
    for (const note of notes) paragraph(note, 8.5, muted, 3);
  }
  y += analytic ? 16 : 8;
  heading("Resumo final do período", ink, 106);
  indicators();
  paragraph(
    `${s.count} lançamento(s). Valores registrados até a emissão. Nova emissão pode refletir correções posteriores.`,
    8,
    muted,
    0,
  );
  return finish();
}
