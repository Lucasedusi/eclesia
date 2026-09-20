import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("campo de CEP do formulário de eventos", () => {
  it("mantém o retorno da consulta no cabeçalho e o carregamento dentro do controle", () => {
    const source = readFileSync(new URL("./event-form.tsx", import.meta.url), "utf8");

    expect(source).toContain("<S.FieldHeader>");
    expect(source).toContain("<S.LabelStatus");
    expect(source).toContain("<S.ControlShell>");
    expect(source).toContain("<S.InlineFieldStatus role=\"status\"");
    expect(source).not.toContain("<small role=\"status\" style=");
  });
});
