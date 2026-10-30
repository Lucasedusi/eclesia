import { describe, expect, it, vi } from "vitest";
import { payableCommandSchema, payableQuerySchema } from "./finance-payable.schemas";
const id = "10000000-0000-4000-8000-000000000001";
const values = { name: "Energia", categoryId: id, dueDate: "2026-10-30", amountCents: null, notes: "" };
describe("payable inputs", () => {
  it("allows unknown amounts but rejects zero, impossible dates and client ownership", () => {
    const command = { kind: "CREATE", requestId: id, values };
    expect(payableCommandSchema.safeParse(command).success).toBe(true);
    for (const change of [{ amountCents: 0 }, { amountCents: -1 }, { dueDate: "2026-02-30" }, { churchId: id }])
      expect(payableCommandSchema.safeParse({ ...command, values: { ...values, ...change } }).success).toBe(false);
    expect(payableCommandSchema.safeParse({ ...command, congregationId: id }).success).toBe(false);
  });
  it("requires a reason when reopening and forbids future payment", () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-30T15:00:00Z"));
    try {
      const base = { requestId: id, id, revision: 1 };
      expect(payableCommandSchema.safeParse({ ...base, kind: "PAY", paidDate: "2026-10-29" }).success).toBe(true);
      expect(payableCommandSchema.safeParse({ ...base, kind: "PAY", paidDate: "2026-10-31" }).success).toBe(false);
      expect(payableCommandSchema.safeParse({ ...base, kind: "REOPEN", reason: " " }).success).toBe(false);
    } finally { vi.useRealTimers(); }
  });
  it("rejects incomplete or reversed periods, accepts explicit range instead of month", () => {
    expect(payableQuerySchema.safeParse({ month: "2026-10", dateFrom: "2026-09-01" }).success).toBe(false);
    expect(payableQuerySchema.safeParse({ month: "2026-10", dateFrom: "2026-11-01", dateTo: "2026-10-01" }).success).toBe(false);
    expect(payableQuerySchema.parse({ month: "2026-10", dateFrom: "2026-09-01", dateTo: "2026-11-01" }).page).toBe(1);
  });
  it("rejects repeated sources and dates outside the next month", () => {
    const item = { sourceId: id, revision: 1, categoryId: id, dueDate: "2026-11-30", amountCents: null };
    const command = { requestId: id, kind: "COPY", sourceMonth: "2026-10", items: [item] };
    expect(payableCommandSchema.safeParse(command).success).toBe(true);
    expect(payableCommandSchema.safeParse({ ...command, items: [item, item] }).success).toBe(false);
    expect(payableCommandSchema.safeParse({ ...command, items: [{ ...item, dueDate: "2026-12-01" }] }).success).toBe(false);
  });
});
