import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  consumePublicCheckoutRateLimit: vi.fn(),
  submitPublicStaticPixReceipt: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/modules/events/services/event-public-checkout.service", () => ({
  submitPublicStaticPixReceipt: mocks.submitPublicStaticPixReceipt,
}));
vi.mock("@/modules/events/services/public-checkout-rate-limit.service", () => ({
  consumePublicCheckoutRateLimit: mocks.consumePublicCheckoutRateLimit,
}));

import { POST } from "./route";

const context = { params: Promise.resolve({ publicCode: "ABC123", slug: "evento" }) };
const checkoutToken = "t".repeat(48);

describe("public static Pix receipt submission route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.consumePublicCheckoutRateLimit.mockResolvedValue(true);
  });

  it("rejeita token inválido antes de consultar o checkout", async () => {
    const response = await POST(new NextRequest("http://localhost/api/public/events/ABC123/evento/payments/pix/static", {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": `static_${"a".repeat(32)}` },
      body: JSON.stringify({ checkoutToken: "curto", receiptPath: "path", receiptFileName: "receipt.pdf", receiptMimeType: "application/pdf", receiptFileSize: 100 }),
    }), context);

    expect(response.status).toBe(400);
    expect(mocks.submitPublicStaticPixReceipt).not.toHaveBeenCalled();
  });

  it("submete comprovante válido com chave idempotente", async () => {
    mocks.submitPublicStaticPixReceipt.mockResolvedValue({ checkoutStatus: "AWAITING_PAYMENT" });
    const idempotencyKey = `static_${"a".repeat(32)}`;
    const payload = {
      checkoutToken,
      receiptPath: "church/events/event/public-individuals/checkout/static-pix/id/receipt.pdf",
      receiptFileName: "receipt.pdf",
      receiptMimeType: "application/pdf",
      receiptFileSize: 2048,
    };
    const response = await POST(new NextRequest("http://localhost/api/public/events/ABC123/evento/payments/pix/static", {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": idempotencyKey },
      body: JSON.stringify(payload),
    }), context);

    expect(response.status).toBe(200);
    expect(mocks.consumePublicCheckoutRateLimit).toHaveBeenCalledWith(checkoutToken, "STATIC_PIX_SUBMIT");
    expect(mocks.submitPublicStaticPixReceipt).toHaveBeenCalledWith({ publicCode: "ABC123", slug: "evento", idempotencyKey, ...payload });
  });
});
