import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemberReportError } from "@/modules/members/types/member-report.types";
import { POST } from "./route";
const mocks = vi.hoisted(() => ({ access: vi.fn(), generate: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/modules/auth/services/access-context.service", () => ({ resolveAccessContext: mocks.access }));
vi.mock("@/modules/members/services/member-report.service", () => ({ generateMemberReportDownload: mocks.generate }));
const payload = { kind: "simplified", format: "pdf" };
const context = { church: { id: "church-1" }, permissions: ["members.export", "members.view_basic", "members.view_full"] };
function request(input: unknown = payload, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/members/reports", { method: "POST", headers: { "Content-Type": "application/json", origin: "http://localhost", ...headers }, body: JSON.stringify(input) });
}
beforeEach(() => { vi.clearAllMocks(); mocks.access.mockResolvedValue({ status: "ready", context }); mocks.generate.mockResolvedValue({ body: new Uint8Array([37,80,68,70]), contentType: "application/pdf", fileName: "lista-membros-simplificada.pdf" }); });
describe("POST member reports", () => {
  it("returns a private, noncached attachment with validated defaults", async () => {
    const response = await POST(request()); expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("private, no-store"); expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="lista-membros-simplificada.pdf"');
    expect(mocks.generate).toHaveBeenCalledWith(context, expect.objectContaining({ ...payload, filters: expect.objectContaining({ archived: false, sort: "name_asc" }) }));
  });
  it.each(["anonymous", "profile-unavailable", "onboarding", "pending-invite"])("denies %s sessions", async (status) => { mocks.access.mockResolvedValue({ status }); expect((await POST(request())).status).toBe(status === "anonymous" ? 401 : 403); expect(mocks.generate).not.toHaveBeenCalled(); });
  it.each(context.permissions)("requires %s", async (permission) => { mocks.access.mockResolvedValue({ status: "ready", context: { ...context, permissions: context.permissions.filter((p) => p !== permission) } }); expect((await POST(request())).status).toBe(403); expect(mocks.generate).not.toHaveBeenCalled(); });
  it.each<Record<string, string>>([{ origin: "https://other.invalid" }, { "sec-fetch-site": "cross-site" }])("rejects cross-site requests", async (headers) => { expect((await POST(request(payload, headers))).status).toBe(403); expect(mocks.generate).not.toHaveBeenCalled(); });
  it("accepts the public Host origin", async () => { expect((await POST(request(payload, { host: "127.0.0.1:3222", origin: "http://127.0.0.1:3222" }))).status).toBe(200); });
  it.each([{ ...payload, churchId: "other" }, { kind: "complete", format: "pdf" }, { kind: "custom", format: "xlsx", fields: ["pastoral_notes"] }, { kind: "custom", format: "pdf", fields: ["email", "email"] }])("rejects forged options", async (input) => { expect((await POST(request(input))).status).toBe(400); expect(mocks.generate).not.toHaveBeenCalled(); });
  it("bounds request size", async () => { expect((await POST(request({ padding: "x".repeat(5000) }))).status).toBe(413); expect(mocks.generate).not.toHaveBeenCalled(); });
  it.each([["MEMBER_REPORT_PERMISSION_DENIED",403],["MEMBER_REPORT_TOO_LARGE",422],["MEMBER_REPORT_LOAD_FAILED",500],["MEMBER_REPORT_AUDIT_FAILED",500]] as const)("maps %s to a safe error", async (code, status) => { mocks.generate.mockRejectedValue(new MemberReportError(code)); const response = await POST(request()); expect(response.status).toBe(status); expect(await response.text()).not.toContain(code); expect(response.headers.get("cache-control")).toContain("no-store"); });
  it("does not leak provider details", async () => { mocks.generate.mockRejectedValue(new Error("PRIVATE DATABASE SECRET")); expect(await (await POST(request())).text()).not.toContain("PRIVATE"); });
});
