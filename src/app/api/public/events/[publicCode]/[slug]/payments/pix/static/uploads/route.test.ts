import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  consumePublicCheckoutRateLimit: vi.fn(),
  preparePublicStaticPixReceiptUpload: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/modules/events/services/event-public-checkout.service", () => ({
  preparePublicStaticPixReceiptUpload: mocks.preparePublicStaticPixReceiptUpload,
}));
vi.mock("@/modules/events/services/public-checkout-rate-limit.service", () => ({
  consumePublicCheckoutRateLimit: mocks.consumePublicCheckoutRateLimit,
}));

import { POST } from "./route";

const context = { params: Promise.resolve({ publicCode: "ABC123", slug: "evento" }) };
const checkoutToken = "t".repeat(48);

describe("public static Pix receipt upload route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.consumePublicCheckoutRateLimit.mockResolvedValue(true);
  });

  it("rejeita arquivo com formato não permitido antes de preparar o upload", async () => {
    const response = await POST(new NextRequest("http://localhost/api/public/events/ABC123/evento/payments/pix/static/uploads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ checkoutToken, fileName: "comprovante.exe", mimeType: "application/x-msdownload", fileSize: 200 }),
    }), context);

    expect(response.status).toBe(400);
    expect(mocks.preparePublicStaticPixReceiptUpload).not.toHaveBeenCalled();
  });

  it("prepara um caminho privado vinculado ao checkout estático", async () => {
    mocks.preparePublicStaticPixReceiptUpload.mockResolvedValue({ path: "church/events/event/public-individuals/checkout/static-pix/id/receipt.pdf", token: "signed" });
    const response = await POST(new NextRequest("http://localhost/api/public/events/ABC123/evento/payments/pix/static/uploads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ checkoutToken, fileName: "comprovante.pdf", mimeType: "application/pdf", fileSize: 2048 }),
    }), context);

    expect(response.status).toBe(200);
    expect(mocks.consumePublicCheckoutRateLimit).toHaveBeenCalledWith(checkoutToken, "STATIC_PIX_UPLOAD");
    expect(mocks.preparePublicStaticPixReceiptUpload).toHaveBeenCalledWith({
      publicCode: "ABC123", slug: "evento", checkoutToken,
      fileName: "comprovante.pdf", mimeType: "application/pdf", fileSize: 2048,
    });
  });
});
