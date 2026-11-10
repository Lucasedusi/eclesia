import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/modules/auth/types/auth.types";
import { loadMemberFinancialData } from "./member-financial-data.service";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ client: vi.fn(), units: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
vi.mock("@/modules/finance/services/finance-access.service", () => ({
  listFinanceUnits: mocks.units,
}));
const memberId = "00000000-0000-4000-8000-000000000001";
const context = {
  church: { id: "church" },
  access: { scope: "CHURCH" },
  permissions: ["finance.view", "members.view_basic"],
} as AuthContext;
function database(
  options: {
    missing?: boolean;
    foreign?: boolean;
    duplicate?: boolean;
    noMembership?: boolean;
    count?: number;
  } = {},
) {
  const calls: {
    table: string;
    columns?: string;
    filters: [string, unknown][];
  }[] = [];
  const from = vi.fn((table: string) => {
    const call = { table, columns: "", filters: [] as [string, unknown][] };
    calls.push(call);
    const rows = Array.from({ length: 501 }, (_, i) => ({
      id: String(options.duplicate ? 0 : i),
      church_id: options.foreign ? "other" : "church",
      member_id: memberId,
      congregation_id: "unit",
      transaction_type: i === 1 ? "EXPENSE" : "INCOME",
      status: i === 2 ? "CANCELLED" : "CONFIRMED",
      amount: "0.10",
      transaction_date: "2026-11-01",
      category_name: "Dízimo",
      category: { name: "Categoria renomeada" },
    }));
    const q = {
      select: (c: string) => {
        call.columns = c;
        return q;
      },
      eq: (k: string, v: unknown) => {
        call.filters.push([k, v]);
        return q;
      },
      is: (k: string, v: unknown) => {
        call.filters.push([k, v]);
        return q;
      },
      in: (k: string, v: unknown) => {
        call.filters.push([k, v]);
        return q;
      },
      gte: () => q,
      lte: () => q,
      order: () => q,
      range: async (a: number, b: number) => ({
        data: rows.slice(a, b + 1),
        count: options.count ?? rows.length,
        error: null,
      }),
      maybeSingle: async () => ({
        data:
          options.missing ||
          (table === "member_ministries" && options.noMembership)
            ? null
            : {
                id: memberId,
                full_name: "Ana",
                member_code: "001",
                congregation_id: "unit",
                congregation: { region_id: "region" },
              },
        error: null,
      }),
    };
    return q;
  });
  mocks.client.mockResolvedValue({ from });
  return calls;
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.units.mockResolvedValue([
    { id: "unit", capabilities: { view: true } },
    { id: "hidden", capabilities: { view: false } },
  ]);
});
describe("member financial data", () => {
  it("reads all pages, uses unambiguous category relation and totals confirmed movements in cents", async () => {
    const calls = database();
    const result = await loadMemberFinancialData(context, memberId, {});
    expect(result.items).toHaveLength(501);
    expect(result.summary).toMatchObject({
      incomeCents: 4990,
      expenseCents: 10,
      cancelledCents: 10,
    });
    expect(result.items[0].category).toBe("Dízimo");
    const query = calls.find((c) => c.table === "financial_transactions")!;
    expect(query.columns).toContain("financial_categories!finance_tx_category");
    expect(query.filters).toEqual(
      expect.arrayContaining([
        ["church_id", "church"],
        ["member_id", memberId],
        ["congregation_id", ["unit"]],
        ["deleted_at", null],
      ]),
    );
  });
  it("denies access before financial reads when permission or member scope is missing", async () => {
    await expect(
      loadMemberFinancialData({ ...context, permissions: [] }, memberId, {}),
    ).rejects.toThrow("FORBIDDEN");
    expect(mocks.client).not.toHaveBeenCalled();
    const calls = database({ missing: true });
    await expect(
      loadMemberFinancialData(context, memberId, {}),
    ).rejects.toThrow("NOT_FOUND");
    expect(calls.some((c) => c.table === "financial_transactions")).toBe(false);
  });
  it.each([{ foreign: true }, { duplicate: true }])(
    "rejects inconsistent results %j",
    async (options) => {
      database(options);
      await expect(
        loadMemberFinancialData(context, memberId, {}),
      ).rejects.toThrow("UNAVAILABLE");
    },
  );
  it("rejects invalid dates instead of broadening the period", async () => {
    database();
    await expect(
      loadMemberFinancialData(context, memberId, { dateFrom: "2026-02-30" }),
    ).rejects.toThrow();
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it("enforces the selected congregation scope even with a broader grant", async () => {
    database();
    await expect(
      loadMemberFinancialData(
        {
          ...context,
          access: {
            ...context.access,
            scope: "CONGREGATION",
            congregationId: "other",
          },
        },
        memberId,
        {},
      ),
    ).rejects.toThrow("NOT_FOUND");
  });
});

it("checks the active ministry link before allowing a member finance read", async () => {
  const ministryContext = {
    ...context,
    permissions: [...context.permissions, "ministries.view"],
    access: {
      ...context.access,
      scope: "MINISTRY" as const,
      ministryId: "ministry",
    },
  };
  const calls = database();
  await expect(
    loadMemberFinancialData(ministryContext, memberId, {}),
  ).resolves.toMatchObject({ member: { id: memberId } });
  expect(calls.find((c) => c.table === "member_ministries")?.filters).toEqual(
    expect.arrayContaining([
      ["church_id", "church"],
      ["member_id", memberId],
      ["ministry_id", "ministry"],
      ["status", "ACTIVE"],
      ["deleted_at", null],
    ]),
  );
  database({ noMembership: true });
  await expect(
    loadMemberFinancialData(ministryContext, memberId, {}),
  ).rejects.toThrow("NOT_FOUND");
});
it("only allows archived member lookup for users with restore permission", async () => {
  const regular = database();
  await loadMemberFinancialData(context, memberId, {});
  expect(regular.find((c) => c.table === "members")?.filters).toContainEqual([
    "deleted_at",
    null,
  ]);
  const restoring = database();
  await loadMemberFinancialData(
    { ...context, permissions: [...context.permissions, "members.restore"] },
    memberId,
    {},
  );
  expect(
    restoring.find((c) => c.table === "members")?.filters,
  ).not.toContainEqual(["deleted_at", null]);
});
it("rejects oversized periods without truncating transactions", async () => {
  database({ count: 10001 });
  await expect(loadMemberFinancialData(context, memberId, {})).rejects.toThrow(
    "TOO_LARGE",
  );
});
it("labels open ended periods accurately", async () => {
  database();
  expect(
    (
      await loadMemberFinancialData(context, memberId, {
        dateFrom: "2026-11-01",
      })
    ).period,
  ).toBe("A partir de 01/11/2026");
});
