import { beforeEach, describe, expect, it, vi } from "vitest";
import { PERMISSIONS } from "@/modules/auth/constants/permissions";
import { MemberCredentialError } from "../types/member-credential.types";
import type { MemberCredentialPreview } from "../types/member-credential.types";

const mocks = vi.hoisted(() => ({
  requireAccessContext: vi.fn(),
  loadPreview: vi.fn(),
}));

vi.mock("@/modules/auth/services/access-context.service", () => ({
  requireAccessContext: mocks.requireAccessContext,
}));
vi.mock("../services/member-credential.service", () => ({
  loadMemberCredentialPreview: mocks.loadPreview,
}));

import { getMemberCredentialPreviewAction } from "./member-credential.actions";

const memberId = "11111111-1111-4111-8111-111111111111";
const preview = {
  issuedAt: "2026-09-21T12:00:00.000Z",
  fileName: "credencial-MEM000123.pdf",
  church: {
    name: "Igreja Batista Central",
    primaryColor: "#415BA5",
    primaryDarkColor: "#354B8E",
    foregroundColor: "#FFFFFF",
  },
  member: {
    id: memberId,
    fullName: "Maria de Souza",
    roleName: "Diaconisa",
    memberCode: "MEM000123",
    congregationName: "Congregação Central",
    baptismDate: "10/04/2018",
    motherName: "Ana",
    fatherName: "José",
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
