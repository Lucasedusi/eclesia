import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { buildPublicRegistrationPayload, createPublicMemberAttemptHash, resolvePublicMemberId } from "./public-member-link";

describe("createPublicMemberAttemptHash", () => {
  it("cria uma chave opaca e vinculada ao evento sem expor o CPF", () => {
    const first = createPublicMemberAttemptHash("a".repeat(32), "event-1", "52998224725");
    const second = createPublicMemberAttemptHash("a".repeat(32), "event-2", "52998224725");

    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(first).not.toContain("52998224725");
    expect(second).not.toBe(first);
  });
});

describe("resolvePublicMemberId", () => {
  it("não consulta o cadastro quando a inscrição é de visitante", async () => {
    const lookup = vi.fn(async () => "member-id");

    const memberId = await resolvePublicMemberId({
      participantKind: "VISITOR",
      memberCpf: "",
      memberBirthDate: "",
    }, lookup);

    expect(memberId).toBeNull();
    expect(lookup).not.toHaveBeenCalled();
  });

  it("resolve o membro usando CPF normalizado e nascimento exato", async () => {
    const lookup = vi.fn(async (cpf: string, birthDate: string) =>
      cpf === "52998224725" && birthDate === "1990-01-15" ? "member-id" : null,
    );

    const memberId = await resolvePublicMemberId({
      participantKind: "MEMBER",
      memberCpf: "529.982.247-25",
      memberBirthDate: "1990-01-15",
    }, lookup);

    expect(memberId).toBe("member-id");
  });

  it("não cria vínculo quando a identificação não corresponde", async () => {
    const memberId = await resolvePublicMemberId({
      participantKind: "MEMBER",
      memberCpf: "529.982.247-25",
      memberBirthDate: "1990-01-15",
    }, async () => null);

    expect(memberId).toBeNull();
  });
});

describe("buildPublicRegistrationPayload", () => {
  it("injeta somente o vínculo resolvido pelo servidor e remove os dados de identificação", () => {
    const payload = buildPublicRegistrationPayload({
      participantKind: "MEMBER",
      participantName: "Ana da Silva",
      memberCpf: "52998224725",
      memberBirthDate: "1990-01-15",
      memberId: "client-controlled-id",
    }, "server-resolved-id");

    expect(payload).toEqual({
      participantKind: "MEMBER",
      participantName: "Ana da Silva",
      memberId: "server-resolved-id",
      participantType: "MEMBER",
      registrationSource: "PUBLIC",
      consentAccepted: true,
    });
  });

  it("mantém visitante sem vínculo de membro", () => {
    const payload = buildPublicRegistrationPayload({
      participantKind: "VISITOR",
      participantName: "Ana da Silva",
      memberCpf: "",
      memberBirthDate: "",
    }, null);

    expect(payload.memberId).toBe("");
    expect(payload.participantType).toBe("VISITOR");
  });
});
