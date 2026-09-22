import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/modules/auth/types/auth.types";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createPdf: vi.fn(),
  createToken: vi.fn(),
  loadActiveIssuedAt: vi.fn(),
  requireToken: vi.fn(),
  activateToken: vi.fn(),
  buildUrl: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("./member-credential-pdf.service", () => ({ createMemberCredentialPdf: mocks.createPdf }));
vi.mock("./member-credential-token.service", () => ({
  createMemberCredentialToken: mocks.createToken,
  loadActiveMemberCredentialIssuedAt: mocks.loadActiveIssuedAt,
  requireMemberCredentialTokenForIssue: mocks.requireToken,
  activateMemberCredentialToken: mocks.activateToken,
  buildCredentialValidationUrl: mocks.buildUrl,
}));

import {
  generateMemberCredentialDownload,
  loadMemberCredentialPreview,
} from "./member-credential.service";

const memberId = "11111111-1111-4111-8111-111111111111";
const token = "a".repeat(43);
const validationUrl = `https://example.com/verificar/membro/${token}`;
const context = {
  church: { id: "church-1", name: "Igreja do Contexto", logoUrl: null },
  profile: { id: "profile-1", fullName: "Usuário", displayName: "Usuário", email: "user@example.com", avatarUrl: null, status: "ACTIVE" },
  access: { id: "access-1", churchId: "church-1", role: "ADMIN", scope: "CHURCH", status: "ACTIVE", regionId: null, congregationId: null, ministryId: null },
  accesses: [], availableChurches: [], permissions: [],
} satisfies AuthContext;

function query(result: unknown) {
  const builder = {
    select: vi.fn(), eq: vi.fn(), is: vi.fn(), maybeSingle: vi.fn(),
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.is.mockReturnValue(builder);
  builder.maybeSingle.mockResolvedValue(result);
  return builder;
}

function setupQueries(
  options?: { member?: unknown; memberError?: unknown },
  includePreflight = true,
) {
  const preflight = query({ data: { id: memberId }, error: null });
  const member = query({
    data: options && "member" in options ? options.member : {
      id: memberId, full_name: "Maria de Souza", gender: "FEMALE", member_code: "MEM000123",
      member_status: "ACTIVE", member_type: "MEMBER", deleted_at: null, birth_date: "1980-04-15",
      baptism_date: "2018-04-10", mother_name: "Ana de Souza", father_name: "José de Souza",
      natural_city: "Goiânia", natural_state: "GO", congregations: { name: "Congregação Central" },
      active_roles: [{ status: "ACTIVE", deleted_at: null, title_variant: "AUTO", role: { name: "Diácono", female_name: "Diaconisa" } }],
    },
    error: options?.memberError ?? null,
  });
  const settings = query({ data: { display_church_name: "Igreja Batista Central", logo_url: null }, error: null });
  const church = query({ data: { name: "Igreja", logo_url: null, address: "Rua das Flores", number: "123", district: "Centro", city: "Goiânia", state: "GO", phone: "62999998888", document: "01185743000146" }, error: null });
  const identity = query({ data: { cpf: "12345678909" }, error: null });
  let memberCalls = 0;
  const client = {
    from: vi.fn((table: string) => {
      if (table === "members") {
        if (includePreflight && memberCalls === 0) {
          memberCalls += 1;
          return preflight;
        }
        memberCalls += 1;
        return member;
      }
      if (table === "app_settings") return settings;
      if (table === "churches") return church;
      return identity;
    }),
  };
  mocks.createClient.mockResolvedValue(client);
  return { preflight, member, settings, church, identity };
}

describe("member credential service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.com";
    mocks.createToken.mockResolvedValue({ token, validationUrl });
    mocks.loadActiveIssuedAt.mockResolvedValue(null);
    mocks.requireToken.mockResolvedValue({ id: "row", status: "PENDING", issued_at: null, pending_expires_at: "2026-09-22T12:15:00Z" });
    mocks.buildUrl.mockReturnValue(validationUrl);
    mocks.createPdf.mockResolvedValue(new Uint8Array([37, 80, 68, 70]));
    mocks.activateToken.mockResolvedValue(undefined);
  });

  it("carrega todos os campos no tenant e devolve DTO sem ID interno", async () => {
    const queries = setupQueries();
    const result = await loadMemberCredentialPreview(context, memberId, new Date("2026-09-22T12:00:00Z"));
    expect(queries.preflight.eq.mock.calls).toContainEqual(["church_id", "church-1"]);
    expect(queries.identity.eq.mock.calls).toContainEqual(["church_id", "church-1"]);
    expect(result).toMatchObject({
      issuedDate: "22/09/2026",
      church: { name: "Igreja Batista Central", document: "01.185.743/0001-46" },
      member: { fullName: "Maria de Souza", roleName: "Diaconisa", cpf: "123.456.789-09", naturality: "Goiânia - GO" },
      validation: { token, url: validationUrl },
    });
    expect(result.member).not.toHaveProperty("id");
  });

  it("rejeita membro fora do tenant antes de criar token", async () => {
    const preflight = query({ data: null, error: null });
    mocks.createClient.mockResolvedValue({ from: vi.fn(() => preflight) });
    await expect(loadMemberCredentialPreview(context, memberId)).rejects.toThrow("MEMBER_CREDENTIAL_NOT_FOUND");
    expect(mocks.createToken).not.toHaveBeenCalled();
  });

  it("recarrega dados, gera PDF e ativa o token pendente", async () => {
    setupQueries(undefined, false);
    const result = await generateMemberCredentialDownload(context, memberId, token);
    expect(result.fileName).toBe("credencial-MEM000123.pdf");
    expect(mocks.requireToken).toHaveBeenCalledWith(context, memberId, token, expect.any(Date));
    expect(mocks.createPdf).toHaveBeenCalledWith(expect.any(Object), "fold");
    expect(mocks.activateToken).toHaveBeenCalledWith(context, memberId, token, expect.any(Date));
  });

  it("gera o arquivo PVC com nome distinto e mantém o token validado", async () => {
    setupQueries(undefined, false);
    const result = await generateMemberCredentialDownload(context, memberId, token, "pvc");
    expect(result.fileName).toBe("credencial-MEM000123-pvc.pdf");
    expect(mocks.requireToken).toHaveBeenCalledWith(context, memberId, token, expect.any(Date));
    expect(mocks.createPdf).toHaveBeenCalledWith(expect.any(Object), "pvc");
  });

  it("não ativa token quando a geração do PDF falha", async () => {
    setupQueries(undefined, false);
    mocks.createPdf.mockRejectedValue(new Error("pdf failed"));
    await expect(generateMemberCredentialDownload(context, memberId, token)).rejects.toThrow("pdf failed");
    expect(mocks.activateToken).not.toHaveBeenCalled();
  });

  it("não reativa token que já está ativo", async () => {
    setupQueries(undefined, false);
    mocks.requireToken.mockResolvedValue({ id: "row", status: "ACTIVE", issued_at: "2026-09-20T10:00:00Z", pending_expires_at: "2026-09-20T10:15:00Z" });
    await generateMemberCredentialDownload(context, memberId, token);
    expect(mocks.activateToken).not.toHaveBeenCalled();
  });
});
