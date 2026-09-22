import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/modules/auth/types/auth.types";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

import { loadMemberCredentialPreview } from "./member-credential.service";

const memberId = "11111111-1111-4111-8111-111111111111";
const context = {
  church: { id: "church-1", name: "Igreja do Contexto", logoUrl: null },
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
  permissions: [],
} satisfies AuthContext;

function chain<T extends Record<string, ReturnType<typeof vi.fn>>>(
  builder: T,
  methods: (keyof T)[],
) {
  methods.forEach((method) => builder[method].mockReturnValue(builder));
  return builder;
}

function setupQueries(options?: {
  member?: unknown;
  memberError?: unknown;
  settings?: unknown;
  settingsError?: unknown;
}) {
  const memberQuery = chain(
    { select: vi.fn(), eq: vi.fn(), is: vi.fn(), maybeSingle: vi.fn() },
    ["select", "eq", "is"],
  );
  const settingsQuery = chain(
    { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn() },
    ["select", "eq"],
  );
  memberQuery.maybeSingle.mockResolvedValue({
    data:
      options && "member" in options
        ? options.member
        : {
            id: memberId,
            full_name: "Maria de Souza",
            gender: "FEMALE",
            member_code: "MEM000123",
            member_status: "ACTIVE",
            member_type: "MEMBER",
            deleted_at: null,
            baptism_date: "2018-04-10",
            mother_name: "Ana de Souza",
            father_name: "José de Souza",
            congregations: { name: "Congregação Central" },
            active_roles: [
              {
                status: "ACTIVE",
                deleted_at: null,
                title_variant: "AUTO",
                role: { name: "Diácono", female_name: "Diaconisa" },
              },
            ],
          },
    error: options?.memberError ?? null,
  });
  settingsQuery.maybeSingle.mockResolvedValue({
    data:
      options && "settings" in options
        ? options.settings
        : { display_church_name: "Igreja Batista Central", primary_color: "#415BA5" },
    error: options?.settingsError ?? null,
  });
  mocks.createClient.mockResolvedValue({
    from: vi.fn((table: string) =>
      table === "members" ? memberQuery : settingsQuery,
    ),
  });
  return { memberQuery, settingsQuery };
}

describe("loadMemberCredentialPreview", () => {
  beforeEach(() => vi.clearAllMocks());

  it("consulta apenas o membro do tenant e mapeia o DTO mínimo", async () => {
    const { memberQuery, settingsQuery } = setupQueries();

    const result = await loadMemberCredentialPreview(
      context,
      memberId,
      "2026-09-21T12:00:00.000Z",
    );

    expect(memberQuery.eq.mock.calls).toContainEqual(["id", memberId]);
    expect(memberQuery.eq.mock.calls).toContainEqual(["church_id", "church-1"]);
    expect(memberQuery.is).toHaveBeenCalledWith("deleted_at", null);
    expect(memberQuery.eq.mock.calls).toContainEqual(["active_roles.status", "ACTIVE"]);
    expect(memberQuery.is.mock.calls).toContainEqual([
      "active_roles.deleted_at",
      null,
    ]);
    expect(settingsQuery.eq).toHaveBeenCalledWith("church_id", "church-1");
    expect(result).toMatchObject({
      issuedAt: "2026-09-21T12:00:00.000Z",
      church: { name: "Igreja Batista Central" },
      member: {
        id: memberId,
        fullName: "Maria de Souza",
        roleName: "Diaconisa",
        congregationName: "Congregação Central",
      },
    });
  });

  it("usa o nome da igreja do contexto quando a configuração está vazia", async () => {
    setupQueries({ settings: { display_church_name: "", primary_color: null } });
    const result = await loadMemberCredentialPreview(context, memberId);
    expect(result.church.name).toBe("Igreja do Contexto");
  });

  it("retorna erro genérico quando o membro não existe no escopo", async () => {
    setupQueries({ member: null });
    await expect(loadMemberCredentialPreview(context, memberId)).rejects.toThrowError(
      "MEMBER_CREDENTIAL_NOT_FOUND",
    );
  });

  it("não expõe mensagem do provedor quando uma consulta falha", async () => {
    setupQueries({
      member: null,
      memberError: { message: "provider details must remain private" },
    });
    await expect(loadMemberCredentialPreview(context, memberId)).rejects.toThrowError(
      "MEMBER_CREDENTIAL_LOAD_FAILED",
    );
  });
});
