import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  finishMercadoPagoWebhookEvent: vi.fn(),
  reconcileMercadoPagoOrder: vi.fn(),
  registerMercadoPagoWebhookEvent: vi.fn(),
  verifyMercadoPagoWebhookSignature: vi.fn(() => true),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/modules/events/services/event-public-checkout.service", () => ({
  reconcileMercadoPagoOrder: mocks.reconcileMercadoPagoOrder,
}));

vi.mock("@/modules/events/services/mercado-pago-webhook.service", () => ({
  finishMercadoPagoWebhookEvent: mocks.finishMercadoPagoWebhookEvent,
  registerMercadoPagoWebhookEvent: mocks.registerMercadoPagoWebhookEvent,
}));

vi.mock("@/modules/events/services/mercado-pago-pix.service", () => ({
  verifyMercadoPagoWebhookSignature: mocks.verifyMercadoPagoWebhookSignature,
}));

import { POST } from "./route";

function webhookRequest(body: unknown, dataId = "ORD01ORDER") {
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
    const response = await POST(new NextRequest("http://localhost/api/payments/webhooks/mercado-pago?data.id=ORD01ORDER&type=order", {
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
    expect(mocks.reconcileMercadoPagoOrder).not.toHaveBeenCalled();
  });

  it("rejeita a notificação antes de ler ou processar quando a assinatura é inválida", async () => {
    mocks.verifyMercadoPagoWebhookSignature.mockReturnValue(false);

    const response = await POST(webhookRequest({ type: "order", data: { id: "ORD01ORDER" } }));

    expect(response.status).toBe(401);
    expect(mocks.registerMercadoPagoWebhookEvent).not.toHaveBeenCalled();
    expect(mocks.reconcileMercadoPagoOrder).not.toHaveBeenCalled();
  });

  it("reconsulta o pagamento e conclui um evento assinado", async () => {
    mocks.registerMercadoPagoWebhookEvent.mockResolvedValue(true);
    mocks.reconcileMercadoPagoOrder.mockResolvedValue("CONFIRMED");
    mocks.finishMercadoPagoWebhookEvent.mockResolvedValue(undefined);

    const response = await POST(webhookRequest({
      id: "notification-123",
      type: "order",
      action: "order.processed",
      data: { id: "ORD01ORDER" },
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
    expect(mocks.registerMercadoPagoWebhookEvent).toHaveBeenCalledWith({
      eventId: "order:notification-123",
      orderId: "ORD01ORDER",
    });
    expect(mocks.reconcileMercadoPagoOrder).toHaveBeenCalledWith("ORD01ORDER");
    expect(mocks.finishMercadoPagoWebhookEvent).toHaveBeenCalledWith("order:notification-123", "PROCESSED");
  });

  it("confirma uma entrega duplicada sem reconciliar novamente", async () => {
    mocks.registerMercadoPagoWebhookEvent.mockResolvedValue(false);

    const response = await POST(webhookRequest({
      id: "notification-123",
      type: "order",
      data: { id: "ORD01ORDER" },
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true, duplicate: true });
    expect(mocks.reconcileMercadoPagoOrder).not.toHaveBeenCalled();
    expect(mocks.finishMercadoPagoWebhookEvent).not.toHaveBeenCalled();
  });

  it("ignora notificações da Payments API legada", async () => {
    const response = await POST(webhookRequest({
      id: "notification-legacy",
      type: "payment",
      data: { id: "123" },
    }, "123"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
    expect(mocks.registerMercadoPagoWebhookEvent).not.toHaveBeenCalled();
    expect(mocks.reconcileMercadoPagoOrder).not.toHaveBeenCalled();
  });
});
