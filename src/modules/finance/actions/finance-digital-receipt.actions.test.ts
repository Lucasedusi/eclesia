import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ context: vi.fn(), create: vi.fn() }));
vi.mock("next/navigation", () => ({ unstable_rethrow: () => {} }));
vi.mock("../services/finance-access.service", () => ({ requireFinanceContext: m.context }));
vi.mock("../services/finance-digital-receipt.service", () => ({ createFinanceDigitalReceiptLink: m.create }));
import { createFinanceDigitalReceiptLinkAction } from "./finance-digital-receipt.actions";
beforeEach(() => { vi.clearAllMocks(); });
it("requires finance permission and passes the server resolved context", async () => {
  const context = { churchId: "resolved-church", congregationId: "resolved-unit" };
  m.context.mockResolvedValue(context);
  m.create.mockResolvedValue({ url: "https://example.test/comprovante/token", expiresAt: "2026-12-02" });
  const result = await createFinanceDigitalReceiptLinkAction("requested-unit", "receipt");
  expect(m.context).toHaveBeenCalledWith({ congregationId: "requested-unit", permission: "finance.view" });
  expect(m.create).toHaveBeenCalledWith(context, "receipt");
  expect(result.ok).toBe(true);
});
it("never invokes privileged generation after failed authorization", async () => {
  m.context.mockRejectedValue(new Error("PRIVATE_PROVIDER_DETAILS"));
  const result = await createFinanceDigitalReceiptLinkAction("other-unit", "receipt");
  expect(result.ok).toBe(false);
  expect(JSON.stringify(result)).not.toContain("PRIVATE_PROVIDER_DETAILS");
  expect(m.create).not.toHaveBeenCalled();
});
