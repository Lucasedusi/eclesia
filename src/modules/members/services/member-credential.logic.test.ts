import { describe, expect, it } from "vitest";
import type { MemberCredentialSource } from "../types/member-credential.types";
import {
  buildMemberCredentialPreview,
  isCredentialMemberId,
  normalizeCredentialColor,
} from "./member-credential.logic";

const sourceFixture: MemberCredentialSource = {
  issuedAt: "2026-09-21T12:00:00.000Z",
  churchName: "Igreja Batista Central",
  primaryColor: "#415BA5",
  member: {
    id: "11111111-1111-4111-8111-111111111111",
    fullName: "Maria de Souza",
    gender: "FEMALE",
    memberCode: "MEM000123",
    memberStatus: "ACTIVE",
    memberType: "MEMBER",
    deletedAt: null,
    congregationName: "Congregação Central",
    baptismDate: "2018-04-10",
    motherName: null,
    fatherName: null,
    activeRole: {
      titleVariant: "AUTO",
      name: "Diácono",
      femaleName: "Diaconisa",
    },
  },
};

function validInput(
  override: Partial<MemberCredentialSource["member"]> & {
    primaryColor?: string | null;
  } = {},
): MemberCredentialSource {
  const { primaryColor = sourceFixture.primaryColor, ...memberOverride } =
    override;
  return {
    ...sourceFixture,
    primaryColor,
    member: { ...sourceFixture.member, ...memberOverride },
  };
}

function luminance(hex: string) {
  const channels = [1, 3, 5].map((index) =>
    Number.parseInt(hex.slice(index, index + 2), 16) / 255,
  );
  const linear = channels.map((channel) =>
    channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrast(first: string, second: string) {
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

describe("buildMemberCredentialPreview", () => {
  it("mapeia os campos e usa o Cargo feminino automático", () => {
    const result = buildMemberCredentialPreview(sourceFixture);

    expect(result.member).toMatchObject({
      fullName: "Maria de Souza",
      roleName: "Diaconisa",
      memberCode: "MEM000123",
      congregationName: "Congregação Central",
      baptismDate: "10/04/2018",
      motherName: "Não informado",
      fatherName: "Não informado",
    });
    expect(result.warnings).toEqual([
      "MISSING_MOTHER_NAME",
      "MISSING_FATHER_NAME",
    ]);
    expect(result.fileName).toBe("credencial-MEM000123.pdf");
  });

  it("informa todos os campos opcionais ausentes sem bloquear", () => {
    const result = buildMemberCredentialPreview(
      validInput({ activeRole: null, baptismDate: null }),
    );
    expect(result.member.roleName).toBe("Sem cargo cadastrado");
    expect(result.member.baptismDate).toBe("Não informado");
    expect(result.warnings).toEqual([
      "MISSING_ROLE",
      "MISSING_BAPTISM_DATE",
      "MISSING_MOTHER_NAME",
      "MISSING_FATHER_NAME",
    ]);
  });

  it.each(["", "#fff", "white"])(
    "usa fallback para cor inválida: %s",
    (color) => {
      expect(
        buildMemberCredentialPreview(validInput({ primaryColor: color })).church
          .primaryColor,
      ).toBe("#415BA5");
    },
  );

  it.each(["#FFFFFF", "#F2F4F7"])(
    "preserva cor clara com texto escuro: %s",
    (color) => {
      const result = buildMemberCredentialPreview(
        validInput({ primaryColor: color }),
      );
      expect(result.church.primaryColor).toBe(color);
      expect(result.church.foregroundColor).toBe("#101828");
    },
  );

  it.each(["#FFFFFF", "#101828", "#7A6EAA"])(
    "mantém contraste mínimo no cabeçalho: %s",
    (color) => {
      const result = normalizeCredentialColor(color);
      expect(
        contrast(result.primaryDarkColor, result.foregroundColor),
      ).toBeGreaterThanOrEqual(4.5);
    },
  );

  it.each([
    { memberStatus: "INACTIVE", memberType: "MEMBER", deletedAt: null },
    { memberStatus: "ACTIVE", memberType: "VISITOR", deletedAt: null },
    {
      memberStatus: "ACTIVE",
      memberType: "MEMBER",
      deletedAt: "2026-09-21T00:00:00Z",
    },
  ])("rejeita membro inelegível %#", (override) => {
    expect(() => buildMemberCredentialPreview(validInput(override))).toThrowError(
      "MEMBER_CREDENTIAL_INELIGIBLE",
    );
  });

  it.each(["fullName", "memberCode", "congregationName"] as const)(
    "bloqueia campo obrigatório ausente: %s",
    (field) => {
      expect(() =>
        buildMemberCredentialPreview(validInput({ [field]: "" })),
      ).toThrowError("MEMBER_CREDENTIAL_INCOMPLETE");
    },
  );

  it("preserva entradas longas para o renderizador ajustar", () => {
    const result = buildMemberCredentialPreview({
      ...sourceFixture,
      churchName: "I".repeat(100),
      member: { ...sourceFixture.member, fullName: "M".repeat(120) },
    });
    expect(result.church.name).toHaveLength(100);
    expect(result.member.fullName).toHaveLength(120);
  });

  it("sanitiza e limita a matrícula no nome do arquivo", () => {
    const result = buildMemberCredentialPreview(
      validInput({ memberCode: `MEM / ${"A".repeat(80)}` }),
    );
    expect(result.fileName).toMatch(/^credencial-[A-Za-z0-9_-]+\.pdf$/);
    expect(result.fileName.length).toBeLessThanOrEqual(63);
  });
});

describe("isCredentialMemberId", () => {
  it("aceita somente UUID canônico com versão e variante válidas", () => {
    expect(
      isCredentialMemberId("11111111-1111-4111-8111-111111111111"),
    ).toBe(true);
    expect(isCredentialMemberId("member-1")).toBe(false);
    expect(
      isCredentialMemberId("11111111-1111-0111-1111-111111111111"),
    ).toBe(false);
  });
});
