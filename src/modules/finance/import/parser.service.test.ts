import ExcelJS from "exceljs";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { parseBankStatement } from "./parser.service";

async function file(rows: ExcelJS.CellValue[][], extraSheet = false) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("LANÇAMENTOS");
  sheet.addRow(["EXTRATO CONTA CORRENTE"]);
  sheet.addRow([
    "DATA",
    "DOCUMENTO",
    "HISTÓRICO",
    "INFORMAÇÕES COMPLEMENTARES",
    "VALOR",
  ]);
  rows.forEach((row) => sheet.addRow(row));
  if (extraSheet) workbook.addWorksheet("Outra");
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

describe("Sicoob statement parser", () => {
  it("extracts 33 movements and reconciles three balance rows without treating them as money", async () => {
    const rows = Array.from({ length: 33 }, (_, i) => [
      "21/10/2026",
      "PIX",
      i < 22 ? "PIX RECEBIDO" : "PIX ENVIADO",
      `Pessoa fictícia ${i}\nInformação fictícia`,
      i < 22 ? 10.25 : -5.5,
    ]);
    const parsed = await parseBankStatement(
      await file([
        ...rows,
        ["21/10/2026", "", "SALDO DO DIA", "", 265],
        ["21/10/2026", "", "SALDO BLOQUEADO ANTERIOR", "", 0],
        ["21/10/2026", "", "SALDO ANTERIOR", "", 100],
      ]),
    );
    expect(parsed.rows).toHaveLength(33);
    expect(parsed.rows.filter((r) => r.amountCents! > 0)).toHaveLength(22);
    expect(parsed.rows.filter((r) => r.amountCents! < 0)).toHaveLength(11);
    expect(parsed.rows[0]).toMatchObject({
      rowNumber: 3,
      date: "2026-10-21",
      amountCents: 1025,
      document: "PIX",
      issue: null,
    });
    expect(parsed.balances).toHaveLength(3);
    expect(parsed.reconciliation).toBe("MATCHED");
  });
  it("keeps identical occurrences and distinguishes full source from repeated document/date/amount", async () => {
    const parsed = await parseBankStatement(
      await file([
        ["31/10/2026", "0001", "PIX", "Pessoa A", 100],
        ["31/10/2026", "0001", "PIX", "Pessoa A", 100],
        ["01/11/2026", "0001", "PIX", "Pessoa B", -100],
      ]),
    );
    expect(parsed.rows).toHaveLength(3);
    expect(parsed.rows[0].fingerprint).toBe(parsed.rows[1].fingerprint);
    expect(parsed.rows[0].fingerprint).not.toBe(parsed.rows[2].fingerprint);
    expect(parsed.rows[2].date).toBe("2026-11-01");
    expect(parsed.reconciliation).toBe("UNAVAILABLE");
  });
  it("retains invalid and unknown rows with an issue instead of silently dropping them", async () => {
    const parsed = await parseBankStatement(
      await file([
        ["31/02/2026", "1", "PIX", "", 12],
        ["21/10/2026", "2", "PIX", "", 1.001],
        ["Observação desconhecida", "", "", "", "texto"],
        ["21/10/2026", "3", "PIX", "", 0],
      ]),
    );
    expect(parsed.rows).toHaveLength(4);
    expect(parsed.rows.every((r) => r.issue)).toBe(true);
    expect(parsed.rows[0].date).toBeNull();
    expect(parsed.rows[1].amountCents).toBeNull();
  });
  it("reports unmatched balances and never repairs the amount", async () => {
    const parsed = await parseBankStatement(
      await file([
        ["21/10/2026", "1", "PIX", "", 10],
        ["21/10/2026", "", "SALDO ANTERIOR", "", 100],
        ["21/10/2026", "", "SALDO DO DIA", "", 120],
      ]),
    );
    expect(parsed.reconciliation).toBe("MISMATCH");
    expect(parsed.rows[0].amountCents).toBe(1000);
  });
  it("does not claim reconciliation for ambiguous daily balances", async () => {
    const parsed = await parseBankStatement(
      await file([
        ["21/10/2026", "1", "PIX", "", 10],
        ["22/10/2026", "2", "PIX", "", 20],
        ["21/10/2026", "", "SALDO ANTERIOR", "", 100],
        ["21/10/2026", "", "SALDO DO DIA", "", 110],
        ["22/10/2026", "", "SALDO DO DIA", "", 130],
      ]),
    );
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.reconciliation).toBe("UNAVAILABLE");
  });
  it("rejects formulas, multiple worksheets and non-XLSX content", async () => {
    await expect(
      parseBankStatement(
        await file([
          ["21/10/2026", "1", "PIX", "", { formula: "1+1", result: 2 }],
        ]),
      ),
    ).rejects.toThrow(/fórmulas/i);
    await expect(
      parseBankStatement(await file([["21/10/2026", "1", "PIX", "", 2]], true)),
    ).rejects.toThrow(/aba/i);
    await expect(
      parseBankStatement(Buffer.from("not a spreadsheet")),
    ).rejects.toThrow(/XLSX/i);
  });
  it("rejects excessive rows and unexpected columns", async () => {
    await expect(
      parseBankStatement(
        await file(
          Array.from({ length: 5001 }, () => ["21/10/2026", "1", "PIX", "", 1]),
        ),
      ),
    ).rejects.toThrow(/5.000|5000/);
    await expect(
      parseBankStatement(
        await file([["21/10/2026", "1", "PIX", "", 1, "extra"]]),
      ),
    ).rejects.toThrow(/colunas/i);
  });
});
