import { beforeEach, describe, expect, it, vi } from "vitest";
import { PERMISSIONS } from "@/modules/auth/constants/permissions";
import type { AuthContext } from "@/modules/auth/types/auth.types";
import { MemberCredentialError } from "@/modules/members/types/member-credential.types";

const mocks = vi.hoisted(() => ({
  resolveAccessContext: vi.fn(),
  generateDownload: vi.fn(),
}));

vi.mock("@/modules/auth/services/access-context.service", () => ({
  resolveAccessContext: mocks.resolveAccessContext,
}));
vi.mock("@/modules/members/services/member-credential.service", () => ({
  generateMemberCredentialDownload: mocks.generateDownload,
}));

import { POST } from "./route";

const memberId = "11111111-1111-4111-8111-111111111111";
const context = {
  church: { id: "church-1", name: "Igreja", logoUrl: null },
  profile: {
    id: "profile-1",
    fullName: "Usuário",
    displayName: "Usuário",
    email: "user@example.com",
    avatarUrl: null,
    status: "ACTIVE",
  },
  access: {
    id: "access-1",
    churchId: "church-1",
    role: "ADMIN",
    scope: "CHURCH",
    status: "ACTIVE",
    regionId: null,
    congregationId: null,
    ministryId: null,
  },
  accesses: [],
  availableChurches: [],
  permissions: [PERMISSIONS.membersCredentialIssue],
} satisfies AuthContext;

function request(id = memberId, format?: string) {
  return POST(new Request(`http://localhost/api/members/${id}/credential/pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: "a".repeat(43), ...(format ? { format } : {}) }),
  }), {
    params: Promise.resolve({ memberId: id }),
  });
}

describe("POST member credential PDF", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveAccessContext.mockResolvedValue({ status: "ready", context });
    mocks.generateDownload.mockResolvedValue({
      body: new Uint8Array([37, 80, 68, 70]),
      fileName: "credencial-MEM000123.pdf",
    });
  });

  it("entrega um PDF privado para acesso autorizado", async () => {
    const response = await request();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="credencial-MEM000123.pdf"',
    );
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(mocks.generateDownload).toHaveBeenCalledWith(context, memberId, "a".repeat(43), "fold");
  });

  it("envia o formato PVC ao serviço sem aceitar formatos arbitrários", async () => {
    expect((await request(memberId, "pvc")).status).toBe(200);
    expect(mocks.generateDownload).toHaveBeenCalledWith(context, memberId, "a".repeat(43), "pvc");
    vi.clearAllMocks();
    mocks.resolveAccessContext.mockResolvedValue({ status: "ready", context });
    expect((await request(memberId, "other")).status).toBe(400);
    expect(mocks.generateDownload).not.toHaveBeenCalled();
  });

  it("retorna 401 para sessão anônima", async () => {
    mocks.resolveAccessContext.mockResolvedValue({ status: "anonymous" });
    const response = await request();
    expect(response.status).toBe(401);
    expect(mocks.generateDownload).not.toHaveBeenCalled();
  });

  it("retorna 403 para contexto indisponível ou permissão ausente", async () => {
    mocks.resolveAccessContext.mockResolvedValueOnce({ status: "onboarding" });
    expect((await request()).status).toBe(403);
    mocks.resolveAccessContext.mockResolvedValueOnce({
      status: "ready",
      context: { ...context, permissions: [] },
    });
    expect((await request()).status).toBe(403);
    expect(mocks.generateDownload).not.toHaveBeenCalled();
  });

  it("retorna 404 para identificador inválido sem consultar o serviço", async () => {
    const response = await request("member-1");
    expect(response.status).toBe(404);
    expect(mocks.generateDownload).not.toHaveBeenCalled();
  });

  it("rejeita token ausente ou malformado sem gerar PDF", async () => {
    const response = await POST(new Request(
      `http://localhost/api/members/${memberId}/credential/pdf`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: memberId }) },
    ), { params: Promise.resolve({ memberId }) });
    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.generateDownload).not.toHaveBeenCalled();
  });

  it.each([
    ["MEMBER_CREDENTIAL_NOT_FOUND", 404],
    ["MEMBER_CREDENTIAL_INELIGIBLE", 422],
    ["MEMBER_CREDENTIAL_INCOMPLETE", 422],
    ["MEMBER_CREDENTIAL_TOKEN_INVALID", 409],
    ["MEMBER_CREDENTIAL_AUDIT_FAILED", 500],
  ] as const)("mapeia %s para HTTP %s", async (code, status) => {
    mocks.generateDownload.mockRejectedValue(new MemberCredentialError(code));
    const response = await request();
    expect(response.status).toBe(status);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("oculta falhas inesperadas", async () => {
    mocks.generateDownload.mockRejectedValue(new Error("provider secret"));
    const response = await request();
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      message: "Não foi possível gerar a credencial agora.",
    });
  });
});
