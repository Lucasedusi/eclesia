import { describe, expect, it } from "vitest";
import {
  credentialDownloadUrl,
  credentialPdfFileName,
  credentialFlipView,
  credentialWarningLabel,
  resolveCredentialPreviewState,
} from "./member-credential-view";

describe("member credential view helpers", () => {
  it("descreve a face atual e a ação seguinte do cartão", () => {
    expect(credentialFlipView("front")).toEqual({
      side: "front",
      nextSide: "back",
      buttonLabel: "Mostrar verso da credencial",
      hint: "Clique para ver o verso",
    });
    expect(credentialFlipView("back")).toEqual({
      side: "back",
      nextSide: "front",
      buttonLabel: "Mostrar frente da credencial",
      hint: "Clique para ver a frente",
    });
  });

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

  it("distingue os arquivos de dobra e de gráfica", () => {
    expect(credentialPdfFileName("credencial-MEM123.pdf", "fold")).toBe("credencial-MEM123.pdf");
    expect(credentialPdfFileName("credencial-MEM123.pdf", "pvc")).toBe("credencial-MEM123-pvc.pdf");
  });

  it("transforma rejeição da ação em erro visível", async () => {
    await expect(
      resolveCredentialPreviewState(
        Promise.reject(new Error("network details must remain private")),
      ),
    ).resolves.toEqual({
      status: "error",
      message: "Não foi possível preparar a credencial agora.",
    });
  });
});
