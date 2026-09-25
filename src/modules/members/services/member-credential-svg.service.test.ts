import { describe, expect, it } from "vitest";
import type { MemberCredentialPreview } from "../types/member-credential.types";
import {
  MEMBER_CREDENTIAL_SVG_HEIGHT,
  MEMBER_CREDENTIAL_SVG_WIDTH,
  renderMemberCredentialPrintSvg,
  renderMemberCredentialSvg,
} from "./member-credential-svg.service";

const preview: MemberCredentialPreview = {
  issuedAt: "2026-09-22T12:00:00.000Z",
  issuedDate: "22/09/2026",
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
    motherName: "Ana de Souza",
    fatherName: "José de Souza",
    naturality: "Goiânia - GO",
  },
  validation: {
    token: "a".repeat(43),
    url: `https://example.com/verificar/membro/${"a".repeat(43)}`,
    qrMatrix: [
      [true, false],
      [false, true],
    ],
    activeIssuedAt: null,
  },
  warnings: ["MISSING_CHURCH_LOGO"],
};

describe("renderMemberCredentialSvg", () => {
  it("estende a arte de impressão além do corte sem arredondar a sangria", () => {
    const svg = renderMemberCredentialPrintSvg(preview, "front", {
      left: 3,
      right: 3,
      top: 3,
      bottom: 3,
    });
    expect(svg).toContain('viewBox="-30 -30 916 599.8"');
    expect(svg).toContain('width="91.6mm" height="59.98mm"');
    expect(svg).not.toContain('<g clip-path="url(#card-clip)">');
    expect(svg).toContain('x="-30" y="-30"');
    expect(svg).toContain(
      'x="-30" y="-30" width="916" height="220" fill="url(#navy-gradient)"',
    );
    expect(svg).toContain(
      'x="-30" y="190" width="916" height="12" fill="url(#gold-gradient)"',
    );
  });
  it.each(["front", "back"] as const)(
    "renderiza %s no mesmo canvas CR80",
    (side) => {
      const svg = renderMemberCredentialSvg(preview, side);
      expect(svg).toContain(
        `viewBox="0 0 ${MEMBER_CREDENTIAL_SVG_WIDTH} ${MEMBER_CREDENTIAL_SVG_HEIGHT}"`,
      );
      expect(svg).not.toContain("foreignObject");
    },
  );

  it("inclui os campos finais e um QR real na frente", () => {
    const svg = renderMemberCredentialSvg(preview, "front");
    expect(svg).toContain("MARIA DE SOUZA");
    expect(svg).toContain("123.456.789-09");
    expect(svg).toContain("DATA DE NASCIMENTO");
    expect(svg).toContain("data-credential-qr");
  });

  it("reduz a tipografia, afina labels e impede o nome de escapar da área útil", () => {
    const svg = renderMemberCredentialSvg(
      {
        ...preview,
        member: {
          ...preview.member,
          fullName: "Kamylla Araújo da Silva Oliveira dos Santos Albuquerque",
        },
      },
      "front",
    );
    expect(svg).toContain('clipPath id="front-name-clip"');
    expect(svg).toMatch(
      /font-size="(?:1[6-9]|2\d|3[0-6])\.\d{2}"[^>]*>KAMYLLA/,
    );
    expect(svg).toMatch(/font-weight="500"[^>]*>Nº MATRÍCULA<\/text>/);
    expect(svg).toContain('<circle cx="92" cy="95" r="52"');
  });

  it("remove a faixa azul-clara decorativa da frente", () => {
    const svg = renderMemberCredentialSvg(preview, "front");
    expect(svg).not.toContain("M0 171C230 169 383 234 548 194");
  });

  it("usa cabeçalho frontal reto e alinha logo, título e contatos no centro vertical", () => {
    const svg = renderMemberCredentialSvg(preview, "front");
    expect(svg).toContain(
      '<rect width="856" height="190" fill="url(#navy-gradient)"/>',
    );
    expect(svg).toContain(
      '<rect y="190" width="856" height="12" fill="url(#gold-gradient)"/>',
    );
    expect(svg).toContain('<circle cx="92" cy="95" r="52"');
    expect(svg).toMatch(
      /<text x="160" y="70"[^>]*>IGREJA BATISTA CENTRAL<\/text>/,
    );
    expect(svg).toMatch(
      /<text x="160" y="107"[^>]*font-size="22\.00"[^>]*>Rua das Flores/,
    );
    expect(svg).toMatch(
      /<text x="160" y="145"[^>]*font-size="20\.00"[^>]*>Fone:/,
    );
    expect(svg).toContain("Fone: (62) 99999-8888 • CNPJ: 01.185.743/0001-46");
    expect(svg).not.toContain("M0 0H856V194C736");
    expect(svg).not.toContain("M0 398C143 521");
  });

  it("usa faixas retas no verso e mantém o texto institucional dentro do cabeçalho", () => {
    const svg = renderMemberCredentialSvg(preview, "back");
    expect(svg).toContain("José de Souza");
    expect(svg).toContain("DATA DE EMISSÃO");
    expect(svg).toContain("Este cartão é nominal e intransferível.");
    expect(svg.indexOf("Este cartão é nominal")).toBeLessThan(
      svg.indexOf(">PAI</text>"),
    );
    expect(svg).not.toContain(">ASSINATURA</text>");
    expect(svg).toContain('d="M225 501H631"');
    expect(svg).toContain(
      '<rect width="856" height="72" fill="url(#navy-gradient)"/>',
    );
    expect(svg).toContain(
      '<rect y="72" width="856" height="14" fill="url(#gold-gradient)"/>',
    );
    expect(svg).toMatch(
      /<text x="428" y="34"[^>]*font-size="17\.00"[^>]*>Este cartão é nominal e intransferível\.<\/text>/,
    );
    expect(svg).toMatch(
      /<text x="428" y="58"[^>]*font-size="17"[^>]*>Seu titular poderá portá-lo enquanto proceder de acordo com os princípios da Palavra de Deus<\/text>/,
    );
    expect(svg).not.toContain(
      "M0 0H856V71C669 38 511 75 346 67C218 62 110 38 0 34Z",
    );
    expect(svg).not.toContain("M0 151C235 151 380 216 542 177");
    expect(svg).not.toContain("M0 34C143 49 230 78 382 74");
    expect(svg).not.toContain("M0 51C144 68 235 95 390 90");
    expect(svg).not.toContain("M0 478C160 532 311 511");
    expect(svg).not.toContain("M0 470C172 520 313 498");
    expect(svg).not.toContain("M0 460C178 508 313 485");
    expect(svg).not.toContain("Igreja Batista Central");
  });

  it("usa a logo oficial como marca d'água discreta no verso sem cobrir a assinatura", () => {
    const svg = renderMemberCredentialSvg({
      ...preview,
      church: { ...preview.church, logoDataUri: "data:image/png;base64,iVBORw0KGgo=" },
    }, "back");
    expect(svg).toMatch(/<image href="data:image\/png;base64,iVBORw0KGgo=" x="248" y="110" width="360" height="360"[^>]*opacity="0\.08"/);
    expect(svg.indexOf('opacity="0.08"')).toBeLessThan(svg.indexOf('>PAI</text>'));
    expect(svg).toContain('d="M225 501H631"');
    expect(renderMemberCredentialSvg(preview, "back")).not.toContain('opacity="0.08"');
  });

  it("escapa conteúdo dinâmico e mantém texto longo em uma linha", () => {
    const svg = renderMemberCredentialSvg(
      {
        ...preview,
        member: {
          ...preview.member,
          fullName: `<Maria & ${"Longa ".repeat(30)}>`,
        },
      },
      "front",
    );
    expect(svg).toContain("&lt;MARIA &amp;");
    expect(svg).not.toContain("<Maria &");
    expect(svg).not.toContain("<tspan");
  });
});
