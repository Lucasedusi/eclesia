import { beforeEach, describe, expect, it, vi } from "vitest";
import { PERMISSIONS } from "@/modules/auth/constants/permissions";
import { MemberCredentialError } from "../types/member-credential.types";
import type { MemberCredentialPreview } from "../types/member-credential.types";

const mocks = vi.hoisted(() => ({
  requireAccessContext: vi.fn(),
  loadPreview: vi.fn(),
  assertAccessible: vi.fn(),
  revokeToken: vi.fn(),
}));

vi.mock("@/modules/auth/services/access-context.service", () => ({
  requireAccessContext: mocks.requireAccessContext,
}));
vi.mock("../services/member-credential.service", () => ({
  assertMemberCredentialAccessible: mocks.assertAccessible,
  loadMemberCredentialPreview: mocks.loadPreview,
}));
vi.mock("../services/member-credential-token.service", () => ({
  revokeMemberCredentialToken: mocks.revokeToken,
}));

import {
  getMemberCredentialPreviewAction,
  revokeMemberCredentialAction,
} from "./member-credential.actions";

const memberId = "11111111-1111-4111-8111-111111111111";
const preview = {
  issuedAt: "2026-09-21T12:00:00.000Z",
  issuedDate: "21/09/2026",
  fileName: "credencial-MEM000123.pdf",
  church: {
    name: "Igreja Batista Central",
    logoDataUri: null,
    addressLine: "Rua das Flores, 123 - Centro - Goiânia/GO",
    phone: "(62) 99999-8888",
    document: "01.185.743/0001-46",
  },
  member: {
    fullName: "Maria de Souza",
    roleName: "Diaconisa",
    memberCode: "MEM000123",
    congregationName: "Congregação Central",
    cpf: "123.456.789-09",
    birthDate: "15/04/1980",
    baptismDate: "10/04/2018",
    motherName: "Ana",
    fatherName: "José",
    naturality: "Goiânia - GO",
  },
  validation: {
    token: "a".repeat(43),
    url: `https://example.com/verificar/membro/${"a".repeat(43)}`,
    qrMatrix: [[true]],
    activeIssuedAt: null,
  },
  warnings: [],
} satisfies MemberCredentialPreview;

describe("getMemberCredentialPreviewAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAccessContext.mockResolvedValue({ church: { id: "church-1" } });
    mocks.loadPreview.mockResolvedValue(preview);
  });

  it("exige permissão e devolve a prévia autorizada", async () => {
    await expect(getMemberCredentialPreviewAction(memberId)).resolves.toEqual({
      success: true,
      data: preview,
    });
    expect(mocks.requireAccessContext).toHaveBeenCalledWith(
      PERMISSIONS.membersCredentialIssue,
    );
    expect(mocks.loadPreview).toHaveBeenCalledWith(
      { church: { id: "church-1" } },
      memberId,
    );
  });

  it("rejeita identificador inválido antes da consulta", async () => {
    await expect(getMemberCredentialPreviewAction("member-1")).resolves.toEqual({
      success: false,
      message: "Membro não encontrado ou fora do seu escopo.",
    });
    expect(mocks.loadPreview).not.toHaveBeenCalled();
  });

  it.each([
    [
      "MEMBER_CREDENTIAL_NOT_FOUND",
      "Membro não encontrado ou fora do seu escopo.",
    ],
    [
      "MEMBER_CREDENTIAL_INELIGIBLE",
      "A credencial é emitida somente para membros ativos.",
    ],
    [
      "MEMBER_CREDENTIAL_INCOMPLETE",
      "Preencha nome, matrícula e congregação antes de emitir a credencial.",
    ],
  ] as const)("mapeia %s para mensagem segura", async (code, message) => {
    mocks.loadPreview.mockRejectedValue(new MemberCredentialError(code));
    await expect(getMemberCredentialPreviewAction(memberId)).resolves.toEqual({
      success: false,
      message,
    });
  });

  it("não expõe erros inesperados", async () => {
    mocks.loadPreview.mockRejectedValue(
      new Error("provider details must remain private"),
    );
    const result = await getMemberCredentialPreviewAction(memberId);
    expect(result).toEqual({
      success: false,
      message: "Não foi possível preparar a credencial agora.",
    });
    expect(JSON.stringify(result)).not.toContain("provider details");
  });
});

describe("revokeMemberCredentialAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAccessContext.mockResolvedValue({ church: { id: "church-1" } });
    mocks.assertAccessible.mockResolvedValue(undefined);
    mocks.revokeToken.mockResolvedValue(undefined);
  });

  it("repete autorização e escopo do membro antes da revogação privilegiada", async () => {
    await expect(revokeMemberCredentialAction(memberId)).resolves.toEqual({ success: true });
    expect(mocks.requireAccessContext).toHaveBeenCalledWith(PERMISSIONS.membersCredentialIssue);
    expect(mocks.assertAccessible).toHaveBeenCalledWith({ church: { id: "church-1" } }, memberId);
    expect(mocks.assertAccessible.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.revokeToken.mock.invocationCallOrder[0],
    );
  });

  it("não revoga quando o membro está fora do escopo", async () => {
    mocks.assertAccessible.mockRejectedValue(new MemberCredentialError("MEMBER_CREDENTIAL_NOT_FOUND"));
    await expect(revokeMemberCredentialAction(memberId)).resolves.toEqual({
      success: false,
      message: "Não foi possível revogar a credencial agora.",
    });
    expect(mocks.revokeToken).not.toHaveBeenCalled();
  });
});
