import type { CongregationDocumentCategory } from "../types/organization.types";

export const CONGREGATION_DOCUMENT_BUCKET = "congregation-documents";
export const CONGREGATION_DOCUMENT_MAX_SIZE = 10 * 1024 * 1024;

export const CONGREGATION_DOCUMENT_CATEGORIES: ReadonlyArray<{
  value: CongregationDocumentCategory;
  label: string;
}> = [
  { value: "WATER_BILL", label: "Fatura de água" },
  { value: "ENERGY_BILL", label: "Fatura de energia" },
  { value: "DEED", label: "Escritura" },
  { value: "CONTRACT", label: "Contrato" },
  { value: "TAX_DOCUMENT", label: "Documento fiscal" },
  { value: "RECEIPT", label: "Comprovante" },
  { value: "OTHER", label: "Outros" },
];

export const CONGREGATION_DOCUMENT_ACCEPT = [
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".doc",
  ".docx",
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
].join(",");

export function getCongregationDocumentCategoryLabel(
  category: CongregationDocumentCategory,
) {
  return (
    CONGREGATION_DOCUMENT_CATEGORIES.find((item) => item.value === category)
      ?.label ?? "Outros"
  );
}
