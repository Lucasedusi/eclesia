import { mkdir, writeFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it, vi } from "vitest";
import type { MemberCredentialPreview } from "../types/member-credential.types";

vi.mock("server-only", () => ({}));

import {
  CR80_HEIGHT_PT,
  CR80_WIDTH_PT,
  createMemberCredentialPdf,
} from "./member-credential-pdf.service";

const preview: MemberCredentialPreview = {
  issuedAt: "2026-09-21T12:00:00.000Z",
  fileName: "credencial-MEM000123.pdf",
  church: {
    name: "Igreja Batista Central",
    primaryColor: "#415BA5",
    primaryDarkColor: "#354B8E",
    foregroundColor: "#FFFFFF",
  },
  member: {
    id: "11111111-1111-4111-8111-111111111111",
    fullName: "Maria de Souza",
    roleName: "Diaconisa",
    memberCode: "MEM000123",
    congregationName: "Congregação Central",
    baptismDate: "10/04/2018",
    motherName: "Não informado",
    fatherName: "Não informado",
  },
  warnings: ["MISSING_MOTHER_NAME", "MISSING_FATHER_NAME"],
};

describe("createMemberCredentialPdf", () => {
  it("gera frente e verso no tamanho CR80", async () => {
    const bytes = await createMemberCredentialPdf(preview);
    const document = await PDFDocument.load(bytes);

    expect(document.getPages()).toHaveLength(2);
    for (const page of document.getPages()) {
      expect(page.getWidth()).toBeCloseTo(CR80_WIDTH_PT, 2);
      expect(page.getHeight()).toBeCloseTo(CR80_HEIGHT_PT, 2);
    }
    expect(document.getTitle()).toBe("Credencial física de membro");
    expect(document.getSubject()).toBe(
      "Documento de identificação eclesiástica",
    );

    if (process.env.GENERATE_CREDENTIAL_QA === "1") {
      await mkdir("tmp/pdfs", { recursive: true });
      await writeFile("tmp/pdfs/member-credential-qa.pdf", bytes);
    }
  });

  it("mantém dimensões com textos longos e fallbacks", async () => {
    const bytes = await createMemberCredentialPdf({
      ...preview,
      church: { ...preview.church, name: "I".repeat(100) },
      member: {
        ...preview.member,
        fullName: "Maria ".repeat(20),
        roleName: "Sem cargo cadastrado",
        congregationName: "Congregação ".repeat(7),
        baptismDate: "Não informado",
        motherName: "Não informado",
        fatherName: "Não informado",
      },
      warnings: [
        "MISSING_ROLE",
        "MISSING_BAPTISM_DATE",
        "MISSING_MOTHER_NAME",
        "MISSING_FATHER_NAME",
      ],
    });
    const document = await PDFDocument.load(bytes);
    expect(document.getPages()).toHaveLength(2);
    expect(document.getPage(0).getSize()).toEqual({
      width: CR80_WIDTH_PT,
      height: CR80_HEIGHT_PT,
    });
  });

  it("substitui caracteres fora de WinAnsi sem falhar", async () => {
    await expect(
      createMemberCredentialPdf({
        ...preview,
        church: { ...preview.church, name: "Igreja Esperança ⛪" },
        member: { ...preview.member, fullName: "Maria 😊 de Souza" },
      }),
    ).resolves.toBeInstanceOf(Uint8Array);
  });
});
