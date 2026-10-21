import { beforeEach, expect, it, vi } from "vitest";
import type { FinanceContext } from "../types/finance.types";

vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn(), logo: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => m }));
vi.mock("@/modules/auth/services/church-logo.service", () => ({ loadChurchLogoDataUri: m.logo }));
import { getFinanceReceipt, recordPrintRequest } from "./finance-receipt.service";

const ctx = {
  churchId: "20000000-0000-4000-8000-000000000001",
  congregationId: "30000000-0000-4000-8000-000000000001",
  capabilities: { view: true },
  auth: { church: { logoUrl: null } },
} as FinanceContext;
const receiptId = "40000000-0000-4000-8000-000000000001";
const recordedAt = "2026-10-20T19:00:00Z";
const snapshot = {
  id: receiptId, number: "FIN-TEST", revision: 1,
  congregationName: "Nome preservado da congregação", date: "2026-10-15",
  personName: "Pessoa fictícia", paymentMethodName: "Dinheiro",
  totalCents: 1234, items: [], registeredAt: "2099-01-01T00:00:00Z",
};
let rows: Record<string, unknown>;
let queries: Record<string, ReturnType<typeof vi.fn>>;

beforeEach(() => {
  vi.clearAllMocks();
  rows = {
    financial_receipts: { id: receiptId, snapshot, receipt_status: "ISSUED", receipt_type: "INCOME", created_at: recordedAt, printed_at: "2026-10-21T12:00:00Z" },
    churches: { name: "Nome cadastral", logo_url: "church-logo", document: " 12.345.678/0001-90 " },
    app_settings: { display_church_name: "Nome do campo", logo_url: "configured-logo" },
    congregations: { address: "Rua da Igreja", number: "25", complement: null, district: "Centro", city: "Porangatu", state: "GO", zip_code: "76550-000" },
  };
  queries = {};
  m.from.mockImplementation((table: string) => {
    const eq = vi.fn(() => q);
    const q = { select: vi.fn(() => q), eq, is: vi.fn(() => q), maybeSingle: vi.fn(async () => ({ data: rows[table] ?? null, error: null })) };
    queries[table] = eq;
    return q;
  });
  m.logo.mockResolvedValue("data:image/png;base64,bG9nbw==");
  m.rpc.mockResolvedValue({ error: null });
});

it("enriches an authorized receipt with scoped identity and its persisted registration time", async () => {
  const result = await getFinanceReceipt(ctx, receiptId);
  expect(result).toMatchObject({
    churchName: "Nome do campo",
    churchDocument: "12.345.678/0001-90",
    logoDataUri: "data:image/png;base64,bG9nbw==",
    congregationAddress: "Rua da Igreja, 25 · Centro · Porangatu / GO · CEP 76550-000",
    congregationName: snapshot.congregationName,
    date: "2026-10-15", registeredAt: recordedAt,
    totalCents: 1234, items: [],
  });
  expect(queries.financial_receipts).toHaveBeenCalledWith("church_id", ctx.churchId);
  expect(queries.financial_receipts).toHaveBeenCalledWith("congregation_id", ctx.congregationId);
  expect(queries.churches).toHaveBeenCalledWith("id", ctx.churchId);
  expect(queries.app_settings).toHaveBeenCalledWith("church_id", ctx.churchId);
  expect(queries.congregations).toHaveBeenCalledWith("church_id", ctx.churchId);
  expect(queries.congregations).toHaveBeenCalledWith("id", ctx.congregationId);
  expect(m.logo).toHaveBeenCalledWith("configured-logo", ctx.churchId, m);
});

it("falls back to the church name and safely omits unavailable address and logo", async () => {
  rows.app_settings = null;
  rows.churches = { name: "Nome cadastral", logo_url: null, document: null };
  rows.congregations = {};
  m.logo.mockResolvedValue(null);
  const result = await getFinanceReceipt(ctx, receiptId);
  expect(result.churchName).toBe("Nome cadastral");
  expect(result.congregationAddress).toBeNull();
  expect(result.churchDocument).toBeNull();
  expect(result.logoDataUri).toBeNull();
});

it("does not load identity or logo for an inaccessible receipt", async () => {
  rows.financial_receipts = null;
  await expect(getFinanceReceipt(ctx, receiptId)).rejects.toThrow("FORBIDDEN");
  expect(m.from).toHaveBeenCalledTimes(1);
  expect(m.logo).not.toHaveBeenCalled();
});

it("rejects a missing capability before querying", async () => {
  await expect(getFinanceReceipt({ ...ctx, capabilities: { ...ctx.capabilities, view: false } }, receiptId)).rejects.toThrow("FORBIDDEN");
  expect(m.from).not.toHaveBeenCalled();
});

it("keeps print auditing independent of header image loading", async () => {
  await recordPrintRequest(ctx, receiptId);
  expect(m.rpc).toHaveBeenCalledWith("record_finance_print_request", { p_church_id: ctx.churchId, p_receipt_id: receiptId });
  expect(m.from).toHaveBeenCalledTimes(1);
  expect(m.logo).not.toHaveBeenCalled();
});
