import { beforeEach, expect, it, vi } from "vitest";
import type { AuthContext } from "@/modules/auth/types/auth.types";
import { generateMemberFinancialDownload } from "./member-financial-report.service";
vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({
  client: vi.fn(),
  load: vi.fn(),
  pdf: vi.fn(),
  excel: vi.fn(),
  logo: vi.fn(),
  audit: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: m.client }));
vi.mock("./member-financial-data.service", () => ({
  loadMemberFinancialData: m.load,
}));
vi.mock("./member-financial-documents.service", () => ({
  createMemberFinancialPdf: m.pdf,
  createMemberFinancialWorkbook: m.excel,
}));
vi.mock("@/modules/auth/services/church-logo.service", () => ({
  loadChurchLogoDataUri: m.logo,
}));
const context = {
  church: { id: "church", logoUrl: null },
  permissions: ["members.export", "members.view_full"],
} as AuthContext;
const input = {
  memberId: "00000000-0000-4000-8000-000000000001",
  format: "pdf",
  filters: { dateFrom: "2026-11-01" },
};
const churchQuery = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  is: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn(),
};
beforeEach(() => {
  vi.clearAllMocks();
  churchQuery.maybeSingle.mockResolvedValue({
    data: {
      name: "Campo",
      senior_pastor_name: "Paulo",
      senior_pastor_spouse_name: "Ana",
    },
    error: null,
  });
  m.client.mockResolvedValue({
    from: (table: string) =>
      table === "app_settings"
        ? {
            ...churchQuery,
            maybeSingle: async () => ({
              data: { display_church_name: "Campo", logo_url: null },
              error: null,
            }),
          }
        : churchQuery,
    rpc: m.audit,
  });
  m.audit.mockResolvedValue({ error: null });
  m.load.mockResolvedValue({
    member: { id: input.memberId, name: "Ana", code: "1" },
    items: [{ id: "transaction" }],
    summary: {},
    period: "Novembro",
  });
  m.logo.mockResolvedValue(null);
  m.pdf.mockResolvedValue(new Uint8Array([37, 80, 68, 70]));
  m.excel.mockResolvedValue(new Uint8Array([1]));
});
it.each(context.permissions)(
  "requires %s before fetching financial data",
  async (permission) => {
    await expect(
      generateMemberFinancialDownload(
        {
          ...context,
          permissions: context.permissions.filter((p) => p !== permission),
        },
        input,
      ),
    ).rejects.toThrow("FORBIDDEN");
    expect(m.load).not.toHaveBeenCalled();
  },
);
it("uses authorized data, church identity and audits the complete download", async () => {
  const result = await generateMemberFinancialDownload(context, input);
  expect(result.contentType).toBe("application/pdf");
  expect(m.load).toHaveBeenCalledWith(context, input.memberId, {
    dateFrom: "2026-11-01",
    dateTo: "",
    categoryId: "",
  });
  expect(churchQuery.eq).toHaveBeenCalledWith("id", "church");
  expect(m.pdf).toHaveBeenCalledWith(
    expect.objectContaining({
      church: expect.objectContaining({
        name: "Campo",
        pastorNames: ["Paulo", "Ana"],
      }),
    }),
  );
  expect(m.audit).toHaveBeenCalledWith(
    "log_audit",
    expect.objectContaining({
      p_church_id: "church",
      p_entity_id: input.memberId,
      p_metadata: { format: "pdf", count: 1, filtered: true },
    }),
  );
});
it("does not release a file when audit fails", async () => {
  m.audit.mockResolvedValue({ error: { message: "private" } });
  await expect(generateMemberFinancialDownload(context, input)).rejects.toThrow(
    "AUDIT_FAILED",
  );
});
it("exports Excel through the same authorized data source", async () => {
  const result = await generateMemberFinancialDownload(context, {
    ...input,
    format: "xlsx",
  });
  expect(result.fileName).toBe("financeiro-membro.xlsx");
  expect(m.excel).toHaveBeenCalledOnce();
  expect(m.pdf).not.toHaveBeenCalled();
});
it.each(["pdf", "xlsx"])(
  "passes the selected category to %s and records a filtered export",
  async (format) => {
    const categoryId = "00000000-0000-4000-8000-000000000002";
    await generateMemberFinancialDownload(context, {
      ...input,
      format,
      filters: { categoryId },
    });
    expect(m.load).toHaveBeenCalledWith(context, input.memberId, {
      dateFrom: "",
      dateTo: "",
      categoryId,
    });
    expect(m.audit).toHaveBeenCalledWith(
      "log_audit",
      expect.objectContaining({
        p_metadata: { format, count: 1, filtered: true },
      }),
    );
  },
);
