import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { normalizeMercadoPagoStatus, verifyMercadoPagoWebhookSignature } from "../utils/mercado-pago-pix";

describe("normalizeMercadoPagoStatus", () => {
  it("confirma apenas pagamentos aprovados", () => {
    expect(normalizeMercadoPagoStatus("approved")).toBe("CONFIRMED");
    expect(normalizeMercadoPagoStatus("in_process")).toBe("PENDING");
    expect(normalizeMercadoPagoStatus("rejected")).toBe("FAILED");
    expect(normalizeMercadoPagoStatus("refunded")).toBe("REFUNDED");
  });

  it("identifica uma cobrança vencida ainda pendente", () => {
    expect(normalizeMercadoPagoStatus("pending", "2020-01-01T00:00:00.000Z")).toBe("EXPIRED");
  });
});

describe("verifyMercadoPagoWebhookSignature", () => {
  it("valida o manifesto HMAC oficial em tempo constante", () => {
    const secret = "segredo-de-webhook-para-teste";
    const dataId = "123456789";
    const requestId = "request-abc";
    const timestamp = "1787140800";
    const manifest = `id:${dataId};request-id:${requestId};ts:${timestamp};`;
    const signature = createHmac("sha256", secret).update(manifest).digest("hex");
    expect(verifyMercadoPagoWebhookSignature({ signature: `ts=${timestamp},v1=${signature}`, requestId, dataId, secret, now: Number(timestamp) * 1000 })).toBe(true);
  });

  it("rejeita assinatura alterada ou antiga", () => {
    expect(verifyMercadoPagoWebhookSignature({ signature: `ts=1,v1=${"a".repeat(64)}`, requestId: "x", dataId: "1", secret: "secret", now: Date.now() })).toBe(false);
  });
});
