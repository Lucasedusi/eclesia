import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));

import {
  activateMemberCredentialToken,
  buildCredentialValidationUrl,
  createMemberCredentialToken,
  hashMemberCredentialToken,
  isMemberCredentialToken,
  loadPublicMemberCredentialValidation,
} from "./member-credential-token.service";

const context = {
  church: { id: "church-1", name: "Igreja", logoUrl: null },
  profile: {
    id: "11111111-1111-4111-8111-111111111111",
    fullName: "Administrador",
    displayName: "Administrador",
    email: "admin@example.com",
    avatarUrl: null,
    status: "ACTIVE" as const,
  },
  access: {
    id: "access-1",
    churchId: "church-1",
    role: "ADMIN" as const,
    scope: "CHURCH" as const,
    status: "ACTIVE" as const,
    regionId: null,
    congregationId: null,
    ministryId: null,
  },
  accesses: [],
  availableChurches: [],
  permissions: ["members.credentials.issue"],
};

describe("member credential token", () => {
  beforeEach(() => vi.clearAllMocks());

  it("gera formato opaco e hash SHA-256 sem incluir dados pessoais", () => {
    const token = "a".repeat(43);
    expect(isMemberCredentialToken(token)).toBe(true);
    expect(isMemberCredentialToken("member-id:12345678909")).toBe(false);
    expect(hashMemberCredentialToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashMemberCredentialToken(token)).not.toContain(token);
  });

  it("monta URL pública sem aceitar origem insegura", () => {
    expect(
      buildCredentialValidationUrl(
        "a".repeat(43),
        "https://app.eclesias.com.br/",
      ),
    ).toBe(`https://app.eclesias.com.br/verificar/membro/${"a".repeat(43)}`);
    expect(() =>
      buildCredentialValidationUrl("a".repeat(43), "javascript:alert(1)"),
    ).toThrow("MEMBER_CREDENTIAL_SITE_URL_INVALID");
  });

  it("persiste somente o hash do token e o escopo autorizado", async () => {
    const inserted: Record<string, unknown>[] = [];
    const insert = vi.fn((value: Record<string, unknown>) => {
      inserted.push(value);
      return {
        select: () => ({
          single: async () => ({
            data: {
              id: "token-row",
              created_at: "2026-09-22T12:00:00.000Z",
              pending_expires_at: "2026-09-22T12:15:00.000Z",
            },
            error: null,
          }),
        }),
      };
    });
    mocks.createAdminClient.mockReturnValue({
      from: vi.fn(() => ({ insert })),
    });

    const result = await createMemberCredentialToken(
      context,
      "22222222-2222-4222-8222-222222222222",
      new Date("2026-09-22T12:00:00.000Z"),
      "https://app.eclesias.com.br",
    );

    expect(result.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(inserted[0]).toMatchObject({
      church_id: "church-1",
      member_id: "22222222-2222-4222-8222-222222222222",
      created_by: "11111111-1111-4111-8111-111111111111",
      status: "PENDING",
    });
    expect(inserted[0].token_hash).toBe(hashMemberCredentialToken(result.token));
    expect(JSON.stringify(inserted[0])).not.toContain(result.token);
  });

  it("ativa a credencial usando somente o hash no RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    mocks.createAdminClient.mockReturnValue({ rpc });
    const rawToken = "b".repeat(43);
    await activateMemberCredentialToken(
      context,
      "22222222-2222-4222-8222-222222222222",
      rawToken,
      new Date("2026-09-22T12:00:00.000Z"),
    );
    expect(rpc).toHaveBeenCalledWith("activate_member_credential_token", expect.objectContaining({
      p_token_hash: hashMemberCredentialToken(rawToken),
      p_church_id: "church-1",
    }));
    expect(JSON.stringify(rpc.mock.calls)).not.toContain(rawToken);
  });

  it("expõe publicamente somente os dados mínimos de uma credencial ativa", async () => {
    function chain(data: unknown) {
      const builder = {
        select: vi.fn(), eq: vi.fn(), is: vi.fn(), maybeSingle: vi.fn(),
      };
      builder.select.mockReturnValue(builder);
      builder.eq.mockReturnValue(builder);
      builder.is.mockReturnValue(builder);
      builder.maybeSingle.mockResolvedValue({ data, error: null });
      return builder;
    }
    const credential = chain({ church_id: "church-1", member_id: "member-1", issued_at: "2026-09-22T12:00:00Z" });
    const member = chain({ full_name: "Maria de Souza", member_status: "ACTIVE", member_type: "MEMBER", congregations: { name: "Central" } });
    const church = chain({ name: "Igreja Batista Central" });
    const settings = chain({ display_church_name: "Igreja Batista Central" });
    mocks.createAdminClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "member_credential_tokens") return credential;
        if (table === "members") return member;
        if (table === "app_settings") return settings;
        return church;
      }),
    });

    const result = await loadPublicMemberCredentialValidation("a".repeat(43));
    expect(result).toEqual({
      valid: true,
      memberName: "Maria de Souza",
      churchName: "Igreja Batista Central",
      congregationName: "Central",
      issuedDate: "22/09/2026",
    });
    expect(result).not.toHaveProperty("memberId");
    expect(result).not.toHaveProperty("cpf");
  });

  it("não consulta o banco para token público malformado", async () => {
    expect(await loadPublicMemberCredentialValidation("member-id-cpf")).toEqual({ valid: false });
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });
});
