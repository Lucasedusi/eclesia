import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  finishMercadoPagoWebhookEvent: vi.fn(),
  reconcileMercadoPagoPayment: vi.fn(),
  registerMercadoPagoWebhookEvent: vi.fn(),
  verifyMercadoPagoWebhookSignature: vi.fn(() => true),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/modules/events/services/event-public-checkout.service", () => ({
  reconcileMercadoPagoPayment: mocks.reconcileMercadoPagoPayment,
}));

vi.mock("@/modules/events/services/mercado-pago-webhook.service", () => ({
  finishMercadoPagoWebhookEvent: mocks.finishMercadoPagoWebhookEvent,
  registerMercadoPagoWebhookEvent: mocks.registerMercadoPagoWebhookEvent,
}));

vi.mock("@/modules/events/services/mercado-pago-pix.service", () => ({
  verifyMercadoPagoWebhookSignature: mocks.verifyMercadoPagoWebhookSignature,
}));

import { POST } from "./route";

function webhookRequest(body: unknown, dataId = "123") {
  return new NextRequest(`http://localhost/api/payments/webhooks/mercado-pago?data.id=${dataId}`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      "x-request-id": "request-id",
      "x-signature": "ts=1,v1=signature",
    },
  });
}

describe("Mercado Pago webhook route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyMercadoPagoWebhookSignature.mockReturnValue(true);
  });

  it("rejeita o corpo acima do limite antes de registrar o evento", async () => {
    const response = await POST(new NextRequest("http://localhost/api/payments/webhooks/mercado-pago?data.id=123", {
      method: "POST",
      body: JSON.stringify({ oversized: "x".repeat(20 * 1024) }),
      headers: {
        "content-type": "application/json",
        "x-request-id": "request-id",
        "x-signature": "ts=1,v1=signature",
      },
    }));

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ message: "Solicitação muito grande." });
    expect(mocks.registerMercadoPagoWebhookEvent).not.toHaveBeenCalled();
    expect(mocks.reconcileMercadoPagoPayment).not.toHaveBeenCalled();
  });

  it("rejeita a notificação antes de ler ou processar quando a assinatura é inválida", async () => {
    mocks.verifyMercadoPagoWebhookSignature.mockReturnValue(false);

    const response = await POST(webhookRequest({ type: "payment", data: { id: "123" } }));

    expect(response.status).toBe(401);
    expect(mocks.registerMercadoPagoWebhookEvent).not.toHaveBeenCalled();
    expect(mocks.reconcileMercadoPagoPayment).not.toHaveBeenCalled();
  });

  it("reconsulta o pagamento e conclui um evento assinado", async () => {
    mocks.registerMercadoPagoWebhookEvent.mockResolvedValue(true);
    mocks.reconcileMercadoPagoPayment.mockResolvedValue("CONFIRMED");
    mocks.finishMercadoPagoWebhookEvent.mockResolvedValue(undefined);

    const response = await POST(webhookRequest({
      id: "notification-123",
      type: "payment",
      action: "payment.updated",
      data: { id: "123" },
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
    expect(mocks.registerMercadoPagoWebhookEvent).toHaveBeenCalledWith({
      eventId: "notification-123",
      paymentId: "123",
    });
    expect(mocks.reconcileMercadoPagoPayment).toHaveBeenCalledWith("123");
    expect(mocks.finishMercadoPagoWebhookEvent).toHaveBeenCalledWith("notification-123", "PROCESSED");
  });

  it("confirma uma entrega duplicada sem reconciliar novamente", async () => {
    mocks.registerMercadoPagoWebhookEvent.mockResolvedValue(false);

    const response = await POST(webhookRequest({
      id: "notification-123",
      type: "payment",
      data: { id: "123" },
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true, duplicate: true });
    expect(mocks.reconcileMercadoPagoPayment).not.toHaveBeenCalled();
    expect(mocks.finishMercadoPagoWebhookEvent).not.toHaveBeenCalled();
  });
});
