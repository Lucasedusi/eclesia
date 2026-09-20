import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  eq: vi.fn(),
  from: vi.fn(),
  insert: vi.fn(),
  maybeSingle: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));

import { registerMercadoPagoWebhookEvent } from "./mercado-pago-webhook.service";

describe("registerMercadoPagoWebhookEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const retryBuilder = {
      eq: mocks.eq,
      select: mocks.select,
      maybeSingle: mocks.maybeSingle,
    };
    mocks.eq.mockReturnValue(retryBuilder);
    mocks.select.mockReturnValue(retryBuilder);
    mocks.update.mockReturnValue(retryBuilder);
    mocks.from.mockReturnValue({ insert: mocks.insert, update: mocks.update });
    mocks.createAdminClient.mockReturnValue({ from: mocks.from });
    mocks.insert.mockResolvedValue({ error: null });
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
  });

  it("reivindica uma notificação nova com um único insert", async () => {
    await expect(registerMercadoPagoWebhookEvent({ eventId: "order:notification-1", orderId: "ORD01ORDER" }))
      .resolves.toBe(true);

    expect(mocks.insert).toHaveBeenCalledWith({
      provider: "MERCADO_PAGO",
      provider_event_id: "order:notification-1",
      provider_payment_id: "ORD01ORDER",
      payload: { topic: "order" },
    });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("ignora atomicamente uma entrega concorrente já em processamento", async () => {
    mocks.insert.mockResolvedValue({ error: { code: "23505" } });

    await expect(registerMercadoPagoWebhookEvent({ eventId: "order:notification-1", orderId: "ORD01ORDER" }))
      .resolves.toBe(false);

    expect(mocks.update).toHaveBeenCalledWith({ processing_status: "PROCESSING", processed_at: null });
    expect(mocks.eq).toHaveBeenCalledWith("processing_status", "FAILED");
  });

  it("reivindica novamente uma entrega que havia falhado", async () => {
    mocks.insert.mockResolvedValue({ error: { code: "23505" } });
    mocks.maybeSingle.mockResolvedValue({ data: { id: "webhook-row" }, error: null });

    await expect(registerMercadoPagoWebhookEvent({ eventId: "order:notification-1", orderId: "ORD01ORDER" }))
      .resolves.toBe(true);
  });

  it("retorna erro genérico quando não consegue registrar a notificação", async () => {
    mocks.insert.mockResolvedValue({ error: { code: "42501" } });

    await expect(registerMercadoPagoWebhookEvent({ eventId: "order:notification-1", orderId: "ORD01ORDER" }))
      .rejects.toThrow("Não foi possível registrar a notificação.");
  });
});
