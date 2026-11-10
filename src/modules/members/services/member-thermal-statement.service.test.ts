import { beforeEach, expect, it, vi } from "vitest";
import type { AuthContext } from "@/modules/auth/types/auth.types";
import { prepareMemberThermalStatement } from "./member-thermal-statement.service";
vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({
  client: vi.fn(),
  load: vi.fn(),
  audit: vi.fn(),
  logo: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: m.client }));
vi.mock("./member-financial-data.service", () => ({
  loadMemberFinancialData: m.load,
}));
vi.mock("@/modules/auth/services/church-logo.service", () => ({
  loadChurchLogoDataUri: m.logo,
}));
const context = {
  church: { id: "church" },
  permissions: [
    "members.view_basic",
    "finance.view",
    "members.view_full",
    "members.export",
  ],
} as AuthContext;
const input = {
  memberId: "00000000-0000-4000-8000-000000000001",
  filters: {
    categoryId: "00000000-0000-4000-8000-000000000002",
    dateFrom: "2026-11-01",
  },
  width: 58,
  intent: "print",
};
const query = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  is: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn(),
};
beforeEach(() => {
  vi.clearAllMocks();
  query.maybeSingle.mockResolvedValue({
    data: { name: "Campo", display_church_name: "Campo configurado" },
    error: null,
  });
  m.client.mockResolvedValue({ from: () => query, rpc: m.audit });
  m.audit.mockResolvedValue({ error: null });
  m.logo.mockResolvedValue(null);
  m.load.mockResolvedValue({
    member: { name: "Ana", congregationName: "Central" },
    category: "Missões",
    period: "A partir de 01/11/2026",
    summary: { incomeCents: 1000 },
    items: [
      {
        transactionType: "INCOME",
        status: "CONFIRMED",
        transactionDate: "2026-11-02",
        category: "Missões",
        amount: 10,
        description: "SEGREDO_INTERNO",
        paymentMethod: "INFORMAÇÃO_PRIVADA",
      },
    ],
  });
});
it.each(context.permissions)("requires %s before reading data", async (p) => {
  await expect(
    prepareMemberThermalStatement(
      { ...context, permissions: context.permissions.filter((v) => v !== p) },
      input,
    ),
  ).rejects.toThrow("FORBIDDEN");
  expect(m.load).not.toHaveBeenCalled();
});
it("reuses scoped filtered data, exposes only statement fields and audits the request", async () => {
  const html = await prepareMemberThermalStatement(context, input);
  expect(m.load).toHaveBeenCalledWith(
    context,
    input.memberId,
    { ...input.filters, dateTo: "" },
    { confirmedIncomeOnly: true },
  );
  expect(query.eq).toHaveBeenCalledWith("church_id", "church");
  expect(query.eq).toHaveBeenCalledWith("id", "church");
  expect(html).toContain("Campo configurado");
  expect(html).toContain("Missões");
  expect(html).not.toMatch(/SEGREDO_INTERNO|INFORMAÇÃO_PRIVADA/);
  expect(m.audit).toHaveBeenCalledWith(
    "log_audit",
    expect.objectContaining({
      p_church_id: "church",
      p_entity_id: input.memberId,
      p_metadata: {
        format: "thermal",
        width: 58,
        intent: "print",
        count: 1,
        filtered: true,
      },
    }),
  );
});
it.each([
  { transactionType: "EXPENSE", status: "CONFIRMED" },
  { transactionType: "INCOME", status: "PENDING" },
  { transactionType: "INCOME", status: "CANCELLED" },
])("rejects an inconsistent contribution %j", async (item) => {
  m.load.mockResolvedValue({ items: [item] });
  await expect(prepareMemberThermalStatement(context, input)).rejects.toThrow(
    "UNAVAILABLE",
  );
  expect(m.audit).not.toHaveBeenCalled();
});
it("does not release a statement when audit fails", async () => {
  m.audit.mockResolvedValue({ error: { message: "PRIVATE" } });
  await expect(prepareMemberThermalStatement(context, input)).rejects.toThrow(
    "AUDIT_FAILED",
  );
});
