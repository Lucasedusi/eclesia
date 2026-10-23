import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  single: vi.fn(),
  parse: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => {
    const q = {
      select: () => q,
      eq: () => q,
      is: () => q,
      single: mocks.single,
    };
    return { rpc: mocks.rpc, from: () => q };
  },
}));
vi.mock("./parser.service", () => ({
  BANK_IMPORT_MAX_BYTES: 5 * 1024 * 1024,
  parseBankStatement: mocks.parse,
}));
import {
  prepareBankImport,
  mutateBankImport,
  getBankImportCandidates,
} from "./service";
import type { FinanceContext } from "../types/finance.types";
const churchId = "20000000-0000-4000-8000-000000000001",
  unit = "30000000-0000-4000-8000-000000000001",
  box = "40000000-0000-4000-8000-000000000001",
  itemId = "50000000-0000-4000-8000-000000000001";
const context = {
  churchId,
  congregationId: unit,
  capabilities: { view: true, create: true },
} as FinanceContext;
const input = {
  unit,
  itemId,
  revision: 1,
  operationKey: "60000000-0000-4000-8000-000000000001",
  action: "IGNORE" as const,
  payload: { reason: "Conferido no teste" },
};
describe("authorized bank import services", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.single.mockResolvedValue({ data: { id: box }, error: null });
    mocks.rpc.mockResolvedValue({ data: { id: itemId }, error: null });
    mocks.parse.mockResolvedValue({ rows: [], balances: [] });
  });
  it("hashes file bytes and derives ownership from authenticated context", async () => {
    await prepareBankImport(
      context,
      box,
      new File(["fictional"], "teste.xlsx"),
    );
    expect(mocks.rpc).toHaveBeenCalledWith(
      "prepare_finance_bank_import",
      expect.objectContaining({
        p_church_id: churchId,
        p_unit: unit,
        p_cashbox: box,
        p_file_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    );
  });
  it("rejects incompatible files and inactive accounts before parsing", async () => {
    await expect(
      prepareBankImport(context, box, new File(["pdf"], "extrato.pdf")),
    ).rejects.toThrow("BANK_IMPORT_FILE");
    mocks.single.mockResolvedValue({ data: null, error: null });
    await expect(
      prepareBankImport(context, box, new File(["xlsx"], "extrato.xlsx")),
    ).rejects.toThrow("INACTIVE_REFERENCE");
    expect(mocks.parse).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("does not accept ownership or source replacement from a request", async () => {
    await expect(
      mutateBankImport(context, { ...input, unit: box }),
    ).rejects.toThrow("FORBIDDEN");
    await expect(
      mutateBankImport(context, { ...input, churchId: box }),
    ).rejects.toThrow();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("passes the item revision and retry key through the authorized atomic RPC", async () => {
    await mutateBankImport(context, input);
    expect(mocks.rpc).toHaveBeenCalledWith("finance_bank_import_item", {
      p_church_id: churchId,
      p_unit: unit,
      p_item: itemId,
      p_revision: 1,
      p_operation_key: input.operationKey,
      p_action: "IGNORE",
      p_payload: input.payload,
    });
  });
  it("keeps database internals out of errors and requires both capabilities", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "sensitive database detail" },
    });
    await expect(getBankImportCandidates(context, itemId, "")).rejects.toThrow(
      "UNAVAILABLE",
    );
    await expect(
      getBankImportCandidates(
        { ...context, capabilities: { ...context.capabilities, view: false } },
        itemId,
        "",
      ),
    ).rejects.toThrow("FORBIDDEN");
  });
});
