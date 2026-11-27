import ExcelJS from "exceljs";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { CONGREGATION_COLUMNS } from "../constants/member-import";

vi.mock("server-only", () => ({}));

let generateMemberImportTemplate: typeof import("./member-import-workbook.service").generateMemberImportTemplate;

beforeAll(async () => {
  ({ generateMemberImportTemplate } = await import("./member-import-workbook.service"));
});

describe("modelo XLSX da importação de membros", () => {
  it("gera os 20 campos oficiais, filtros, datas e listas de seleção", async () => {
    const buffer = await generateMemberImportTemplate();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Uint8Array.from(buffer).buffer);
    const worksheet = workbook.getWorksheet("Membros");

    expect(worksheet).toBeDefined();
    expect(worksheet?.getRow(1).values).toEqual([undefined, ...CONGREGATION_COLUMNS.map(([label]) => label)]);
    expect(worksheet?.getCell("A2").value).toBeNull();
    expect(worksheet?.getCell("K2").numFmt).toBe("@");
    expect(worksheet?.autoFilter).toBe("A1:T1");
    expect(worksheet?.getCell("C2").dataValidation.formulae).toEqual(['"Masculino,Feminino,M,F"']);
    expect(worksheet?.getCell("H2").dataValidation.formulae?.[0]).toContain("AC,AL,AP");
    expect(worksheet?.getCell("L2").dataValidation.formulae?.[0]).toContain("Casado(a)");
    expect(worksheet?.getCell("D2").numFmt).toBe("dd/mm/yyyy");
    expect(worksheet?.getCell("P2").numFmt).toBe("dd/mm/yyyy");
    expect(worksheet?.getCell("R2").numFmt).toBe("dd/mm/yyyy");
    expect(worksheet?.getCell("P1").note).toBeTruthy();
  });
});
