import ExcelJS from "exceljs";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { MEMBER_IMPORT_COLUMNS } from "../constants/member-import";

vi.mock("server-only", () => ({}));

let generateMemberImportTemplate: typeof import("./member-import-workbook.service").generateMemberImportTemplate;

beforeAll(async () => {
  ({ generateMemberImportTemplate } = await import("./member-import-workbook.service"));
});

describe("modelo XLSX da importação de membros", () => {
  it("gera os 18 campos oficiais, filtros, datas e listas de seleção", async () => {
    const buffer = await generateMemberImportTemplate();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Uint8Array.from(buffer).buffer);
    const worksheet = workbook.getWorksheet("Membros");

    expect(worksheet).toBeDefined();
    expect(worksheet?.getRow(1).values).toEqual([undefined, ...MEMBER_IMPORT_COLUMNS]);
    expect(worksheet?.autoFilter).toBe("A1:R1");
    expect(worksheet?.getCell("H2").dataValidation.formulae).toEqual(['"Masculino,Feminino,M,F"']);
    expect(worksheet?.getCell("K2").dataValidation.formulae?.[0]).toContain("AC,AL,AP");
    expect(worksheet?.getCell("M2").dataValidation.formulae?.[0]).toContain("AC,AL,AP");
    expect(worksheet?.getCell("P2").numFmt).toBe("dd/mm/yyyy");
    expect(worksheet?.getCell("Q2").numFmt).toBe("dd/mm/yyyy");
    expect(worksheet?.getCell("R2").numFmt).toBe("dd/mm/yyyy");
    expect(worksheet?.getCell("R1").note).toBeTruthy();
  });
});
