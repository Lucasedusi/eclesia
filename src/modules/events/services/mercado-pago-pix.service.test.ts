import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMercadoPagoPixCharge } from "./mercado-pago-pix.service";
import {
  createMercadoPagoPixIdempotencyKey,
  normalizeMercadoPagoStatus,
  resolveMercadoPagoPixExpirationMinutes,
  verifyMercadoPagoWebhookSignature,
} from "../utils/mercado-pago-pix";

vi.mock("server-only", () => ({}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("createMercadoPagoPixIdempotencyKey", () => {
  it("gera no servidor uma chave opaca e estável por tentativa de cobrança", () => {
    const initial = createMercadoPagoPixIdempotencyKey("s".repeat(32), "checkout-id", null);
    const replay = createMercadoPagoPixIdempotencyKey("s".repeat(32), "checkout-id", null);
    const retryAfterExpiration = createMercadoPagoPixIdempotencyKey("s".repeat(32), "checkout-id", "payment-1");

    expect(initial).toMatch(/^[a-f0-9]{64}$/);
    expect(initial).not.toContain("checkout-id");
    expect(replay).toBe(initial);
    expect(retryAfterExpiration).not.toBe(initial);
  });
});

describe("resolveMercadoPagoPixExpirationMinutes", () => {
  it("mantém o vencimento dentro do intervalo aceito pelo Mercado Pago", () => {
    expect(resolveMercadoPagoPixExpirationMinutes(undefined)).toBe(31);
    expect(resolveMercadoPagoPixExpirationMinutes("invalid")).toBe(31);
    expect(resolveMercadoPagoPixExpirationMinutes("10")).toBe(31);
    expect(resolveMercadoPagoPixExpirationMinutes("30")).toBe(31);
    expect(resolveMercadoPagoPixExpirationMinutes("45")).toBe(45);
    expect(resolveMercadoPagoPixExpirationMinutes("90")).toBe(60);
  });
});

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

describe("createMercadoPagoPixCharge", () => {
  it("envia a cobrança Pix com autenticação, idempotência e webhook HTTPS", async () => {
    vi.stubEnv("MERCADO_PAGO_ACCESS_TOKEN", "TEST-access-token");
    vi.stubEnv("MERCADO_PAGO_WEBHOOK_URL", "https://payments.example.com/api/payments/webhooks/mercado-pago");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: 123456,
      status: "pending",
      transaction_amount: 199.9,
      external_reference: "event:event-id:registration:registration-id",
      date_of_expiration: "2026-09-18T21:00:00.000Z",
      point_of_interaction: { transaction_data: { qr_code: "pix-copy-paste" } },
    }), { status: 201, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    await createMercadoPagoPixCharge({
      amount: 199.9,
      participantName: "Ana da Silva",
      payerEmail: "ana@example.com",
      payerCpf: "529.982.247-25",
      eventName: "Conferência",
      externalReference: "event:event-id:registration:registration-id",
      idempotencyKey: "pix_1234567890123456",
      expiresAt: "2026-09-18T21:00:00.000Z",
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.mercadopago.com/v1/payments");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      authorization: "Bearer TEST-access-token",
      "content-type": "application/json",
      "x-idempotency-key": "pix_1234567890123456",
    });
    expect(JSON.parse(String(init.body))).toMatchObject({
      transaction_amount: 199.9,
      payment_method_id: "pix",
      external_reference: "event:event-id:registration:registration-id",
      notification_url: "https://payments.example.com/api/payments/webhooks/mercado-pago",
      date_of_expiration: "2026-09-18T21:00:00.000Z",
      payer: {
        email: "ana@example.com",
        first_name: "Ana",
        last_name: "da Silva",
        identification: { type: "CPF", number: "52998224725" },
      },
    });
  });

  it("recusa webhook sem HTTPS mesmo com credencial de teste", async () => {
    vi.stubEnv("MERCADO_PAGO_ACCESS_TOKEN", "TEST-access-token");
    vi.stubEnv("MERCADO_PAGO_ENV", "test");
    vi.stubEnv("MERCADO_PAGO_WEBHOOK_URL", "http://localhost:3000/api/payments/webhooks/mercado-pago");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(createMercadoPagoPixCharge({
      amount: 10,
      participantName: "Ana Silva",
      payerEmail: "ana@example.com",
      payerCpf: "52998224725",
      eventName: "Evento",
      externalReference: "event:e:registration:r",
      idempotencyKey: "pix_1234567890123456",
      expiresAt: "2026-09-18T21:00:00.000Z",
    })).rejects.toThrow("Configure uma URL HTTPS");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
