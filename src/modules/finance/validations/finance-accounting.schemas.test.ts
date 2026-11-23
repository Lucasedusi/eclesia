import { describe, expect, it } from "vitest";
import {
  accountingCode,
  accountingFilters,
} from "./finance-accounting.schemas";

describe("filtros e códigos da Contabilidade", () => {
  const query = {
    unit: null,
    box: null,
    start: "2026-02-01",
    end: "2026-02-28",
    direction: "ALL",
  };
  it("aceita consulta consolidada e valida as datas civis", () => {
    expect(accountingFilters.parse(query)).toEqual(query);
    expect(
      accountingFilters.safeParse({ ...query, end: "2026-02-29" }).success,
    ).toBe(false);
    expect(
      accountingFilters.safeParse({ ...query, end: "2026-01-31" }).success,
    ).toBe(false);
  });
  it("conserva zeros iniciais e permite retirar um vínculo", () => {
    expect(accountingCode.parse("00045")).toBe("00045");
    expect(accountingCode.parse(null)).toBeNull();
    expect(accountingCode.safeParse("01.003").success).toBe(false);
  });
});
