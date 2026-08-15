export const ADMINISTRATIVE_DOCUMENT_BUCKET = "administrative-documents";
export const ADMINISTRATIVE_DOCUMENT_MAX_SIZE = 10 * 1024 * 1024;
export const ADMINISTRATIVE_DOCUMENT_MAX_FILES = 20;
export const ADMINISTRATIVE_DOCUMENT_PENDING_TTL_MS = 2 * 60 * 60 * 1000;

export const ADMINISTRATIVE_DOCUMENT_MIME_TYPES = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
} as const;

export const ADMINISTRATIVE_DOCUMENT_ACCEPT = Object.keys(
  ADMINISTRATIVE_DOCUMENT_MIME_TYPES,
)
  .map((extension) => `.${extension}`)
  .join(",");

export const ADMINISTRATIVE_DOCUMENT_FORMAT_OPTIONS = [
  { value: "", label: "Todos os formatos" },
  { value: "pdf", label: "PDF" },
  { value: "jpg", label: "JPEG / JPG" },
  { value: "png", label: "PNG" },
  { value: "webp", label: "WEBP" },
  { value: "doc", label: "DOC" },
  { value: "docx", label: "DOCX" },
  { value: "xls", label: "XLS" },
  { value: "xlsx", label: "XLSX" },
] as const;

export const DOCUMENT_CATEGORY_COLORS = [
  "#415BA5",
  "#25805D",
  "#B7791F",
  "#B5474B",
  "#6941C6",
  "#1570EF",
] as const;
