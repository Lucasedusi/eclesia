import { describe, expect, it } from "vitest";
import type { EventRegistrationFieldRow } from "../types/event.types";
import { formatRegistrationFieldValue, orderRegistrationFields, visibleRegistrationFields } from "./registration-fields";

function field(key: string, sortOrder: number, visibility: EventRegistrationFieldRow["visibility"] = "OPTIONAL", active = true): EventRegistrationFieldRow {
  return { id: key, key, kind: "STANDARD", label: key, helpText: null, type: "SHORT_TEXT", visibility, options: [], sortOrder, active, systemLocked: false };
}

describe("registration field ordering", () => {
  it("respeita a ordem personalizada e mantém empates estáveis", () => {
    expect(orderRegistrationFields([field("telefone", 30), field("nome", 10), field("cargo", 30)]).map((item) => item.key))
      .toEqual(["nome", "telefone", "cargo"]);
  });

  it("remove campos ocultos sem alterar a sequência dos campos visíveis", () => {
    expect(visibleRegistrationFields([field("cidade", 40), field("documento", 20, "HIDDEN", false), field("nome", 10)]).map((item) => item.key))
      .toEqual(["nome", "cidade"]);
  });
});

describe("registration field value formatting", () => {
  it("exibe datas personalizadas no padrão brasileiro sem deslocamento de fuso", () => {
    expect(formatRegistrationFieldValue("2016-05-16", "DATE")).toBe("16/05/2016");
  });

  it("mantém a apresentação de booleanos, listas e valores vazios", () => {
    expect(formatRegistrationFieldValue(true, "BOOLEAN")).toBe("Sim");
    expect(formatRegistrationFieldValue(["Casado", "Visitante"], "SINGLE_SELECT")).toBe("Casado, Visitante");
    expect(formatRegistrationFieldValue(null, "SHORT_TEXT")).toBe("—");
  });
});
