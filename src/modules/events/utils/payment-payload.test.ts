import { describe, expect, it } from "vitest";
import { buildPublicCaravanPaymentPayload, buildRegistrationPaymentPayload, canShowPublicCashWhatsapp, normalizePublicCaravanPaymentInput, parsePublicCaravanPaymentAmount, retryPublicCaravanStorageRead } from "./payment-payload";

describe("buildRegistrationPaymentPayload", () => {
  it("omite todos os metadados quando não existe comprovante", () => {
    expect(buildRegistrationPaymentPayload({
      amount: 125,
      receiptPath: "",
      receiptFileName: "",
      receiptMimeType: "",
      receiptFileSize: 0,
    })).toEqual({ amount: 125 });
  });

  it("mantém os metadados completos quando existe comprovante", () => {
    expect(buildRegistrationPaymentPayload({
      amount: 125,
      receiptPath: "tenant/events/event/payment-receipts/id/comprovante.pdf",
      receiptFileName: "comprovante.pdf",
      receiptMimeType: "application/pdf",
      receiptFileSize: 2048,
    })).toEqual({
      amount: 125,
      receiptPath: "tenant/events/event/payment-receipts/id/comprovante.pdf",
      receiptFileName: "comprovante.pdf",
      receiptMimeType: "application/pdf",
      receiptFileSize: 2048,
    });
  });
});

describe("pagamento público de caravana", () => {
  it("converte a máscara monetária brasileira para número ao salvar", () => {
    expect(parsePublicCaravanPaymentAmount("R$ 2.500,00", true)).toBe(2500);
  });

  it("salva zero quando não existe comprovante anexado", () => {
    expect(parsePublicCaravanPaymentAmount("R$ 2.500,00", false)).toBe(0);
  });

  it("não libera o WhatsApp de dinheiro antes da inscrição existir", () => {
    expect(canShowPublicCashWhatsapp({ completed: false, paymentMethod: "CASH", hasWhatsappNumber: true })).toBe(false);
  });

  it("libera o WhatsApp apenas após concluir uma inscrição em dinheiro", () => {
    expect(canShowPublicCashWhatsapp({ completed: true, paymentMethod: "CASH", hasWhatsappNumber: true })).toBe(true);
    expect(canShowPublicCashWhatsapp({ completed: true, paymentMethod: "PIX", hasWhatsappNumber: true })).toBe(false);
    expect(canShowPublicCashWhatsapp({ completed: true, paymentMethod: "CASH", hasWhatsappNumber: false })).toBe(false);
  });

  it("remove valor e comprovante quando a forma selecionada é dinheiro", () => {
    expect(buildPublicCaravanPaymentPayload({
      paymentMethod: "CASH",
      amountValue: "R$ 2.500,00",
      receipt: { path: "tenant/comprovante.pdf", fileName: "comprovante.pdf", mimeType: "application/pdf", fileSize: 2048 },
    })).toEqual({
      paymentMethod: "CASH",
      paymentAmount: 0,
      paymentReceiptPath: "",
      paymentReceiptFileName: "",
      paymentReceiptMimeType: "",
      paymentReceiptFileSize: 0,
    });
  });

  it("mantém valor e metadados do comprovante no Pix coletivo", () => {
    expect(buildPublicCaravanPaymentPayload({
      paymentMethod: "PIX",
      amountValue: "R$ 2.500,00",
      receipt: { path: "tenant/comprovante.pdf", fileName: "comprovante.pdf", mimeType: "application/pdf", fileSize: 2048 },
    })).toEqual({
      paymentMethod: "PIX",
      paymentAmount: 2500,
      paymentReceiptPath: "tenant/comprovante.pdf",
      paymentReceiptFileName: "comprovante.pdf",
      paymentReceiptMimeType: "application/pdf",
      paymentReceiptFileSize: 2048,
    });
  });

  it("converte em pendente um Pix sem comprovante mesmo se um cliente antigo enviar o valor do campo", () => {
    expect(normalizePublicCaravanPaymentInput({
      paymentMethod: "PIX",
      paymentAmount: 2500,
      paymentReceiptPath: "",
      paymentReceiptFileName: "",
      paymentReceiptMimeType: "",
      paymentReceiptFileSize: 0,
    })).toEqual({
      paymentMethod: "PIX",
      paymentAmount: 0,
      paymentReceiptPath: "",
      paymentReceiptFileName: "",
      paymentReceiptMimeType: "",
      paymentReceiptFileSize: 0,
    });
  });

  it("preserva o valor e os metadados quando o Pix possui comprovante", () => {
    const input = {
      paymentMethod: "PIX",
      paymentAmount: 2500,
      paymentReceiptPath: "tenant/events/event/public-caravans/session/receipt/file.png",
      paymentReceiptFileName: "comprovante.png",
      paymentReceiptMimeType: "image/png",
      paymentReceiptFileSize: 451146,
    };

    expect(normalizePublicCaravanPaymentInput(input)).toEqual(input);
  });

  it("repete a leitura quando o arquivo recém-enviado ainda não está disponível", async () => {
    let attempts = 0;
    const result = await retryPublicCaravanStorageRead(async () => {
      attempts += 1;
      if (attempts < 3) return { data: null, error: { message: "Object not found" } };
      return { data: "arquivo", error: null };
    }, async () => undefined);

    expect(result).toEqual({ data: "arquivo", error: null });
    expect(attempts).toBe(3);
  });

  it("encerra a validação após três falhas de leitura", async () => {
    let attempts = 0;
    const result = await retryPublicCaravanStorageRead(async () => {
      attempts += 1;
      return { data: null, error: { message: "Object not found" } };
    }, async () => undefined);

    expect(result).toEqual({ data: null, error: { message: "Object not found" } });
    expect(attempts).toBe(3);
  });

  it("não repete a leitura quando o Storage rejeita o arquivo de forma permanente", async () => {
    let attempts = 0;
    const waits: number[] = [];

    const result = await retryPublicCaravanStorageRead(async () => {
      attempts += 1;
      return {
        data: null,
        error: { message: "Invalid MIME type", statusCode: "400" },
      };
    }, async (milliseconds) => {
      waits.push(milliseconds);
    });

    expect(attempts).toBe(1);
    expect(waits).toEqual([]);
    expect(result.error).toEqual({
      message: "Invalid MIME type",
      statusCode: "400",
    });
  });
});
