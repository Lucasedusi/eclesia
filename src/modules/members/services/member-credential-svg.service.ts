import type { MemberCredentialPreview } from "../types/member-credential.types";
import { MEMBER_CREDENTIAL_COLORS as C } from "./member-credential.logic";

export const MEMBER_CREDENTIAL_SVG_WIDTH = 856;
export const MEMBER_CREDENTIAL_SVG_HEIGHT = 539.8;

type Side = "front" | "back";
export type CredentialBleed = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

function escapeXml(value: string) {
  return value
    .normalize("NFC")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function weightedLength(value: string) {
  return Array.from(value).reduce((total, character) => {
    if (/[MWÁÀÂÃÉÊÍÓÔÕÚÇ]/.test(character)) return total + 0.9;
    if (/[ilI1\s.,:/-]/.test(character)) return total + 0.35;
    return total + 0.65;
  }, 0);
}

function fittedText(
  value: string,
  preferred: number,
  minimum: number,
  width: number,
) {
  const idealSize = width / Math.max(1, weightedLength(value));
  const size = Math.max(minimum, Math.min(preferred, idealSize));
  if (weightedLength(value) * minimum <= width) return { value, size };
  let clipped = value;
  while (
    clipped.length > 1 &&
    weightedLength(`${clipped}…`) * minimum > width
  ) {
    clipped = clipped.slice(0, -1).trimEnd();
  }
  return { value: `${clipped}…`, size: minimum };
}

function text(
  value: string,
  x: number,
  y: number,
  preferred: number,
  minimum: number,
  width: number,
  options: {
    weight?: number;
    fill?: string;
    anchor?: "start" | "middle" | "end";
    tracking?: number;
  } = {},
) {
  const fitted = fittedText(value, preferred, minimum, width);
  return `<text x="${x}" y="${y}" font-family="CredentialRubik,Arial,sans-serif" font-size="${fitted.size.toFixed(2)}" font-weight="${options.weight ?? 600}" fill="${options.fill ?? C.navy}" text-anchor="${options.anchor ?? "start"}" letter-spacing="${options.tracking ?? 0}" dominant-baseline="alphabetic">${escapeXml(fitted.value)}</text>`;
}

function label(value: string, x: number, y: number, width: number) {
  return text(value.toUpperCase(), x, y, 14, 10, width, {
    weight: 500,
    tracking: 0.65,
  });
}

function exactWidthText(
  value: string,
  x: number,
  y: number,
  size: number,
  width: number,
) {
  return `<text x="${x}" y="${y}" font-family="CredentialRubik,Arial,sans-serif" font-size="${size}" font-weight="400" fill="${C.white}" text-anchor="middle" textLength="${width}" lengthAdjust="spacingAndGlyphs">${escapeXml(value)}</text>`;
}

function sharedDefs() {
  return `<defs>
    <clipPath id="card-clip"><rect width="856" height="539.8" rx="42"/></clipPath>
    <clipPath id="front-name-clip"><rect x="298" y="232" width="510" height="56"/></clipPath>
    <linearGradient id="navy-gradient" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${C.navyDeep}"/><stop offset="1" stop-color="${C.navy}"/></linearGradient>
    <linearGradient id="gold-gradient" x1="0" y1="0" x2="1" y2="0"><stop stop-color="${C.gold}"/><stop offset="0.5" stop-color="${C.goldLight}"/><stop offset="1" stop-color="${C.gold}"/></linearGradient>
    <radialGradient id="ivory-gradient" cx="52%" cy="44%" r="75%"><stop stop-color="#FFFFFF"/><stop offset="1" stop-color="${C.ivory}"/></radialGradient>
  </defs>`;
}

function qrSvg(matrix: boolean[][], x: number, y: number, size: number) {
  const dimension = Math.max(1, matrix.length);
  const quiet = 4;
  const moduleSize = size / (dimension + quiet * 2);
  const pixels: string[] = [];
  matrix.forEach((row, rowIndex) =>
    row.forEach((filled, columnIndex) => {
      if (filled) {
        pixels.push(
          `<rect x="${(x + (columnIndex + quiet) * moduleSize).toFixed(3)}" y="${(y + (rowIndex + quiet) * moduleSize).toFixed(3)}" width="${(moduleSize + 0.04).toFixed(3)}" height="${(moduleSize + 0.04).toFixed(3)}"/>`,
        );
      }
    }),
  );
  return `<g data-credential-qr="true"><rect x="${x}" y="${y}" width="${size}" height="${size}" rx="10" fill="#fff" stroke="${C.navy}" stroke-width="5"/><g fill="#000">${pixels.join("")}</g></g>`;
}

function logo(preview: MemberCredentialPreview) {
  if (preview.church.logoDataUri) {
    return `<circle cx="92" cy="95" r="52" fill="#fff" stroke="${C.gold}" stroke-width="3.5"/><image href="${escapeXml(preview.church.logoDataUri)}" x="49" y="52" width="86" height="86" preserveAspectRatio="xMidYMid meet"/>`;
  }
  const initials =
    preview.church.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase() || "EC";
  return `<circle cx="92" cy="95" r="52" fill="#fff" stroke="${C.gold}" stroke-width="3.5"/>${text(initials, 92, 108, 36, 25, 70, { weight: 750, fill: C.navy, anchor: "middle" })}`;
}

function renderFront(
  preview: MemberCredentialPreview,
  bleed?: CredentialBleed,
) {
  const left = (bleed?.left ?? 0) * 10;
  const right = (bleed?.right ?? 0) * 10;
  const top = (bleed?.top ?? 0) * 10;
  const bottom = (bleed?.bottom ?? 0) * 10;
  const canvas = bleed
    ? `<rect x="${-left}" y="${-top}" width="${856 + left + right}" height="${539.8 + top + bottom}" fill="url(#ivory-gradient)"/>`
    : '<rect width="856" height="539.8" fill="url(#ivory-gradient)"/>';
  const navy = bleed
    ? `<rect x="${-left}" y="${-top}" width="${856 + left + right}" height="${190 + top}" fill="url(#navy-gradient)"/>`
    : '<rect width="856" height="190" fill="url(#navy-gradient)"/>';
  const gold = bleed
    ? `<rect x="${-left}" y="190" width="${856 + left + right}" height="12" fill="url(#gold-gradient)"/>`
    : '<rect y="190" width="856" height="12" fill="url(#gold-gradient)"/>';
  return `<g${bleed ? "" : ' clip-path="url(#card-clip)"'}>
    ${canvas}
    ${navy}
    ${gold}
    ${logo(preview)}
    ${text(preview.church.name.toUpperCase(), 160, 70, 31, 18, 648, { weight: 750, fill: C.white })}
    ${text(preview.church.addressLine, 160, 107, 22, 17, 648, { weight: 400, fill: C.white })}
    ${text(`Fone: ${preview.church.phone} • CNPJ: ${preview.church.document}`, 160, 145, 20, 14, 648, { weight: 400, fill: C.white })}
    ${qrSvg(preview.validation.qrMatrix, 54, 254, 204)}
    ${text("VALIDAR CREDENCIAL", 156, 480, 12, 9, 180, { weight: 500, fill: C.navy, anchor: "middle", tracking: 0.6 })}
    <g clip-path="url(#front-name-clip)">${text(preview.member.fullName.toUpperCase(), 306, 276, 24, 16, 500, { weight: 750 })}</g>
    ${text(preview.member.roleName.toUpperCase(), 306, 315, 20, 14, 500, { weight: 650, fill: C.gold })}
    <path d="M306 337H806" stroke="${C.gold}" stroke-width="2"/>
    ${label("Nº MATRÍCULA", 306, 372, 210)}
    ${label("CONGREGAÇÃO", 570, 372, 236)}
    ${text(preview.member.memberCode, 306, 406, 24, 16, 218, { weight: 650 })}
    ${text(preview.member.congregationName.toUpperCase(), 570, 406, 24, 14, 236, { weight: 650 })}
    <path d="M548 354V421M306 432H806" stroke="${C.gold}" stroke-width="1.5"/>
    ${label("CPF", 306, 465, 218)}
    ${label("DATA DE NASCIMENTO", 570, 465, 236)}
    ${text(preview.member.cpf, 306, 499, 24, 15, 218, { weight: 650 })}
    ${text(preview.member.birthDate, 570, 499, 24, 15, 236, { weight: 650 })}
    <path d="M548 449V516" stroke="${C.gold}" stroke-width="1.5"/>
  </g>`;
}

function renderBack(preview: MemberCredentialPreview, bleed?: CredentialBleed) {
  const noticeFirstLine = "Este cartão é nominal e intransferível.";
  const noticeSecondLine =
    "Seu titular poderá portá-lo enquanto proceder de acordo com os princípios da Palavra de Deus";
  const left = (bleed?.left ?? 0) * 10;
  const right = (bleed?.right ?? 0) * 10;
  const top = (bleed?.top ?? 0) * 10;
  const bottom = (bleed?.bottom ?? 0) * 10;
  const canvas = bleed
    ? `<rect x="${-left}" y="${-top}" width="${856 + left + right}" height="${539.8 + top + bottom}" fill="url(#ivory-gradient)"/>`
    : '<rect width="856" height="539.8" fill="url(#ivory-gradient)"/>';
  const navy = bleed
    ? `<rect x="${-left}" y="${-top}" width="${856 + left + right}" height="${72 + top}" fill="url(#navy-gradient)"/>`
    : '<rect width="856" height="72" fill="url(#navy-gradient)"/>';
  const gold = bleed
    ? `<rect x="${-left}" y="72" width="${856 + left + right}" height="14" fill="url(#gold-gradient)"/>`
    : '<rect y="72" width="856" height="14" fill="url(#gold-gradient)"/>';
  return `<g${bleed ? "" : ' clip-path="url(#card-clip)"'}>
    ${canvas}
    ${navy}
    ${gold}
    ${text(noticeFirstLine, 428, 34, 17, 17, 760, { weight: 400, fill: C.white, anchor: "middle" })}
    ${exactWidthText(noticeSecondLine, 428, 58, 17, 760)}
    ${preview.church.logoDataUri ? `<image href="${escapeXml(preview.church.logoDataUri)}" x="248" y="110" width="360" height="360" preserveAspectRatio="xMidYMid meet" opacity="0.08"/>` : ""}
    ${label("PAI", 58, 116, 740)}
    ${text(preview.member.fatherName, 58, 150, 27, 15, 740, { weight: 550 })}
    <path d="M58 168H798" stroke="${C.lightBlue}" stroke-width="1.2"/>
    ${label("MÃE", 58, 202, 740)}
    ${text(preview.member.motherName, 58, 236, 27, 15, 740, { weight: 550 })}
    <path d="M58 254H798" stroke="${C.lightBlue}" stroke-width="1.2"/>
    ${label("NATURALIDADE", 58, 288, 740)}
    ${text(preview.member.naturality, 58, 322, 26, 15, 740, { weight: 550 })}
    <path d="M58 340H798" stroke="${C.lightBlue}" stroke-width="1.2"/>
    ${label("DATA DE BATISMO NAS ÁGUAS", 58, 374, 332)}
    ${label("DATA DE EMISSÃO", 474, 374, 324)}
    ${text(preview.member.baptismDate, 58, 410, 25, 16, 332, { weight: 650 })}
    ${text(preview.issuedDate, 474, 410, 25, 16, 324, { weight: 650 })}
    <path d="M433 356V426" stroke="${C.lightBlue}" stroke-width="1.2"/>
    <path d="M225 501H631" stroke="${C.navy}" stroke-width="1.5"/>
  </g>`;
}

export function renderMemberCredentialSvg(
  preview: MemberCredentialPreview,
  side: Side,
) {
  const content = side === "front" ? renderFront(preview) : renderBack(preview);
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="85.6mm" height="53.98mm" viewBox="0 0 ${MEMBER_CREDENTIAL_SVG_WIDTH} ${MEMBER_CREDENTIAL_SVG_HEIGHT}" role="img" aria-label="${side === "front" ? "Frente" : "Verso"} da credencial de membro">${sharedDefs()}${content}</svg>`;
}

export function renderMemberCredentialPrintSvg(
  preview: MemberCredentialPreview,
  side: Side,
  bleed: CredentialBleed,
) {
  const left = bleed.left * 10;
  const right = bleed.right * 10;
  const top = bleed.top * 10;
  const bottom = bleed.bottom * 10;
  const width = MEMBER_CREDENTIAL_SVG_WIDTH + left + right;
  const height = MEMBER_CREDENTIAL_SVG_HEIGHT + top + bottom;
  const content =
    side === "front" ? renderFront(preview, bleed) : renderBack(preview, bleed);
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${85.6 + bleed.left + bleed.right}mm" height="${53.98 + bleed.top + bleed.bottom}mm" viewBox="${-left} ${-top} ${width} ${height}">${sharedDefs()}${content}</svg>`;
}
