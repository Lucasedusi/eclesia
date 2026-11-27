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

describe.each(["csv", "xlsx"] as const)("cargo opcional no %s", (format) => {
  it.each([["nome", "sexo"], ["nome", "sexo", "cargo"]])("aceita cabeçalho %j e cargo em branco", async (...columns) => {
    const values = columns.map(column => column === "nome" ? "Pessoa de teste" : column === "sexo" ? "F" : "");
    const file = format === "csv"
      ? Buffer.from([columns.join(";"), values.join(";")].join("\n"))
      : await workbookBuffer([columns, values]);
    const { rows } = await parseMemberImportWorkbook(file, format);
    expect(rows[0]).toMatchObject({ roleRaw: "", gender: "FEMALE" });
    expect(rows[0].issues.map(issue => issue.code)).not.toContain("ROLE_REQUIRED");
  });
});

describe("CSV do MEMBROS WEB", () => {
  const header = "Id;nome;fone;dtnascimento;igreja;cargo;endereco;cpf;identidade;email;estadocivil;dtcadastro";

  it("lê texto Windows-1252, aspas e zeros iniciais, sem transformar cadastro em recebimento", async () => {
    const csv = header + '\r\n0007;"João ""Júnior""";;1980-12-07;Ebenézer;Mb;"Rua A; 10";;00123;a@example.org;Casado(a);2000-05-01';
    const parsed = await parseMemberImportWorkbook(Buffer.from(csv, "latin1"), "csv");
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]).toMatchObject({
      fullName: 'João "Júnior"', birthDate: "1980-12-07", receivedDate: null,
      sourceData: { id: "0007", endereco: "Rua A; 10", identidade: "00123", email: "a@example.org", dtcadastro: "2000-05-01" },
    });
  });

  it("aceita BOM UTF-8 e campos multilinha", async () => {
    const csv = '\uFEFF' + header + '\n0008;Ana Lúcia;;;Ebenézer;Mb;"Linha A\nLinha B";;;;;';
    const parsed = await parseMemberImportWorkbook(Buffer.from(csv), "csv");
    expect(parsed.rows[0]).toMatchObject({ fullName: "Ana Lúcia", sourceData: { endereco: "Linha A\nLinha B" } });
  });

  it.each([
    [header + '\n1;"aspas abertas', "IMPORT_CSV_INVALID"],
    [header + '\n1;Ana', "IMPORT_CSV_INVALID"],
    ["nome;nome;cargo\nAna;Outra;Mb", "IMPORT_CSV_INVALID"],
    [header + "\n" + Array(501).fill("1;Exemplo;;;Ebenézer;Mb;;;;;;").join("\n"), "IMPORT_ROW_LIMIT_EXCEEDED"],
  ])("rejeita CSV inválido ou acima do limite (%#)", async (input, code) => {
    await expect(parseMemberImportWorkbook(Buffer.from(input), "csv")).rejects.toMatchObject({ code });
  });
});

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

describe("planilha limpa de uma congregação", () => {
  const headers = ["Nome", "Cargo", "Sexo", "Data de nascimento", "Endereço", "Bairro", "Cidade", "Estado",
    "País", "CEP", "Telefone", "CPF", "Estado civil", "Profissão", "Naturalidade", "Nacionalidade",
    "Data do cadastro", "Data de conversão", "Data de batismo nas águas", "Nome do pai", "Nome da mãe"];

  it("preserva os 21 campos e distingue data legada, recebimento e telefone fixo", async () => {
    const result = await parseMemberImportWorkbook(await workbookBuffer([headers, [
      "Pessoa de Teste", "Diaconisa", "Feminino", "10/05/1985", "Rua A, 42", "Centro", "São Paulo", "SP",
      "Portugal", "01234-000", "(11) 3456-7890", "", "Casado(a)", "Docente", "São José dos Campos / SP",
      "Portuguesa", new Date("2015-03-10T00:00:00Z"), "12/12/2000", "13/12/2001", "Pai do Teste", "Mãe do Teste",
    ]]));
    expect(result.recognizedColumns).toEqual(headers);
    expect(result.rows[0]).toMatchObject({
      fullName: "Pessoa de Teste", roleRaw: "Diaconisa", gender: "FEMALE", birthDate: "1985-05-10",
      receivedDate: null, whatsapp: null, maritalStatus: "MARRIED", city: "São Paulo", state: "SP",
      naturalCity: "São José dos Campos", naturalState: "SP", zipCode: "01234000", issues: [],
      conversionDate: "2000-12-12", baptismDate: "2001-12-13", fatherName: "Pai do Teste", motherName: "Mãe do Teste",
      sourceData: { endereco: "Rua A, 42", bairro: "Centro", pais: "Portugal", profissao: "Docente",
        nacionalidade: "Portuguesa", cadastro_legado: "2015-03-10", telefone_fixo: "1134567890" },
    });
  });

  it("identifica as colunas ausentes e repetidas", async () => {
    await expect(parseMemberImportWorkbook(await workbookBuffer([headers.slice(0, -1)]))).rejects.toThrow("Nome da mãe");
    await expect(parseMemberImportWorkbook(await workbookBuffer([[...headers, "nome do pai"]]))).rejects.toThrow("repetido");
  });

  it("rejeita fórmulas em campos exclusivos e datas de origem inválidas", async () => {
    const row: ExcelJS.CellValue[] = headers.map(() => "");
    row[0] = "Pessoa de Teste";
    row[4] = { formula: "1+1", result: 2 };
    row[16] = "31/02/2010";
    const { rows } = await parseMemberImportWorkbook(await workbookBuffer([headers, row]));
    expect(rows[0].issues.map(issue => issue.code)).toEqual(expect.arrayContaining(["FORMULA_NOT_ALLOWED", "LEGACY_DATE_INVALID"]));
  });
});
