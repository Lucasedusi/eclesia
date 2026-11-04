import { beforeEach, describe, expect, it, vi } from "vitest";
import { RegionReportError } from "@/modules/organization/types/region-report.types";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({ access: vi.fn(), generate: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/modules/auth/services/access-context.service", () => ({ resolveAccessContext: mocks.access }));
vi.mock("@/modules/organization/services/region-report.service", () => ({ generateRegionReportDownload: mocks.generate }));

const payload = { kind: "simplified", format: "pdf" };
const context = { church: { id: "church-1" }, permissions: ["organization.view", "regions.reports.export"] };
function request(input: unknown = payload, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/organization/regions/reports", { method: "POST", headers: { "Content-Type": "application/json", origin: "http://localhost", ...headers }, body: JSON.stringify(input) });
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.access.mockResolvedValue({ status: "ready", context });
  mocks.generate.mockResolvedValue({ body: new Uint8Array([37, 80, 68, 70]), contentType: "application/pdf", fileName: "lista-regionais.pdf" });
});

describe("POST regional reports", () => {
  it("returns a private download and validates defaults", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="lista-regionais.pdf"');
    expect(mocks.generate).toHaveBeenCalledWith(context, { ...payload, status: "ALL", search: "", sort: "ORDER" });
  });
  it.each(["anonymous", "profile-unavailable", "onboarding", "pending-invite"])("denies %s sessions", async (status) => {
    mocks.access.mockResolvedValue({ status });
    expect((await POST(request())).status).toBe(status === "anonymous" ? 401 : 403);
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it.each(["organization.view", "regions.reports.export"])("requires %s", async (permission) => {
    mocks.access.mockResolvedValue({ status: "ready", context: { ...context, permissions: context.permissions.filter((p) => p !== permission) } });
    expect((await POST(request())).status).toBe(403);
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it.each<Record<string, string>>([{ origin: "https://other.invalid" }, { "sec-fetch-site": "cross-site" }])("rejects cross-site requests", async (headers) => {
    expect((await POST(request(payload, headers))).status).toBe(403);
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it("accepts the public Host origin when Next uses an internal request hostname", async () => {
    expect((await POST(request(payload, { host: "127.0.0.1:3219", origin: "http://127.0.0.1:3219" }))).status).toBe(200);
  });
  it.each([{ ...payload, churchId: "other" }, { kind: "individual", format: "xlsx", regionId: "invalid" }])("rejects invalid input", async (input) => {
    expect((await POST(request(input))).status).toBe(400);
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it("bounds request size", async () => {
    expect((await POST(request({ padding: "x".repeat(5000) }))).status).toBe(413);
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it.each([
    ["REGION_REPORT_PERMISSION_DENIED", 403], ["REGION_REPORT_NOT_FOUND", 404], ["REGION_REPORT_TOO_LARGE", 422], ["REGION_REPORT_LOAD_FAILED", 500], ["REGION_REPORT_AUDIT_FAILED", 500],
  ] as const)("maps %s to a safe error", async (code, status) => {
    mocks.generate.mockRejectedValue(new RegionReportError(code));
    const response = await POST(request());
    expect(response.status).toBe(status);
    expect(await response.text()).not.toContain(code);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("does not leak provider details", async () => {
    mocks.generate.mockRejectedValue(new Error("PRIVATE DATABASE SECRET"));
    expect(await (await POST(request())).text()).not.toContain("PRIVATE");
  });
});
