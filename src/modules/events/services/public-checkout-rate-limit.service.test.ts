import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  eq: vi.fn(),
  from: vi.fn(),
  maybeSingle: vi.fn(),
  rpc: vi.fn(),
  select: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));

import {
  consumePublicCheckoutRateLimit,
  createPublicCheckoutRateLimitKey,
} from "./public-checkout-rate-limit.service";

const checkoutToken = "t".repeat(48);
const eventId = "11111111-1111-4111-8111-111111111111";

describe("public checkout rate limit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("EVENT_CHECKOUT_SECRET", "s".repeat(32));

    const builder = {
      select: mocks.select,
      eq: mocks.eq,
      maybeSingle: mocks.maybeSingle,
    };
    mocks.select.mockReturnValue(builder);
    mocks.eq.mockReturnValue(builder);
    mocks.from.mockReturnValue(builder);
    mocks.createAdminClient.mockReturnValue({ from: mocks.from, rpc: mocks.rpc });
    mocks.maybeSingle.mockResolvedValue({
      data: { event_id: eventId, checkout_type: "INDIVIDUAL" },
      error: null,
    });
    mocks.rpc.mockResolvedValue({ data: true, error: null });
  });

  it("cria chaves opacas e separadas por operação", () => {
    const pixKey = createPublicCheckoutRateLimitKey("s".repeat(32), eventId, checkoutToken, "PIX_CREATE");
    const refreshKey = createPublicCheckoutRateLimitKey("s".repeat(32), eventId, checkoutToken, "PROVIDER_REFRESH");

    expect(pixKey).toMatch(/^[a-f0-9]{64}$/);
    expect(pixKey).not.toContain(checkoutToken);
    expect(refreshKey).not.toBe(pixKey);
  });

  it("resolve o evento pelo hash do token e aplica o limite da criação Pix", async () => {
    await expect(consumePublicCheckoutRateLimit(checkoutToken, "PIX_CREATE")).resolves.toBe(true);

    expect(mocks.from).toHaveBeenCalledWith("event_public_checkouts");
    expect(mocks.eq).toHaveBeenCalledWith(
      "access_token_hash",
      createHash("sha256").update(checkoutToken).digest("hex"),
    );
    expect(mocks.rpc).toHaveBeenCalledWith("consume_event_public_limit", {
      p_event_id: eventId,
      p_key_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
      p_limit: 6,
      p_window_seconds: 600,
    });
  });

  it("propaga a negativa do banco como limite excedido", async () => {
    mocks.rpc.mockResolvedValue({ data: false, error: null });

    await expect(consumePublicCheckoutRateLimit(checkoutToken, "PROVIDER_REFRESH")).resolves.toBe(false);
  });

  it("não consome limite de provedor para acompanhamento de caravana", async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: { event_id: eventId, checkout_type: "CARAVAN" },
      error: null,
    });

    await expect(consumePublicCheckoutRateLimit(checkoutToken, "PROVIDER_REFRESH")).resolves.toBe(true);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejeita tokens desconhecidos sem consumir o limite", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });

    await expect(consumePublicCheckoutRateLimit(checkoutToken, "PIX_CREATE"))
      .rejects.toThrow("Sessão de inscrição não encontrada.");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
