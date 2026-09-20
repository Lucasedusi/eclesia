import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  consumePublicCheckoutRateLimit: vi.fn(),
  createPublicPixPayment: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/modules/events/services/event-public-checkout.service", () => ({
  createPublicPixPayment: mocks.createPublicPixPayment,
}));

vi.mock("@/modules/events/services/public-checkout-rate-limit.service", () => ({
  consumePublicCheckoutRateLimit: mocks.consumePublicCheckoutRateLimit,
}));

import { POST } from "./route";

const context = { params: Promise.resolve({ publicCode: "ABC123", slug: "evento" }) };

describe("public Pix payment route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.consumePublicCheckoutRateLimit.mockResolvedValue(true);
  });

  it("rejeita o corpo acima do limite antes de criar uma cobrança", async () => {
    const response = await POST(new NextRequest("http://localhost/api/public/events/ABC123/evento/payments/pix", {
      method: "POST",
      body: JSON.stringify({ oversized: "x".repeat(20 * 1024) }),
      headers: { "content-type": "application/json" },
    }), context);

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ message: "Solicitação muito grande." });
    expect(mocks.createPublicPixPayment).not.toHaveBeenCalled();
  });

  it("retorna 429 sem criar cobrança quando o checkout excede o limite", async () => {
    mocks.consumePublicCheckoutRateLimit.mockResolvedValue(false);
    const response = await POST(new NextRequest("http://localhost/api/public/events/ABC123/evento/payments/pix", {
      method: "POST",
      body: JSON.stringify({
        checkoutToken: "t".repeat(48),
        payerEmail: "pagador@example.com",
        payerCpf: "52998224725",
      }),
      headers: { "content-type": "application/json" },
    }), context);

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("900");
    expect(await response.json()).toEqual({ message: "Muitas tentativas. Aguarde alguns minutos e tente novamente." });
    expect(mocks.consumePublicCheckoutRateLimit).toHaveBeenCalledWith("t".repeat(48), "PIX_CREATE");
    expect(mocks.createPublicPixPayment).not.toHaveBeenCalled();
  });

  it("não mascara a rejeição de um checkout que não usa Pix automático", async () => {
    mocks.createPublicPixPayment.mockRejectedValue(new Error("Esta inscrição não utiliza Pix automático."));
    const response = await POST(new NextRequest("http://localhost/api/public/events/ABC123/evento/payments/pix", {
      method: "POST",
      body: JSON.stringify({ checkoutToken: "t".repeat(48), payerEmail: "pagador@example.com", payerCpf: "52998224725" }),
      headers: { "content-type": "application/json" },
    }), context);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ message: "Esta inscrição não utiliza Pix automático." });
  });
});
