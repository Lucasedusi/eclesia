import { beforeEach, expect, it, vi } from "vitest";
import { FinanceReportError } from "@/modules/finance/types/finance-report.types";
vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({
  access: vi.fn(),
  context: vi.fn(),
  report: vi.fn(),
  pdf: vi.fn(),
  informative: vi.fn(),
  ranking: vi.fn(),
  deliveries: vi.fn(),
  category: vi.fn(),
}));
vi.mock("@/modules/auth/services/access-context.service", () => ({
  resolveAccessContext: m.access,
}));
vi.mock("@/modules/finance/services/finance-access.service", () => ({
  requireFinanceContext: m.context,
}));
vi.mock("@/modules/finance/services/finance-report.service", () => ({
  getFinanceReport: m.report,
}));
vi.mock("@/modules/finance/services/finance-report-pdf.service", () => ({
  createFinanceReportPdf: m.pdf,
}));
vi.mock(
  "@/modules/finance/services/finance-informative-report.service",
  () => ({ getFinanceInformativeReport: m.informative }),
);
vi.mock("@/modules/finance/services/finance-administrative.service", () => ({
  getFinanceRankingReport: m.ranking,
  getFinanceDeliveryReport: m.deliveries,
}));
vi.mock("@/modules/finance/services/finance-category-report.service", () => ({
  getFinanceCategoryReport: m.category,
}));
import { POST } from "./route";
const unit = "30000000-0000-4000-8000-000000000001";
const payload = { congregationId: unit, type: "SYNTHETIC", month: "2026-10" };
function request(body: unknown = payload, headers = {}) {
  return POST(
    new Request("http://localhost/api/finance/reports/pdf", {
      method: "POST",
      headers: {
        Origin: "http://localhost",
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify(body),
    }),
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  m.access.mockResolvedValue({
    status: "ready",
    context: { permissions: ["finance.view"] },
  });
  m.context.mockResolvedValue({ congregationId: unit });
  m.report.mockResolvedValue({});
  m.pdf.mockResolvedValue(new Uint8Array([37, 80, 68, 70]));
  m.informative.mockResolvedValue({ type: "INFORMATIVE" });
});
const informative = {
  congregationId: unit,
  type: "INFORMATIVE",
  startMonth: "2026-08",
  endMonth: "2026-10",
  includePrebend: true,
  includeTransfer: false,
};
it("returns a period PDF for an authorized administrator", async () => {
  m.context.mockResolvedValue({
    congregationId: unit,
    capabilities: { view: true },
    auth: {
      profile: { status: "ACTIVE" },
      access: { role: "ADMIN", scope: "CHURCH", status: "ACTIVE" },
    },
  });
  const response = await request(informative);
  expect(response.status).toBe(200);
  expect(response.headers.get("Content-Disposition")).toContain(
    "informativo-2026-08-a-2026-10",
  );
  expect(m.report).not.toHaveBeenCalled();
});
it.each(["TREASURER", "SECRETARY"])(
  "denies a direct informative request by %s",
  async (role) => {
    m.context.mockResolvedValue({
      congregationId: unit,
      capabilities: { view: true },
      auth: {
        profile: { status: "ACTIVE" },
        access: { role, scope: "CHURCH", status: "ACTIVE" },
      },
    });
    expect((await request(informative)).status).toBe(403);
    expect(m.informative).not.toHaveBeenCalled();
  },
);
it("rejects reversed ranges and cashbox filters for the informative report", async () => {
  expect(
    (await request({ ...informative, startMonth: "2026-11" })).status,
  ).toBe(400);
  expect((await request({ ...informative, cashboxId: unit })).status).toBe(400);
});
it("returns private PDF after checking congregation scope", async () => {
  const response = await request();
  expect(response.status).toBe(200);
  expect(response.headers.get("Content-Type")).toBe("application/pdf");
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(m.context).toHaveBeenCalledWith({
    congregationId: unit,
    permission: "finance.view",
  });
});
it("refuses unauthenticated and forbidden direct requests", async () => {
  m.access.mockResolvedValue({ status: "anonymous" });
  expect((await request()).status).toBe(401);
  m.access.mockResolvedValue({ status: "ready", context: { permissions: [] } });
  expect((await request()).status).toBe(403);
  expect(m.report).not.toHaveBeenCalled();
});
it("denies other congregation even when passed by URL client", async () => {
  m.context.mockRejectedValue(new Error("FORBIDDEN"));
  expect((await request()).status).toBe(403);
  expect(m.report).not.toHaveBeenCalled();
});
it.each([
  { ...payload, churchId: "other" },
  { ...payload, month: "2026-99" },
  { ...payload, congregationId: "invalid" },
])("rejects invalid input", async (body) => {
  expect((await request(body)).status).toBe(400);
});
it("rejects cross origin and oversized bodies", async () => {
  expect(
    (await request(payload, { Origin: "https://other.example" })).status,
  ).toBe(403);
  expect((await request({ data: "x".repeat(5000) })).status).toBe(413);
});
it.each(["REPORT_TOO_LARGE", "REPORT_RECONCILIATION_REQUIRED"] as const)(
  "returns actionable %s",
  async (code) => {
    m.report.mockRejectedValue(new FinanceReportError(code));
    const res = await request();
    expect(res.status).toBe(422);
    expect(await res.json()).toHaveProperty("message");
  },
);
it("hides internal failures", async () => {
  m.report.mockRejectedValue(new Error("database secret"));
  const res = await request();
  expect(res.status).toBe(500);
  expect(await res.text()).not.toContain("secret");
});
it("accepts browser origin matching Host when Next rewrites the internal URL", async () => {
  expect(
    (
      await request(payload, {
        Origin: "http://127.0.0.1:3217",
        Host: "127.0.0.1:3217",
      })
    ).status,
  ).toBe(200);
});

it.each(["RANKING", "DELIVERIES"])(
  "protects global %s PDF against a treasurer and accepts an admin without a selected unit",
  async (type) => {
    const body =
      type === "RANKING"
        ? {
            type,
            startMonth: "2026-09",
            endMonth: "2026-09",
            includeInactive: false,
            includePrebend: true,
            includeTransfer: false,
          }
        : {
            type,
            month: "2026-09",
            includeInactive: false,
            filter: "PENDING",
            search: "",
          };
    const ctx = {
      capabilities: { view: true },
      auth: {
        profile: { status: "ACTIVE" },
        access: { role: "TREASURER", scope: "CHURCH", status: "ACTIVE" },
      },
    };
    m.context.mockResolvedValue(ctx);
    expect((await request(body)).status).toBe(403);
    m.context.mockResolvedValue({
      ...ctx,
      auth: { ...ctx.auth, access: { ...ctx.auth.access, role: "ADMIN" } },
    });
    m.ranking.mockResolvedValue({ type: "RANKING" });
    m.deliveries.mockResolvedValue({ type: "DELIVERIES" });
    expect((await request(body)).status).toBe(200);
  },
);

const categoryPayload = {
  congregationId: unit,
  type: "CATEGORY",
  dateFrom: "2026-01-01",
  dateTo: "2026-12-31",
  direction: "EXPENSE",
  presentation: "SUMMARY",
  categoryIds: [unit],
};
it("allows a treasurer category report with validated scope and period filename", async () => {
  m.context.mockResolvedValue({
    congregationId: unit,
    capabilities: { view: true },
    auth: { access: { role: "TREASURER", scope: "CONGREGATION" } },
  });
  m.category.mockResolvedValue({ type: "CATEGORY" });
  const result = await request(categoryPayload);
  expect(result.status).toBe(200);
  expect(result.headers.get("Content-Disposition")).toContain(
    "categorias-2026-01-01-a-2026-12-31",
  );
  expect(m.context).toHaveBeenCalledWith({
    congregationId: unit,
    permission: "finance.view",
  });
});
it("rejects category filters and out-of-scope requests before creating a PDF", async () => {
  expect((await request({ ...categoryPayload, categoryIds: [] })).status).toBe(
    400,
  );
  m.context.mockRejectedValueOnce(new Error("FORBIDDEN"));
  expect((await request(categoryPayload)).status).toBe(403);
  expect(m.pdf).not.toHaveBeenCalled();
});
