import { describe, expect, it } from "vitest";
import {
  buildTrackingHash,
  isPublicManualPaymentMethod,
  isTerminalPublicStatus,
  publicStatusTone,
  readTrackingHash,
  shouldPollPublicStatus,
  shouldShowTrackingPix,
  shouldShowPublicSummary,
} from "./public-registration-flow";

const token = "A".repeat(48);

describe("public registration flow", () => {
  it("mantém polling somente para situação pendente e aba visível", () => {
    expect(shouldPollPublicStatus({ status: "PENDING", visible: true })).toBe(true);
    expect(shouldPollPublicStatus({ status: "PENDING", visible: false })).toBe(false);
    expect(shouldPollPublicStatus({ status: "CONFIRMED", visible: true })).toBe(false);
    expect(shouldPollPublicStatus({ status: "CANCELLED", visible: true })).toBe(false);
  });

  it("considera os estados finais como terminais", () => {
    expect(isTerminalPublicStatus("CONFIRMED")).toBe(true);
    expect(isTerminalPublicStatus("CHECKED_IN")).toBe(true);
    expect(isTerminalPublicStatus("CANCELLED")).toBe(true);
    expect(isTerminalPublicStatus("EXPIRED")).toBe(true);
    expect(isTerminalPublicStatus("NO_SHOW")).toBe(true);
    expect(isTerminalPublicStatus("PENDING")).toBe(false);
  });

  it("mapeia pendência para atenção e falhas para perigo", () => {
    expect(publicStatusTone("PENDING")).toBe("warning");
    expect(publicStatusTone("PARTIAL")).toBe("warning");
    expect(publicStatusTone("FAILED")).toBe("danger");
    expect(publicStatusTone("CANCELLED")).toBe("danger");
    expect(publicStatusTone("NO_SHOW")).toBe("danger");
    expect(publicStatusTone("CONFIRMED")).toBe("success");
  });

  it("serializa o token no fragmento sem dados pessoais", () => {
    expect(buildTrackingHash("INDIVIDUAL", token)).toBe(`#tipo=individual&token=${token}`);
    expect(readTrackingHash(`#tipo=caravana&token=${token}`)).toEqual({ kind: "CARAVAN", token });
    expect(readTrackingHash("#tipo=individual&token=curto")).toBeNull();
  });

  it("mostra resumo fixo na primeira etapa, recolhível nas intermediárias e oculta na conclusão", () => {
    expect(shouldShowPublicSummary({ step: 1, completed: false })).toEqual({ visible: true, collapsible: false, defaultOpen: true });
    expect(shouldShowPublicSummary({ step: 2, completed: false })).toEqual({ visible: true, collapsible: true, defaultOpen: false });
    expect(shouldShowPublicSummary({ step: 3, completed: false })).toEqual({ visible: true, collapsible: true, defaultOpen: false });
    expect(shouldShowPublicSummary({ step: 3, completed: true })).toEqual({ visible: false, collapsible: false, defaultOpen: false });
  });

  it("mantém os dados Pix disponíveis no acompanhamento enquanto o pagamento estiver pendente", () => {
    expect(shouldShowTrackingPix({ registrationStatus: "PENDING", paymentMethod: "PIX", hasPixCode: true })).toBe(true);
    expect(shouldShowTrackingPix({ registrationStatus: "CONFIRMED", paymentMethod: "PIX", hasPixCode: true })).toBe(false);
    expect(shouldShowTrackingPix({ registrationStatus: "PENDING", paymentMethod: "CASH", hasPixCode: true })).toBe(false);
  });

  it("identifica dinheiro e cartões como pagamentos presenciais", () => {
    expect(isPublicManualPaymentMethod("CASH")).toBe(true);
    expect(isPublicManualPaymentMethod("DEBIT_CARD")).toBe(true);
    expect(isPublicManualPaymentMethod("CREDIT_CARD")).toBe(true);
    expect(isPublicManualPaymentMethod("PIX")).toBe(false);
    expect(isPublicManualPaymentMethod("NOT_APPLICABLE")).toBe(false);
  });
});
