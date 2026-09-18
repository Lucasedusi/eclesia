import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  consumePublicCheckoutRateLimit: vi.fn(),
  getPublicTrackingStatus: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/modules/events/services/event-public-checkout.service", () => ({
  getPublicTrackingStatus: mocks.getPublicTrackingStatus,
}));

vi.mock("@/modules/events/services/public-checkout-rate-limit.service", () => ({
  consumePublicCheckoutRateLimit: mocks.consumePublicCheckoutRateLimit,
}));

import { POST } from "./route";

const context = { params: Promise.resolve({ publicCode: "ABC123", slug: "evento" }) };

describe("public event tracking route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.consumePublicCheckoutRateLimit.mockResolvedValue(true);
  });

  it("rejeita o corpo acima do limite antes de consultar o acompanhamento", async () => {
    const response = await POST(new NextRequest("http://localhost/api/public/events/ABC123/evento/tracking", {
      method: "POST",
      body: JSON.stringify({ oversized: "x".repeat(20 * 1024) }),
      headers: { "content-type": "application/json" },
    }), context);

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ message: "Solicitação muito grande." });
    expect(mocks.getPublicTrackingStatus).not.toHaveBeenCalled();
  });

  it("retorna 429 antes de atualizar o provedor quando o limite é excedido", async () => {
    mocks.consumePublicCheckoutRateLimit.mockResolvedValue(false);
    const response = await POST(new NextRequest("http://localhost/api/public/events/ABC123/evento/tracking", {
      method: "POST",
      body: JSON.stringify({ token: "t".repeat(48), refreshProvider: true }),
      headers: { "content-type": "application/json" },
    }), context);

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("900");
    expect(mocks.consumePublicCheckoutRateLimit).toHaveBeenCalledWith("t".repeat(48), "PROVIDER_REFRESH");
    expect(mocks.getPublicTrackingStatus).not.toHaveBeenCalled();
  });
});
