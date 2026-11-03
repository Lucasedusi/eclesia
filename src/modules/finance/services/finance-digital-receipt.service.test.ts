import { beforeEach, expect, it, vi } from "vitest";
import type { FinanceContext } from "../types/finance.types";

vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({ auth: { rpc: vi.fn() }, admin: { rpc: vi.fn(), from: vi.fn() }, adminFactory: vi.fn(), receipt: vi.fn(), logo: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => m.auth }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: m.adminFactory }));
vi.mock("./finance-receipt.service", () => ({ getFinanceReceipt: m.receipt }));
vi.mock("@/modules/auth/services/church-logo.service", () => ({ loadChurchLogoDataUri: m.logo }));
import { createFinanceDigitalReceiptLink, loadPublicFinanceReceipt } from "./finance-digital-receipt.service";

const churchId = "20000000-0000-4000-8000-000000000001";
const unitId = "30000000-0000-4000-8000-000000000001";
const receiptId = "40000000-0000-4000-8000-000000000001";
const ctx = { churchId, congregationId: unitId, capabilities: { view: true } } as FinanceContext;
const token = "a".repeat(43);
const snapshot = { number: "FIN-TEST", congregationName: "Congregação Teste", personName: "Pessoa fictícia", date: "2026-10-15", paymentMethodName: "Pix", totalCents: 12000, items: [{ transactionId: receiptId, categoryName: "Oferta", departmentName: "Tesouraria", classificationName: null, amountCents: 12000 }], notes: "PRIVATE", cpf: "PRIVATE", id: receiptId };
let rows: Record<string, unknown>;
let queries: Record<string, ReturnType<typeof vi.fn>>;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://igreja.test");
  m.receipt.mockResolvedValue({ status: "ISSUED" });
  m.auth.rpc.mockResolvedValue({ data: "2026-12-02T20:00:00Z", error: null });
  m.adminFactory.mockReturnValue(m.admin);
  m.admin.rpc.mockResolvedValue({ data: [{ church_id: churchId, congregation_id: unitId, receipt_id: receiptId }], error: null });
  m.logo.mockResolvedValue(null);
  rows = { financial_receipts: { snapshot, receipt_type: "INCOME", receipt_status: "ISSUED", created_at: "2026-10-15T19:00:00Z" }, churches: { name: "Igreja Teste", logo_url: null, document: null }, app_settings: null, congregations: { name: "Congregação Teste" } };
  queries = {};
  m.admin.from.mockImplementation((table: string) => {
    const q = { select: vi.fn(() => q), eq: vi.fn(() => q), is: vi.fn(() => q), in: vi.fn(() => q), maybeSingle: vi.fn(async () => ({ data: rows[table], error: null })) };
    queries[table] = q.eq;
    return q;
  });
});

it("authorizes before issuing and stores only a hash through the authenticated RPC", async () => {
  const result = await createFinanceDigitalReceiptLink(ctx, receiptId);
  expect(m.receipt).toHaveBeenCalledWith(ctx, receiptId);
  expect(result.url).toMatch(/^https:\/\/igreja.test\/comprovante\/[A-Za-z0-9_-]{43}$/);
  expect(result.expiresAt).toBe("2026-12-02T20:00:00Z");
  const args = m.auth.rpc.mock.calls[0][1];
  expect(args).toMatchObject({ p_church_id: churchId, p_receipt_id: receiptId });
  expect(args.p_token_hash).toMatch(/^[a-f0-9]{64}$/);
  expect(JSON.stringify(args)).not.toContain(result.url.split("/").at(-1));
  expect(m.adminFactory).not.toHaveBeenCalled();
});

it.each(["CANCELLED", "SUPERSEDED"])("rejects %s before issuing a link", async (status) => {
  m.receipt.mockResolvedValue({ status });
  await expect(createFinanceDigitalReceiptLink(ctx, receiptId)).rejects.toThrow();
  expect(m.auth.rpc).not.toHaveBeenCalled();
});

it("does not bypass denied scope", async () => {
  m.receipt.mockRejectedValue(new Error("FORBIDDEN"));
  await expect(createFinanceDigitalReceiptLink(ctx, receiptId)).rejects.toThrow("FORBIDDEN");
  expect(m.auth.rpc).not.toHaveBeenCalled();
});

it("rejects malformed tokens without calling the database", async () => {
  expect(await loadPublicFinanceReceipt("invalid")).toBeNull();
  expect(m.adminFactory).not.toHaveBeenCalled();
});

it("returns no data for expired, unknown, revoked or rate limited links", async () => {
  m.admin.rpc.mockResolvedValue({ data: [], error: null });
  expect(await loadPublicFinanceReceipt(token)).toBeNull();
  expect(m.admin.from).not.toHaveBeenCalled();
});

it("projects only receipt fields and scopes each privileged read", async () => {
  const result = await loadPublicFinanceReceipt(token);
  expect(result).toMatchObject({ churchName: "Igreja Teste", personName: "Pessoa fictícia", totalCents: 12000, registeredAt: "2026-10-15T19:00:00Z" });
  expect(JSON.stringify(result)).not.toContain("PRIVATE");
  expect(JSON.stringify(result)).not.toContain(receiptId);
  expect(queries.financial_receipts).toHaveBeenCalledWith("church_id", churchId);
  expect(queries.financial_receipts).toHaveBeenCalledWith("congregation_id", unitId);
  expect(queries.financial_receipts).toHaveBeenCalledWith("id", receiptId);
  expect(queries.congregations).toHaveBeenCalledWith("church_id", churchId);
  expect(queries.congregations).toHaveBeenCalledWith("id", unitId);
});

it.each(["CANCELLED", "SUPERSEDED"])("fails closed when a receipt becomes %s after token lookup", async (status) => {
  rows.financial_receipts = { ...(rows.financial_receipts as object), receipt_status: status };
  expect(await loadPublicFinanceReceipt(token)).toBeNull();
  expect(m.logo).not.toHaveBeenCalled();
});

it("fails closed on a deleted church or invalid snapshot", async () => {
  rows.churches = null;
  expect(await loadPublicFinanceReceipt(token)).toBeNull();
  rows.financial_receipts = { snapshot: { ...snapshot, totalCents: -1 }, receipt_status: "ISSUED" };
  expect(await loadPublicFinanceReceipt(token)).toBeNull();
});
