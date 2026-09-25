import { mkdir, writeFile } from "node:fs/promises";
import { decodePDFRawStream, PDFDict, PDFDocument, PDFName, PDFRawStream } from "pdf-lib";
import { Resvg } from "@resvg/resvg-js";
import QRCode from "qrcode";
import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";
import type { MemberCredentialPreview } from "../types/member-credential.types";

vi.mock("server-only", () => ({}));

import {
  A4_HEIGHT_PT,
  A4_WIDTH_PT,
  CR80_HEIGHT_PT,
  CR80_WIDTH_PT,
  PRINT_BLEED_PT,
  createMemberCredentialPdf,
} from "./member-credential-pdf.service";

function qrMatrix(value: string) {
  const qr = QRCode.create(value, { errorCorrectionLevel: "M" });
  return Array.from({ length: qr.modules.size }, (_, row) =>
    Array.from({ length: qr.modules.size }, (_, column) =>
      Boolean(qr.modules.data[row * qr.modules.size + column]),
    ),
  );
}

const preview: MemberCredentialPreview = {
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
    fullName: "Kamylla Araújo da Silva Oliveira dos Santos",
    roleName: "Diaconisa",
    memberCode: "MEM000123",
    congregationName: "Congregação Central",
    cpf: "123.456.789-09",
    birthDate: "15/04/1980",
    baptismDate: "10/04/2018",
    motherName: "Não informado",
    fatherName: "Não informado",
    naturality: "Goiânia - GO",
  },
  validation: {
    token: "a".repeat(43),
    url: `https://example.com/verificar/membro/${"a".repeat(43)}`,
    qrMatrix: qrMatrix(`https://example.com/verificar/membro/${"a".repeat(43)}`),
    activeIssuedAt: null,
  },
  warnings: ["MISSING_CHURCH_LOGO", "MISSING_MOTHER_NAME", "MISSING_FATHER_NAME"],
};

describe("createMemberCredentialPdf", () => {
  it("imprime a logo WebP na frente e como marca d'água no verso do PVC", async () => {
    const logo = await sharp({
      create: { width: 40, height: 40, channels: 4, background: "#ff00ff" },
    }).webp().toBuffer();
    const bytes = await createMemberCredentialPdf({
      ...preview,
      church: { ...preview.church, logoDataUri: `data:image/webp;base64,${logo.toString("base64")}` },
    }, "pvc");
    const document = await PDFDocument.load(bytes);

    const hasLogoColor = (pageIndex: number, watermark: boolean) => {
      const xObjects = document.getPage(pageIndex).node.Resources()?.lookupMaybe(PDFName.of("XObject"), PDFDict);
      if (!xObjects) return false;
      return xObjects.keys().some((name) => {
        const stream = document.context.lookup(xObjects.get(name));
        if (!(stream instanceof PDFRawStream)) return false;
        const pixels = decodePDFRawStream(stream).decode();
        for (let index = 0; index + 2 < pixels.length; index += 3) {
          const [red, green, blue] = pixels.subarray(index, index + 3);
          if (watermark
            ? red > 245 && green >= 225 && green < 245 && blue > 245
            : red > 240 && green < 20 && blue > 240) return true;
        }
        return false;
      });
    };

    expect(hasLogoColor(0, false)).toBe(true);
    expect(hasLogoColor(1, true)).toBe(true);
    if (process.env.GENERATE_CREDENTIAL_QA === "1") {
      await mkdir("tmp/pdfs", { recursive: true });
      await writeFile("tmp/pdfs/member-credential-webp-pvc-qa.pdf", bytes);
      await writeFile("tmp/pdfs/member-credential-webp-fold-qa.pdf", await createMemberCredentialPdf({
        ...preview,
        church: { ...preview.church, logoDataUri: `data:image/webp;base64,${logo.toString("base64")}` },
      }, "fold"));
    }
  });

  it("renderiza a logo da frente e a marca d'água do verso no arquivo PVC", async () => {
    const logo = new Resvg('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><circle cx="300" cy="300" r="260" fill="#d4a72c"/><text x="300" y="410" text-anchor="middle" font-size="330" fill="#082a5b">E</text></svg>').render().asPng();
    const bytes = await createMemberCredentialPdf({
      ...preview,
      church: { ...preview.church, logoDataUri: `data:image/png;base64,${Buffer.from(logo).toString("base64")}` },
    }, "pvc");
    expect((await PDFDocument.load(bytes)).getPages()).toHaveLength(2);
    if (process.env.GENERATE_CREDENTIAL_QA === "1") {
      await mkdir("tmp/pdfs", { recursive: true });
      await writeFile("tmp/pdfs/member-credential-logo-qa.pdf", bytes);
    }
  });
  it("gera uma folha A4 com as duas faces lado a lado para dobrar", async () => {
    const bytes = await createMemberCredentialPdf(preview);
    const document = await PDFDocument.load(bytes);

    expect(document.getPages()).toHaveLength(1);
    expect(document.getPage(0).getWidth()).toBeCloseTo(A4_WIDTH_PT, 2);
    expect(document.getPage(0).getHeight()).toBeCloseTo(A4_HEIGHT_PT, 2);
    expect(document.getTitle()).toBe("Credencial física de membro");
    expect(document.getSubject()).toBe(
      "Documento de identificação eclesiástica",
    );

    if (process.env.GENERATE_CREDENTIAL_QA === "1") {
      await mkdir("tmp/pdfs", { recursive: true });
      await writeFile("tmp/pdfs/member-credential-qa.pdf", bytes);
    }
  });

  it("gera arquivo de gráfica com duas faces CR80 e sangria de 3 mm", async () => {
    const bytes = await createMemberCredentialPdf(preview, "pvc");
    const document = await PDFDocument.load(bytes);
    expect(document.getPages()).toHaveLength(2);
    for (const page of document.getPages()) {
      expect(page.getWidth()).toBeCloseTo(CR80_WIDTH_PT + 2 * PRINT_BLEED_PT, 2);
      expect(page.getHeight()).toBeCloseTo(CR80_HEIGHT_PT + 2 * PRINT_BLEED_PT, 2);
      expect(page.getTrimBox()).toMatchObject({
        x: PRINT_BLEED_PT,
        y: PRINT_BLEED_PT,
        width: CR80_WIDTH_PT,
        height: CR80_HEIGHT_PT,
      });
      expect(page.node.Resources()?.lookupMaybe(PDFName.of("Font"), PDFDict)?.keys().length ?? 0).toBeGreaterThan(0);
    }
    if (process.env.GENERATE_CREDENTIAL_QA === "1") {
      await mkdir("tmp/pdfs", { recursive: true });
      await writeFile("tmp/pdfs/member-credential-pvc-qa.pdf", bytes);
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
        "MISSING_CHURCH_LOGO",
        "MISSING_ROLE",
        "MISSING_BAPTISM_DATE",
        "MISSING_MOTHER_NAME",
        "MISSING_FATHER_NAME",
      ],
    });
    const document = await PDFDocument.load(bytes);
    expect(document.getPages()).toHaveLength(1);
    expect(document.getPage(0).getSize()).toEqual({
      width: A4_WIDTH_PT,
      height: A4_HEIGHT_PT,
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
