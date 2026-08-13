import { Buffer } from "node:buffer";
import ExcelJS from "exceljs";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

let parseMemberImportWorkbook: typeof import("./member-import-parser.service").parseMemberImportWorkbook;

beforeAll(async () => {
  ({ parseMemberImportWorkbook } = await import("./member-import-parser.service"));
});

async function workbookBuffer(rows: ExcelJS.CellValue[][]) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Cadastro");
  rows.forEach((row) => worksheet.addRow(row));
  const bytes = await workbook.xlsx.writeBuffer();
  return Buffer.from(new Uint8Array(bytes));
}

describe("parser XLSX da importação de membros", () => {
  it("reconhece cabeçalhos normalizados e ignora colunas extras", async () => {
    const buffer = await workbookBuffer([
      [
        " NOME ", "FONE", "Dt Nascimento", "CARGO", "CPF", "Estado Civil", "Dt Cadastro",
        "SEXO", "CEP", "Cidade", "Estado", "Naturalidade Cidade", "Naturalidade UF", "Nome Pai", "Nome Mãe",
        "Data Batismo Água", "Data Batismo Espírito", "Data Conversão", "email",
      ],
      [
        "  Maria   da Silva ", "(62) 99999-8888", "10/05/1985", "Mb", "", "Casado(a)", "15/03/2010",
        "Feminino", "76.550-000", "Porangatu", "go", "Porangatu", "go", "José da Silva", "Ana da Silva",
        "20/06/1998", "10/08/2001", "15/05/1997", "privado@exemplo.com",
      ],
    ]);

    const result = await parseMemberImportWorkbook(buffer);

    expect(result.worksheetName).toBe("Cadastro");
    expect(result.ignoredColumns).toContain("email");
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      rowNumber: 2,
      fullName: "Maria da Silva",
      whatsapp: "62999998888",
      birthDate: "1985-05-10",
      maritalStatus: "MARRIED",
      receivedDate: "2010-03-15",
      gender: "FEMALE",
      zipCode: "76550000",
      city: "Porangatu",
      state: "GO",
      naturalCity: "Porangatu",
      naturalState: "GO",
      fatherName: "José da Silva",
      motherName: "Ana da Silva",
      baptismDate: "1998-06-20",
      holySpiritBaptismDate: "2001-08-10",
      conversionDate: "1997-05-15",
    });
    expect(result.rows[0].sourceData).not.toHaveProperty("email");
  });

  it("mantém compatibilidade com o modelo anterior de sete colunas", async () => {
    const buffer = await workbookBuffer([
      ["nome", "fone", "dtnascimento", "cargo", "cpf", "estadocivil", "dtcadastro"],
      ["João da Silva", "", "", "Mb", "", "", ""],
    ]);

    const result = await parseMemberImportWorkbook(buffer);

    expect(result.rows[0]).toMatchObject({
      fullName: "João da Silva",
      gender: null,
      zipCode: null,
      city: null,
      state: null,
      naturalCity: null,
      naturalState: null,
      fatherName: null,
      motherName: null,
      baptismDate: null,
      holySpiritBaptismDate: null,
      conversionDate: null,
    });
  });

  it("bloqueia batismo anterior ao nascimento", async () => {
    const buffer = await workbookBuffer([
      ["nome", "cargo", "dtnascimento", "data_batismo_agua"],
      ["Maria da Silva", "Mb", "10/05/1985", "20/06/1980"],
    ]);

    const result = await parseMemberImportWorkbook(buffer);

    expect(result.rows[0].issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "BAPTISM_BEFORE_BIRTH", field: "data_batismo_agua", severity: "ERROR" }),
    ]));
  });

  it("aceita o cabeçalho legado data_batismo como batismo nas águas", async () => {
    const buffer = await workbookBuffer([
      ["nome", "cargo", "data_batismo"],
      ["João da Silva", "Mb", "20/06/1998"],
    ]);
    const result = await parseMemberImportWorkbook(buffer);
    expect(result.rows[0].baptismDate).toBe("1998-06-20");
  });

  it("rejeita fórmulas nos campos suportados", async () => {
    const buffer = await workbookBuffer([
      ["nome", "cargo"],
      [{ formula: "CONCAT(\"Maria\",\" Silva\")", result: "Maria Silva" }, "Mb"],
    ]);

    const result = await parseMemberImportWorkbook(buffer);

    expect(result.rows[0].issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "FORMULA_NOT_ALLOWED", field: "nome", severity: "ERROR" }),
    ]));
  });

  it("bloqueia arquivos acima do limite de 500 membros", async () => {
    const rows: ExcelJS.CellValue[][] = [["nome", "cargo"]];
    for (let index = 1; index <= 501; index += 1) rows.push([`Membro ${index}`, "Mb"]);
    const buffer = await workbookBuffer(rows);

    await expect(parseMemberImportWorkbook(buffer)).rejects.toMatchObject({ code: "IMPORT_ROW_LIMIT_EXCEEDED" });
  });
});
