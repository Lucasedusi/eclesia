import { describe, expect, it } from "vitest";
import {
  hasFormulaValue,
  normalizeBrazilianState,
  normalizeGender,
  normalizeImportCpf,
  normalizeImportDate,
  normalizeImportHeader,
  normalizeImportPhone,
  normalizeImportZipCode,
  normalizeMaritalStatus,
  normalizeMemberName,
  normalizeNameKey,
  normalizeRoleKey,
} from "./member-import-normalizers";

describe("normalizadores da importação de membros", () => {
  it("preserva a grafia do nome e remove espaços excedentes", () => {
    expect(normalizeMemberName("  Maria   da Silva ")).toBe("Maria da Silva");
    expect(normalizeNameKey("JOSÉ  D’ÁVILA")).toBe("jose d’avila");
  });

  it("normaliza cabeçalhos e siglas", () => {
    expect(normalizeImportHeader(" Data Nascimento ")).toBe("datanascimento");
    expect(normalizeImportHeader("Naturalidade_Cidade")).toBe("naturalidadecidade");
    expect(normalizeRoleKey(" Pr. ")).toBe("pr");
  });

  it("normaliza telefones brasileiros", () => {
    expect(normalizeImportPhone("(62) 99999-8888")).toBe("62999998888");
    expect(normalizeImportPhone("55 62 99999-8888")).toBe("62999998888");
    expect(normalizeImportPhone("99999-8888")).toBeNull();
  });

  it("valida CPF sem pontuação", () => {
    expect(normalizeImportCpf("529.982.247-25")).toEqual({ value: "52998224725", valid: true });
    expect(normalizeImportCpf("111.111.111-11").valid).toBe(false);
    expect(normalizeImportCpf("")).toEqual({ value: null, valid: true });
  });

  it("aceita datas do Excel e os formatos previstos", () => {
    expect(normalizeImportDate("10/08/2022", "dtcadastro").value).toBe("2022-08-10");
    expect(normalizeImportDate("2022-08-10", "dtcadastro").value).toBe("2022-08-10");
    expect(normalizeImportDate(44783, "dtcadastro").value).toBe("2022-08-10");
    expect(normalizeImportDate("31/02/2022", "dtcadastro").issue?.code).toBe("RECEIVED_DATE_INVALID");
    expect(normalizeImportDate("20/06/1998", "data_batismo_agua").value).toBe("1998-06-20");
  });

  it("normaliza CEP sem pontuação", () => {
    expect(normalizeImportZipCode("76.550-000")).toEqual({ value: "76550000", valid: true });
    expect(normalizeImportZipCode("7655").valid).toBe(false);
    expect(normalizeImportZipCode("")).toEqual({ value: null, valid: true });
  });

  it("normaliza sexo e UF sem inferir valores", () => {
    expect(normalizeGender("Feminino")).toBe("FEMALE");
    expect(normalizeGender("M")).toBe("MALE");
    expect(normalizeGender("não informado")).toBeNull();
    expect(normalizeBrazilianState(" go ")).toBe("GO");
    expect(normalizeBrazilianState("XX")).toBeNull();
  });

  it("mapeia estados civis legíveis", () => {
    expect(normalizeMaritalStatus("Casado(a)")).toBe("MARRIED");
    expect(normalizeMaritalStatus("Desquitada")).toBe("SEPARATED");
    expect(normalizeMaritalStatus("não definido")).toBeNull();
  });

  it("identifica fórmulas", () => {
    expect(hasFormulaValue({ formula: "A1", result: "x" })).toBe(true);
    expect(hasFormulaValue("A1")).toBe(false);
  });
});
