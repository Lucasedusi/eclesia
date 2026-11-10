import { beforeEach, expect, it, vi } from "vitest";
import { POST } from "./route";
import { MemberFinanceError } from "@/modules/members/types/member-finance.types";
vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({ access: vi.fn(), generate: vi.fn() }));
vi.mock("@/modules/auth/services/access-context.service", () => ({
  resolveAccessContext: m.access,
}));
vi.mock("@/modules/members/services/member-financial-report.service", () => ({
  generateMemberFinancialDownload: m.generate,
}));
const input = {
  memberId: "00000000-0000-4000-8000-000000000001",
  format: "pdf",
  filters: {},
};
const request = (body: unknown = input, headers: Record<string, string> = {}) =>
  new Request("http://localhost/api/members/finance/reports", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      origin: "http://localhost",
      ...headers,
    },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.clearAllMocks();
  m.access.mockResolvedValue({
    status: "ready",
    context: { church: { id: "church" } },
  });
  m.generate.mockResolvedValue({
    body: new Uint8Array([37, 80, 68, 70]),
    contentType: "application/pdf",
    fileName: "financeiro-membro.pdf",
  });
});
it("delivers a private attachment", async () => {
  const response = await POST(request());
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("content-disposition")).toContain(
    "financeiro-membro.pdf",
  );
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
});
it.each(["anonymous", "onboarding", "pending-invite"])(
  "rejects %s sessions",
  async (status) => {
    m.access.mockResolvedValue({ status });
    expect((await POST(request())).status).toBe(
      status === "anonymous" ? 401 : 403,
    );
    expect(m.generate).not.toHaveBeenCalled();
  },
);
it.each([
  { ...input, churchId: "other" },
  { ...input, memberId: "invalid" },
  { ...input, filters: { dateFrom: "2026-11-30", dateTo: "2026-11-01" } },
])("rejects invalid/forged input", async (value) => {
  expect((await POST(request(value))).status).toBe(400);
  expect(m.generate).not.toHaveBeenCalled();
});
it("rejects cross-site and oversized requests", async () => {
  expect(
    (await POST(request(input, { origin: "https://other.invalid" }))).status,
  ).toBe(403);
  expect((await POST(request({ padding: "x".repeat(5000) }))).status).toBe(413);
  expect(m.generate).not.toHaveBeenCalled();
});
it.each([
  ["FORBIDDEN", 403],
  ["NOT_FOUND", 404],
  ["TOO_LARGE", 422],
  ["AUDIT_FAILED", 500],
] as const)("returns safe %s errors", async (code, status) => {
  m.generate.mockRejectedValue(new MemberFinanceError(code));
  const response = await POST(request());
  expect(response.status).toBe(status);
  expect(await response.text()).not.toContain(code);
});
it("hides provider errors", async () => {
  m.generate.mockRejectedValue(new Error("PRIVATE DATABASE SECRET"));
  expect(await (await POST(request())).text()).not.toContain("PRIVATE");
});
