import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemberSheetError } from "@/modules/members/types/member-sheet.types";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ access: vi.fn(), generate: vi.fn() }));
vi.mock("@/modules/auth/services/access-context.service", () => ({ resolveAccessContext: mocks.access }));
vi.mock("@/modules/members/services/member-sheet.service", () => ({ generateMemberSheetDownload: mocks.generate }));
import { POST } from "./route";

const memberId = "9ed2934a-8326-4abd-8c59-e4b0865acb95";
const url = `http://localhost/api/members/${memberId}/sheet/pdf`;
const context = { church: { id: "church-1" }, permissions: ["members.view_basic", "members.view_full", "members.export"] };
function request(body: unknown = {}, headers: Record<string, string> = {}, id = memberId) {
  return POST(new Request(url, { method: "POST", headers: { Origin: "http://localhost", "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) }), { params: Promise.resolve({ memberId: id }) });
}

describe("POST member sheet PDF", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.access.mockResolvedValue({ status: "ready", context });
    mocks.generate.mockResolvedValue({ body: new Uint8Array([37, 80, 68, 70]), fileName: "ficha-membro-MEM001.pdf" });
  });

  it("baixa PDF privado com as duas seções desmarcadas por padrão", async () => {
    const response = await request();
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="ficha-membro-MEM001.pdf"');
    expect(mocks.generate).toHaveBeenCalledWith(context, memberId, { includeHistory: false, includeEvents: false });
  });

  it("encaminha a seleção validada", async () => {
    expect((await request({ includeHistory: true, includeEvents: true })).status).toBe(200);
    expect(mocks.generate).toHaveBeenCalledWith(context, memberId, { includeHistory: true, includeEvents: true });
  });

  it.each(["anonymous", "profile-unavailable", "onboarding", "pending-invite"])("recusa sessão %s", async (status) => {
    mocks.access.mockResolvedValue({ status });
    expect((await request()).status).toBe(status === "anonymous" ? 401 : 403);
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it("recusa sessão sem permissão de exportar cadastro", async () => {
    mocks.access.mockResolvedValue({ status: "ready", context: { ...context, permissions: ["members.view_basic"] } });
    expect((await request()).status).toBe(403);
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it.each([{ includeHistory: "true" }, { includeFinance: true }, { churchId: "other" }, { includeSensitive: true }])("recusa entrada inválida %j", async (body) => {
    expect((await request(body)).status).toBe(400);
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it("recusa ID inválido sem consultar o membro", async () => {
    expect((await request({}, {}, "invalid")).status).toBe(404);
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it.each<Record<string, string>>([{ Origin: "https://outro.example" }, { "Sec-Fetch-Site": "cross-site" }])("recusa origem externa %j", async (headers) => {
    expect((await request({}, headers)).status).toBe(403);
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it("limita o corpo real mesmo sem Content-Length", async () => {
    expect((await request({ data: "x".repeat(5000) })).status).toBe(413);
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it("recusa JSON malformado", async () => {
    const response = await POST(new Request(url, { method: "POST", headers: { Origin: "http://localhost", "Content-Type": "application/json" }, body: "{" }), { params: Promise.resolve({ memberId }) });
    expect(response.status).toBe(400);
  });

  it.each([
    ["MEMBER_SHEET_PERMISSION_DENIED", 403], ["MEMBER_SHEET_NOT_FOUND", 404], ["MEMBER_SHEET_TOO_LARGE", 422],
    ["MEMBER_SHEET_LOAD_FAILED", 500], ["MEMBER_SHEET_AUDIT_FAILED", 500],
  ] as const)("mapeia %s para HTTP %s sem cache", async (code, status) => {
    mocks.generate.mockRejectedValue(new MemberSheetError(code));
    const response = await request();
    expect(response.status).toBe(status);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("oculta detalhes internos inclusive em falha da sessão", async () => {
    mocks.access.mockRejectedValue(new Error("secret database details"));
    const response = await request();
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ message: "Não foi possível gerar a ficha agora. Tente novamente." });
  });
});
