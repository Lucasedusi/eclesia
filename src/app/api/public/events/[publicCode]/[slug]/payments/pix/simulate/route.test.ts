import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  approveSimulatedPublicPixPayment: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/modules/events/services/event-public-checkout.service", () => ({
  approveSimulatedPublicPixPayment: mocks.approveSimulatedPublicPixPayment,
}));

import { POST } from "./route";

const context = { params: Promise.resolve({ publicCode: "ABC123", slug: "evento" }) };

describe("public Pix simulation route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejeita o corpo acima do limite antes de aprovar o pagamento simulado", async () => {
    const response = await POST(new NextRequest("http://localhost/api/public/events/ABC123/evento/payments/pix/simulate", {
      method: "POST",
      body: JSON.stringify({ oversized: "x".repeat(20 * 1024) }),
      headers: { "content-type": "application/json" },
    }), context);

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ message: "Solicitação muito grande." });
    expect(mocks.approveSimulatedPublicPixPayment).not.toHaveBeenCalled();
  });
});
