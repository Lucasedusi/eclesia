import { describe, expect, it } from "vitest";
import {
  credentialDownloadUrl,
  credentialWarningLabel,
} from "./member-credential-view";

describe("member credential view helpers", () => {
  it.each([
    ["MISSING_ROLE", "Cargo não cadastrado"],
    ["MISSING_BAPTISM_DATE", "Data do batismo não informada"],
    ["MISSING_MOTHER_NAME", "Nome da mãe não informado"],
    ["MISSING_FATHER_NAME", "Nome do pai não informado"],
  ] as const)("traduz %s", (warning, label) => {
    expect(credentialWarningLabel(warning)).toBe(label);
  });

  it("codifica o identificador na rota de download", () => {
    expect(credentialDownloadUrl("member 1")).toBe(
      "/api/members/member%201/credential/pdf",
    );
  });
});
