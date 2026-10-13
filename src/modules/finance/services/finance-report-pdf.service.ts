import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFPage } from "pdf-lib";
import sharp from "sharp";
import type { FinanceReportDocument } from "../types/finance-report.types";
import { wrapReportText } from "../utils/finance-report-layout";
import { formatMoney } from "../utils/finance-money";
const W = 595.28,
  H = 841.89,
  M = 34.02,
  CW = W - M * 2,
  BOTTOM = H - 49;
const ink = rgb(0.09, 0.19, 0.16),
  muted = rgb(0.34, 0.4, 0.38),
  green = rgb(0.02, 0.4, 0.28),
  red = rgb(0.62, 0.16, 0.19),
  line = rgb(0.85, 0.89, 0.87),
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
  data: FinanceReportDocument,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const [r, b] = await fonts();
  const regular = await doc.embedFont(r, { subset: true }),
    bold = await doc.embedFont(b, { subset: true });
  const kind = data.type === "ANALYTIC" ? "Analítico" : "Sintético";
  const month = new Date(`${data.month}-15T12:00:00Z`).toLocaleDateString(
    "pt-BR",
    { month: "long", year: "numeric", timeZone: "UTC" },
  );
  doc.setTitle(`Relatório ${kind} · ${data.congregationName} · ${data.month}`);
  doc.setAuthor(data.church.name);
  doc.setCreator("Eclesias");
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
  function heading(text: string, color = ink) {
    ensure(65);
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
  };
  function table(options: TableOptions, rows: string[][]) {
    const { title, headers, widths, right = [], color = ink } = options;
    function header(continued = false) {
      ensure(49);
      if (continued) {
        for (const l of wrap(`${title} · continuação`, CW, 9, bold)) {
          draw(l, M, y, 9, bold, color);
          y += 12;
        }
        y += 6;
      }
      const lines = headers.map((v, i) => wrap(v, widths[i] - 12, 8, bold));
      const hh = Math.max(...lines.map((l) => l.length)) * 11 + 12;
      page.drawRectangle({
        x: M,
        y: H - y - hh,
        width: CW,
        height: hh,
        color: pale,
      });
      let x = M;
      lines.forEach((ls, i) => {
        ls.forEach((l, j) => draw(l, x + 6, y + 6 + j * 11, 8, bold, muted));
        x += widths[i];
      });
      y += hh;
    }
    header();
    for (const [rowIndex, row] of rows.entries()) {
      const cells = row.map((v, i) => wrap(v, widths[i] - 12));
      const totalLines = Math.max(...cells.map((ls) => ls.length));
      let offset = 0;
      // Keep ordinary rows intact; split only a row larger than a whole page.
      if (
        y + totalLines * 12 + 12 + (rowIndex === rows.length - 1 ? 37 : 0) >
          BOTTOM &&
        totalLines * 12 + 12 < 620
      ) {
        newPage();
        header(true);
      }
      while (offset < totalLines) {
        if (BOTTOM - y < 30) {
          newPage();
          header(true);
        }
        const count = Math.min(
          totalLines - offset,
          Math.floor((BOTTOM - y - 12) / 12),
        );
        let x = M;
        cells.forEach((ls, i) => {
          ls.slice(offset, offset + count).forEach((l, j) =>
            draw(
              l,
              right.includes(i)
                ? x + widths[i] - 6 - regular.widthOfTextAtSize(l, 9)
                : x + 6,
              y + 6 + j * 12,
              9,
              regular,
              i === row.length - 1 ? color : ink,
            ),
          );
          x += widths[i];
        });
        y += count * 12 + 12;
        rule(y);
        offset += count;
        if (offset < totalLines) {
          newPage();
          paragraph(
            `Continuação: ${row[0]} · ${row[1]?.split("\n")[0] ?? ""}`,
            8.5,
            muted,
            3,
          );
          header(true);
        }
      }
    }
    y += 8;
  }
  function total(label: string, amount: number, color = ink) {
    ensure(29);
    const value = formatMoney(amount);
    draw(label, M + 6, y + 5, 9, bold, color);
    draw(
      value,
      W - M - 6 - bold.widthOfTextAtSize(value, 9),
      y + 5,
      9,
      bold,
      color,
    );
    y += 27;
  }
  newPage(true);
  let logoWidth = 0;
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
        page!.drawImage(image, {
          x: M,
          y: H - M - dimensions.height,
          ...dimensions,
        });
        logoWidth = 55;
      } catch {
        /* A missing or invalid logo must not prevent a financial report. */
      }
  }
  const titleX = M + logoWidth;
  for (const l of wrap(data.church.name, CW - logoWidth, 12, bold)) {
    draw(l, titleX, y, 12, bold);
    y += 16;
  }
  for (const l of wrap(
    [
      data.church.city,
      data.church.document ? `CNPJ ${data.church.document}` : null,
    ]
      .filter(Boolean)
      .join(" · "),
    CW - logoWidth,
    8.5,
  )) {
    draw(l, titleX, y, 8.5, regular, muted);
    y += 12;
  }
  y = Math.max(y, M + 42) + 12;
  rule(y);
  y += 17;
  draw(
    `Relatório financeiro ${kind.toLocaleLowerCase("pt-BR")}`,
    M,
    y,
    15,
    bold,
  );
  y += 24;
  paragraph(`${data.congregationName} · ${month}`, 10, ink, 3);
  paragraph(
    data.cashboxName
      ? `Caixa / conta: ${data.cashboxName}`
      : "Todos os caixas e contas da congregação",
    8.5,
    muted,
    8,
  );
  const s = data.summary;
  const metrics = [
    ["Saldo anterior", s.openingCents],
    ["Entradas", s.incomeCents],
    ["Saídas", s.expenseCents],
    ["Saldo final", s.closingCents],
  ] as const;
  ensure(62);
  metrics.forEach(([label, value], i) => {
    const width = CW / 4,
      x = M + i * width;
    page!.drawRectangle({
      x,
      y: H - y - 53,
      width: width - 5,
      height: 53,
      color: pale,
    });
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
  paragraph(
    `Resultado do mês (entradas − saídas): ${formatMoney(s.incomeCents - s.expenseCents)}`,
    9,
    muted,
    3,
  );
  const extras = [
    s.openingMovementCents
      ? `aberturas ${formatMoney(s.openingMovementCents)}`
      : null,
    s.adjustmentCents ? `ajustes ${formatMoney(s.adjustmentCents)}` : null,
    s.transferNetCents
      ? `transferências líquidas ${formatMoney(s.transferNetCents)}`
      : null,
  ].filter(Boolean);
  if (extras.length)
    paragraph(`Outros efeitos no saldo: ${extras.join(" · ")}.`, 8.5, muted, 3);
  for (const direction of ["INCOME", "EXPENSE"] as const) {
    const name = direction === "INCOME" ? "Entradas" : "Saídas",
      color = direction === "INCOME" ? green : red;
    heading(data.type === "SYNTHETIC" ? `${name} por categoria` : name, color);
    if (data.type === "SYNTHETIC") {
      const categories = data.categories.filter(
        (c) => c.direction === direction,
      );
      if (!categories.length)
        paragraph(
          `Nenhuma ${direction === "INCOME" ? "entrada registrada" : "saída registrada"} no período.`,
          9,
        );
      else {
        const categoryRows: string[][] = [];
        for (const group of Map.groupBy(
          categories,
          (c) => c.categoryId,
        ).values()) {
          categoryRows.push(
            ...group.map((c) => [
              [c.categoryName, c.classificationName]
                .filter(Boolean)
                .join(" · "),
              String(c.count),
              formatMoney(c.amountCents),
            ]),
          );
          if (group.length > 1)
            categoryRows.push([
              "Subtotal da categoria",
              String(group.reduce((a, c) => a + c.count, 0)),
              formatMoney(group.reduce((a, c) => a + c.amountCents, 0)),
            ]);
        }
        table(
          {
            title: name,
            headers: ["Categoria / classificação", "Lançamentos", "Total"],
            widths: [CW - 190, 80, 110],
            right: [1, 2],
            color,
          },
          categoryRows,
        );
      }
    } else {
      const rows = data.rows.filter((r) => r.direction === direction);
      if (!rows.length)
        paragraph(
          `Nenhuma ${direction === "INCOME" ? "entrada registrada" : "saída registrada"} no período.`,
          9,
        );
      for (const group of Map.groupBy(rows, (r) => r.categoryId).values()) {
        const names = [...new Set(group.map((r) => r.categoryName))].join(
          " / ",
        );
        ensure(75);
        paragraph(names, 9, ink, 3);
        table(
          {
            title: `${name} · ${names}`,
            headers: [
              "Data",
              "Pessoa / descrição",
              "Departamento",
              "Caixa / pagamento",
              "Valor",
            ],
            widths: [70, CW - 70 - 79 - 100 - 90, 79, 100, 90],
            right: [4],
            color,
          },
          group.map((r) => [
            r.date.split("-").reverse().join("/"),
            [
              r.personName ||
                (direction === "INCOME"
                  ? "Contribuição coletiva"
                  : "Saída registrada"),
              r.classificationName,
              r.description,
              r.documentNumber ? `Doc. ${r.documentNumber}` : null,
            ]
              .filter(Boolean)
              .join("\n"),
            r.departmentName,
            `${r.cashboxName}\n${r.paymentMethodName}`,
            formatMoney(r.amountCents),
          ]),
        );
        total(
          "Subtotal da categoria",
          group.reduce((a, r) => a + r.amountCents, 0),
          color,
        );
      }
    }
    total(
      `Total de ${name.toLocaleLowerCase("pt-BR")}`,
      direction === "INCOME" ? s.incomeCents : s.expenseCents,
      color,
    );
  }
  if (data.departments.length) {
    heading("Resumo por departamento");
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
    heading("Caixas e contas");
    table(
      {
        title: "Caixas e contas",
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
    for (const b of data.cashboxes) {
      const details = [
        b.openingMovementCents
          ? `abertura no mês ${formatMoney(b.openingMovementCents)}`
          : null,
        b.adjustmentCents ? `ajustes ${formatMoney(b.adjustmentCents)}` : null,
        b.transferNetCents
          ? `transferências líquidas ${formatMoney(b.transferNetCents)}`
          : null,
      ].filter(Boolean);
      if (details.length)
        paragraph(`${b.name}: ${details.join(" · ")}.`, 8.5, muted, 3);
    }
  }
  if (data.movements.length) {
    heading("Outros movimentos de saldo");
    paragraph(
      "Aberturas e ajustes compõem o saldo. Transferências apenas movimentam recursos entre caixas; não são receitas ou despesas.",
      8.5,
    );
    table(
      {
        title: "Outros movimentos de saldo",
        headers: ["Data", "Movimento", "Valor"],
        widths: [65, CW - 175, 110],
        right: [2],
      },
      data.movements.map((m) => [
        m.date.split("-").reverse().join("/"),
        m.description,
        formatMoney(m.amountCents),
      ]),
    );
  }
  paragraph(
    `${s.count} lançamento(s). Valores registrados até a emissão. Nova emissão pode refletir correções posteriores.`,
    8,
    muted,
    0,
  );
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
