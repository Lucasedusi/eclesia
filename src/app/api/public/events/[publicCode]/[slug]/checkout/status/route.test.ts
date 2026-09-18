import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  consumePublicCheckoutRateLimit: vi.fn(),
  getPublicCheckoutStatus: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/modules/events/services/event-public-checkout.service", () => ({
  getPublicCheckoutStatus: mocks.getPublicCheckoutStatus,
}));

vi.mock("@/modules/events/services/public-checkout-rate-limit.service", () => ({
  consumePublicCheckoutRateLimit: mocks.consumePublicCheckoutRateLimit,
}));

import { POST } from "./route";

const context = { params: Promise.resolve({ publicCode: "ABC123", slug: "evento" }) };

describe("public checkout status route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.consumePublicCheckoutRateLimit.mockResolvedValue(true);
  });

  it("rejeita o corpo acima do limite antes de consultar o checkout", async () => {
    const response = await POST(new NextRequest("http://localhost/api/public/events/ABC123/evento/checkout/status", {
      method: "POST",
      body: JSON.stringify({ oversized: "x".repeat(20 * 1024) }),
      headers: { "content-type": "application/json" },
    }), context);

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ message: "Solicitação muito grande." });
    expect(mocks.getPublicCheckoutStatus).not.toHaveBeenCalled();
  });

  it("retorna 429 antes de atualizar o provedor quando o limite é excedido", async () => {
    mocks.consumePublicCheckoutRateLimit.mockResolvedValue(false);
    const response = await POST(new NextRequest("http://localhost/api/public/events/ABC123/evento/checkout/status", {
      method: "POST",
      body: JSON.stringify({ checkoutToken: "t".repeat(48), refreshProvider: true }),
      headers: { "content-type": "application/json" },
    }), context);

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("900");
    expect(mocks.consumePublicCheckoutRateLimit).toHaveBeenCalledWith("t".repeat(48), "PROVIDER_REFRESH");
    expect(mocks.getPublicCheckoutStatus).not.toHaveBeenCalled();
  });

  it("não consome o limite quando consulta apenas o estado local", async () => {
    mocks.getPublicCheckoutStatus.mockResolvedValue({ checkoutStatus: "AWAITING_PAYMENT" });
    const response = await POST(new NextRequest("http://localhost/api/public/events/ABC123/evento/checkout/status", {
      method: "POST",
      body: JSON.stringify({ checkoutToken: "t".repeat(48), refreshProvider: false }),
      headers: { "content-type": "application/json" },
    }), context);

    expect(response.status).toBe(200);
    expect(mocks.consumePublicCheckoutRateLimit).not.toHaveBeenCalled();
    expect(mocks.getPublicCheckoutStatus).toHaveBeenCalledWith("ABC123", "evento", "t".repeat(48), false);
  });
});
