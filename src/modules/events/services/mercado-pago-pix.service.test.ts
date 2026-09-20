import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMercadoPagoPixCharge, getMercadoPagoPayment, mercadoPagoPaymentMetadata } from "./mercado-pago-pix.service";
import {
  createMercadoPagoPixIdempotencyKey,
  createMercadoPagoPixExternalReference,
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

describe("createMercadoPagoPixExternalReference", () => {
  it("gera uma referência aceita pela Orders API sem expor o evento", () => {
    const reference = createMercadoPagoPixExternalReference("91D90C0E-DF8C-4A82-A49F-C1478BFA42F2");

    expect(reference).toBe("event_91d90c0edf8c4a82a49fc1478bfa42f2");
    expect(reference.length).toBeLessThanOrEqual(64);
    expect(reference).toMatch(/^[a-z0-9_]+$/);
  });

  it("rejeita um identificador local que não seja UUID", () => {
    expect(() => createMercadoPagoPixExternalReference("registration:123"))
      .toThrow("Identificador de inscrição inválido");
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
    expect(normalizeMercadoPagoStatus("processed")).toBe("CONFIRMED");
    expect(normalizeMercadoPagoStatus("in_process")).toBe("PENDING");
    expect(normalizeMercadoPagoStatus("rejected")).toBe("FAILED");
    expect(normalizeMercadoPagoStatus("failed")).toBe("FAILED");
    expect(normalizeMercadoPagoStatus("refunded")).toBe("REFUNDED");
    expect(normalizeMercadoPagoStatus("expired")).toBe("EXPIRED");
    expect(normalizeMercadoPagoStatus("canceled")).toBe("CANCELLED");
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
  it("cria uma order Pix de produção com autenticação e idempotência", async () => {
    vi.stubEnv("MERCADO_PAGO_ACCESS_TOKEN", "TEST-access-token");
    vi.stubEnv("MERCADO_PAGO_ENV", "production");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: "ORD01ORDER",
      status: "action_required",
      status_detail: "waiting_transfer",
      total_amount: "199.90",
      external_reference: "event_91d90c0edf8c4a82a49fc1478bfa42f2",
      created_date: "2026-09-18T20:00:00.000Z",
      transactions: {
        payments: [{
          id: "PAY01PAYMENT",
          status: "action_required",
          status_detail: "waiting_transfer",
          amount: "199.90",
          date_of_expiration: "2026-09-18T20:45:00.000Z",
          payment_method: {
            id: "pix",
            type: "bank_transfer",
            qr_code: "pix-copy-paste",
            qr_code_base64: "base64-qr",
            ticket_url: "https://www.mercadopago.com.br/sandbox/payments/pix",
          },
        }],
      },
    }), { status: 201, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    vi.setSystemTime(new Date("2026-09-18T20:00:00.000Z"));

    const payment = await createMercadoPagoPixCharge({
      amount: 199.9,
      participantName: "Ana da Silva",
      payerEmail: "ana@example.com",
      payerCpf: "529.982.247-25",
      externalReference: "event_91d90c0edf8c4a82a49fc1478bfa42f2",
      idempotencyKey: "pix_1234567890123456",
      expiresAt: "2026-09-18T20:31:00.000Z",
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.mercadopago.com/v1/orders");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      authorization: "Bearer TEST-access-token",
      "content-type": "application/json",
      "x-idempotency-key": "pix_1234567890123456",
    });
    expect(JSON.parse(String(init.body))).toEqual({
      type: "online",
      total_amount: "199.90",
      external_reference: "event_91d90c0edf8c4a82a49fc1478bfa42f2",
      processing_mode: "automatic",
      transactions: {
        payments: [{
          amount: "199.90",
          payment_method: { id: "pix", type: "bank_transfer" },
          expiration_time: "PT31M",
        }],
      },
      payer: {
        email: "ana@example.com",
        first_name: "Ana",
        last_name: "da Silva",
        identification: { type: "CPF", number: "52998224725" },
      },
    });
    expect(payment).toMatchObject({
      id: "ORD01ORDER",
      provider_order_id: "ORD01ORDER",
      provider_transaction_id: "PAY01PAYMENT",
      status: "action_required",
      transaction_amount: 199.9,
      date_of_expiration: "2026-09-18T20:45:00.000Z",
      point_of_interaction: {
        transaction_data: {
          qr_code: "pix-copy-paste",
          qr_code_base64: "base64-qr",
          ticket_url: "https://www.mercadopago.com.br/sandbox/payments/pix",
        },
      },
    });
  });

  it("usa os dados predefinidos oficiais no ambiente de teste", async () => {
    vi.stubEnv("MERCADO_PAGO_ACCESS_TOKEN", "TEST-access-token");
    vi.stubEnv("MERCADO_PAGO_ENV", "test");
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ tags: ["test_user", "normal"] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: "ORD01TEST",
        total_amount: "50.00",
        external_reference: "event_91d90c0edf8c4a82a49fc1478bfa42f2",
        transactions: { payments: [{ id: "PAY01TEST", amount: "50.00", status: "action_required", payment_method: { id: "pix", type: "bank_transfer", qr_code: "pix" } }] },
      }), { status: 201 })));
    vi.setSystemTime(new Date("2026-09-18T20:00:00.000Z"));

    await createMercadoPagoPixCharge({
      amount: 50,
      participantName: "Ana Silva",
      payerEmail: "ana@example.com",
      payerCpf: "52998224725",
      externalReference: "event_91d90c0edf8c4a82a49fc1478bfa42f2",
      idempotencyKey: "pix_1234567890123456",
      expiresAt: "2026-09-18T20:31:00.000Z",
    });

    const fetchMock = vi.mocked(fetch);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.mercadopago.com/users/me");
    const [, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(JSON.parse(String(init.body)).payer).toEqual({
      email: "test_user_br@testuser.com",
      first_name: "APRO",
    });
  });

  it("bloqueia uma credencial de produção configurada como ambiente de teste", async () => {
    vi.stubEnv("MERCADO_PAGO_ACCESS_TOKEN", "LIVE-access-token");
    vi.stubEnv("MERCADO_PAGO_ENV", "test");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ tags: ["normal"] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(createMercadoPagoPixCharge({
      amount: 50,
      participantName: "Ana Silva",
      payerEmail: "ana@example.com",
      payerCpf: "52998224725",
      externalReference: "event_91d90c0edf8c4a82a49fc1478bfa42f2",
      idempotencyKey: "pix_1234567890123456",
      expiresAt: "2026-09-18T20:31:00.000Z",
    })).rejects.toThrow("não pertence a uma conta de teste");

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.mercadopago.com/users/me");
  });

  it("não depende de notification_url no payload da Orders API", async () => {
    vi.stubEnv("MERCADO_PAGO_ACCESS_TOKEN", "TEST-access-token");
    vi.stubEnv("MERCADO_PAGO_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: "ORD01WITHOUTNOTIFICATIONURL",
      status: "action_required",
      total_amount: "10.00",
      transactions: {
        payments: [{
          id: "PAY01WITHOUTNOTIFICATIONURL",
          amount: "10.00",
          status: "action_required",
          payment_method: { id: "pix", type: "bank_transfer", qr_code: "pix" },
        }],
      },
    }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    await createMercadoPagoPixCharge({
      amount: 10,
      participantName: "Ana Silva",
      payerEmail: "ana@example.com",
      payerCpf: "52998224725",
      externalReference: "event_91d90c0edf8c4a82a49fc1478bfa42f2",
      idempotencyKey: "pix_1234567890123456",
      expiresAt: "2026-09-18T21:00:00.000Z",
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).not.toHaveProperty("notification_url");
  });

  it("consulta a order criada quando a transação ainda não veio na resposta inicial", async () => {
    vi.stubEnv("MERCADO_PAGO_ACCESS_TOKEN", "TEST-access-token");
    vi.stubEnv("MERCADO_PAGO_ENV", "production");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: "ORD01ASYNC",
        status: "processing",
        total_amount: "25.00",
        external_reference: "event_91d90c0edf8c4a82a49fc1478bfa42f2",
      }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: "ORD01ASYNC",
        status: "action_required",
        total_amount: "25.00",
        external_reference: "event_91d90c0edf8c4a82a49fc1478bfa42f2",
        transactions: {
          payments: [{
            id: "PAY01ASYNC",
            amount: "25.00",
            status: "action_required",
            payment_method: { id: "pix", type: "bank_transfer", qr_code: "pix-async" },
          }],
        },
      }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const payment = await createMercadoPagoPixCharge({
      amount: 25,
      participantName: "Ana Silva",
      payerEmail: "ana@example.com",
      payerCpf: "52998224725",
      externalReference: "event_91d90c0edf8c4a82a49fc1478bfa42f2",
      idempotencyKey: "pix_1234567890123456",
      expiresAt: "2026-09-18T21:00:00.000Z",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://api.mercadopago.com/v1/orders/ORD01ASYNC");
    expect(payment).toMatchObject({
      id: "ORD01ASYNC",
      provider_order_id: "ORD01ASYNC",
      provider_transaction_id: "PAY01ASYNC",
      status: "action_required",
    });
  });

  it("preserva a order para conciliação mesmo enquanto a transação está sendo criada", async () => {
    vi.stubEnv("MERCADO_PAGO_ACCESS_TOKEN", "TEST-access-token");
    vi.stubEnv("MERCADO_PAGO_ENV", "production");
    const processingOrder = {
      id: "ORD01STILLPROCESSING",
      status: "processing",
      status_detail: "processing",
      total_amount: "25.00",
      external_reference: "event_91d90c0edf8c4a82a49fc1478bfa42f2",
      created_date: "2026-09-18T20:00:00.000Z",
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(processingOrder), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(processingOrder), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(createMercadoPagoPixCharge({
      amount: 25,
      participantName: "Ana Silva",
      payerEmail: "ana@example.com",
      payerCpf: "52998224725",
      externalReference: "event_91d90c0edf8c4a82a49fc1478bfa42f2",
      idempotencyKey: "pix_1234567890123456",
      expiresAt: "2026-09-18T21:00:00.000Z",
    })).resolves.toMatchObject({
      id: "ORD01STILLPROCESSING",
      provider_order_id: "ORD01STILLPROCESSING",
      status: "processing",
      transaction_amount: 25,
      date_of_expiration: "2026-09-18T21:00:00.000Z",
    });
  });

  it("preserva a order criada quando a consulta complementar falha por transporte", async () => {
    vi.stubEnv("MERCADO_PAGO_ACCESS_TOKEN", "TEST-access-token");
    vi.stubEnv("MERCADO_PAGO_ENV", "production");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: "ORD01TRANSPORTFAILURE",
        status: "processing",
        total_amount: "25.00",
        external_reference: "event_91d90c0edf8c4a82a49fc1478bfa42f2",
      }), { status: 201 }))
      .mockRejectedValueOnce(new TypeError("fetch failed"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(createMercadoPagoPixCharge({
      amount: 25,
      participantName: "Ana Silva",
      payerEmail: "ana@example.com",
      payerCpf: "52998224725",
      externalReference: "event_91d90c0edf8c4a82a49fc1478bfa42f2",
      idempotencyKey: "pix_1234567890123456",
      expiresAt: "2026-09-18T21:00:00.000Z",
    })).resolves.toMatchObject({
      id: "ORD01TRANSPORTFAILURE",
      provider_order_id: "ORD01TRANSPORTFAILURE",
      status: "processing",
      transaction_amount: 25,
    });
  });

  it("mescla uma consulta complementar parcial com os dados da order criada", async () => {
    vi.stubEnv("MERCADO_PAGO_ACCESS_TOKEN", "TEST-access-token");
    vi.stubEnv("MERCADO_PAGO_ENV", "production");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: "ORD01SPARSE",
        status: "processing",
        total_amount: "25.00",
        external_reference: "event_91d90c0edf8c4a82a49fc1478bfa42f2",
        created_date: "2026-09-18T20:00:00.000Z",
      }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: "ORD01SPARSE",
        status: "processing",
      }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(createMercadoPagoPixCharge({
      amount: 25,
      participantName: "Ana Silva",
      payerEmail: "ana@example.com",
      payerCpf: "52998224725",
      externalReference: "event_91d90c0edf8c4a82a49fc1478bfa42f2",
      idempotencyKey: "pix_1234567890123456",
      expiresAt: "2026-09-18T21:00:00.000Z",
    })).resolves.toMatchObject({
      id: "ORD01SPARSE",
      provider_order_id: "ORD01SPARSE",
      status: "processing",
      transaction_amount: 25,
      external_reference: "event_91d90c0edf8c4a82a49fc1478bfa42f2",
      date_created: "2026-09-18T20:00:00.000Z",
    });
  });

  it("rejeita external_reference fora do contrato da Orders API antes de chamar o provedor", async () => {
    vi.stubEnv("MERCADO_PAGO_ACCESS_TOKEN", "TEST-access-token");
    vi.stubEnv("MERCADO_PAGO_ENV", "production");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(createMercadoPagoPixCharge({
      amount: 10,
      participantName: "Ana Silva",
      payerEmail: "ana@example.com",
      payerCpf: "52998224725",
      externalReference: "event:com:caracteres:invalidos",
      idempotencyKey: "pix_1234567890123456",
      expiresAt: "2026-09-18T21:00:00.000Z",
    })).rejects.toThrow("referência externa");

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("getMercadoPagoPayment", () => {
  it("consulta uma order e normaliza a transação Pix", async () => {
    vi.stubEnv("MERCADO_PAGO_ACCESS_TOKEN", "TEST-access-token");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: "ORD01ORDER",
      total_amount: "80.00",
      external_reference: "event:e:registration:r",
      last_updated_date: "2026-09-18T20:05:00.000Z",
      transactions: {
        payments: [{
          id: "PAY01PAYMENT",
          amount: "80.00",
          status: "processed",
          status_detail: "accredited",
          date_of_expiration: "2026-09-18T20:45:00.000Z",
          payment_method: { id: "pix", type: "bank_transfer" },
        }],
      },
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const payment = await getMercadoPagoPayment("ORD01ORDER");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.mercadopago.com/v1/orders/ORD01ORDER",
      expect.objectContaining({ cache: "no-store" }),
    );
    expect(payment).toMatchObject({
      id: "ORD01ORDER",
      provider_order_id: "ORD01ORDER",
      provider_transaction_id: "PAY01PAYMENT",
      status: "processed",
      transaction_amount: 80,
      date_approved: "2026-09-18T20:05:00.000Z",
      date_of_expiration: "2026-09-18T20:45:00.000Z",
    });
  });

  it("mantém a consulta da Payments API para IDs legados numéricos", async () => {
    vi.stubEnv("MERCADO_PAGO_ACCESS_TOKEN", "TEST-access-token");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: 123456,
      status: "approved",
      transaction_amount: 80,
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await getMercadoPagoPayment("123456");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.mercadopago.com/v1/payments/123456",
      expect.objectContaining({ cache: "no-store" }),
    );
  });
});

describe("mercadoPagoPaymentMetadata", () => {
  it("preserva os IDs da order e da transação para conciliação", () => {
    expect(mercadoPagoPaymentMetadata({
      id: "ORD01ORDER",
      provider_order_id: "ORD01ORDER",
      provider_transaction_id: "PAY01PAYMENT",
      status: "processed",
      status_detail: "accredited",
      transaction_amount: 80,
      payment_method_id: "pix",
    })).toEqual({
      statusDetail: "accredited",
      paymentMethodId: "pix",
      providerOrderId: "ORD01ORDER",
      providerTransactionId: "PAY01PAYMENT",
    });
  });
});
