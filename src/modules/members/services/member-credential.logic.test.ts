import { describe, expect, it } from "vitest";
import type { MemberCredentialSource } from "../types/member-credential.types";
import {
  buildMemberCredentialPreview,
  isCredentialMemberId,
} from "./member-credential.logic";

const sourceFixture: MemberCredentialSource = {
  issuedAt: "2026-09-21T12:00:00.000Z",
  credentialToken: "opaque-token",
  validationUrl: "https://eclesias.app/verificar/membro/opaque-token",
  qrMatrix: [[true, false], [false, true]],
  activeCredentialIssuedAt: null,
  churchName: "Igreja Batista Central",
  churchLogoDataUri: "data:image/png;base64,bG9nbw==",
  churchAddress: "Rua das Flores",
  churchNumber: "123",
  churchDistrict: "Centro",
  churchCity: "Goiânia",
  churchState: "GO",
  churchPhone: "62999998888",
  churchDocument: "01185743000146",
  member: {
    id: "11111111-1111-4111-8111-111111111111",
    fullName: "Maria de Souza",
    gender: "FEMALE",
    memberCode: "MEM000123",
    memberStatus: "ACTIVE",
    memberType: "MEMBER",
    deletedAt: null,
    congregationName: "Congregação Central",
    cpf: "12345678909",
    birthDate: "1980-04-15",
    baptismDate: "2018-04-10",
    motherName: null,
    fatherName: null,
    naturalCity: "Goiânia",
    naturalState: "GO",
    activeRole: {
      titleVariant: "AUTO",
      name: "Diácono",
      femaleName: "Diaconisa",
    },
  },
};

function validInput(
  override: Partial<MemberCredentialSource["member"]> = {},
): MemberCredentialSource {
  return {
    ...sourceFixture,
    member: { ...sourceFixture.member, ...override },
  };
}

describe("buildMemberCredentialPreview", () => {
  it("mapeia os campos e usa o Cargo feminino automático", () => {
    const result = buildMemberCredentialPreview(sourceFixture);

    expect(result.member).toMatchObject({
      fullName: "Maria de Souza",
      roleName: "Diaconisa",
      memberCode: "MEM000123",
      congregationName: "Congregação Central",
      cpf: "123.456.789-09",
      birthDate: "15/04/1980",
      baptismDate: "10/04/2018",
      motherName: "Não informado",
      fatherName: "Não informado",
      naturality: "Goiânia - GO",
    });
    expect(result.church).toMatchObject({
      name: "Igreja Batista Central",
      addressLine: "Rua das Flores, 123 - Centro - Goiânia/GO",
      phone: "(62) 99999-8888",
      document: "01.185.743/0001-46",
    });
    expect(result.issuedDate).toBe("21/09/2026");
    expect(result.validation).toEqual({
      token: "opaque-token",
      url: "https://eclesias.app/verificar/membro/opaque-token",
      qrMatrix: [[true, false], [false, true]],
      activeIssuedAt: null,
    });
    expect(result.warnings).toEqual([
      "MISSING_MOTHER_NAME",
      "MISSING_FATHER_NAME",
    ]);
    expect(result.fileName).toBe("credencial-MEM000123.pdf");
  });

  it("informa campos opcionais ausentes sem bloquear", () => {
    const result = buildMemberCredentialPreview(
      {
        ...sourceFixture,
        churchLogoDataUri: null,
        churchAddress: null,
        churchPhone: null,
        churchDocument: null,
        member: {
          ...sourceFixture.member,
          activeRole: null,
          cpf: null,
          birthDate: null,
          baptismDate: null,
          naturalCity: null,
          naturalState: null,
        },
      },
    );
    expect(result.member.roleName).toBe("Sem cargo cadastrado");
    expect(result.member.baptismDate).toBe("Não informado");
    expect(result.warnings).toEqual([
      "MISSING_CHURCH_LOGO",
      "MISSING_CHURCH_ADDRESS",
      "MISSING_CHURCH_PHONE",
      "MISSING_CHURCH_DOCUMENT",
      "MISSING_ROLE",
      "MISSING_CPF",
      "MISSING_BIRTH_DATE",
      "MISSING_BAPTISM_DATE",
      "MISSING_MOTHER_NAME",
      "MISSING_FATHER_NAME",
      "MISSING_NATURALITY",
    ]);
    expect(result.church.logoDataUri).toBeNull();
    expect(result.member.cpf).toBe("Não informado");
  });

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

  it("não inclui o ID interno do membro no DTO da prévia", () => {
    const result = buildMemberCredentialPreview(sourceFixture);
    expect(result.member).not.toHaveProperty("id");
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
