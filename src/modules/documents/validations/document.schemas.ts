import { z } from "zod";
import {
  ADMINISTRATIVE_DOCUMENT_MAX_FILES,
  ADMINISTRATIVE_DOCUMENT_MAX_SIZE,
} from "../constants/documents";

const optionalText = (max: number) =>
  z.string().trim().max(max, `Use no máximo ${max} caracteres.`).optional().default("");

export const documentIdSchema = z.string().uuid("Identificador inválido.");

export const documentCategorySchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2, "Informe o nome da categoria.").max(100),
  description: optionalText(500),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Cor inválida.").optional().or(z.literal("")),
  icon: optionalText(50),
});

export const documentFolderSchema = z.object({
  id: z.string().uuid().optional(),
  categoryId: z.string().uuid("Selecione uma categoria."),
  name: z.string().trim().min(2, "Informe o nome da pasta.").max(140),
  description: optionalText(1000),
  physicalLocation: optionalText(500),
});

export const documentContainerActionSchema = z.object({
  id: documentIdSchema,
  action: z.enum(["ARCHIVE", "RESTORE", "DELETE", "RESTORE_DELETED"]),
});

export const documentListParamsSchema = z.object({
  search: z.string().trim().max(200).default(""),
  categoryId: z.string().uuid().or(z.literal("")).default(""),
  folderId: z.string().uuid().or(z.literal("")).default(""),
  tagId: z.string().uuid().or(z.literal("")).default(""),
  format: z.enum(["", "pdf", "jpg", "jpeg", "png", "webp", "doc", "docx", "xls", "xlsx"]).default(""),
  state: z.enum(["ACTIVE", "ARCHIVED", "DELETED"]).default("ACTIVE"),
  dateFrom: z.iso.date().or(z.literal("")).default(""),
  dateTo: z.iso.date().or(z.literal("")).default(""),
  uploadedBy: z.string().uuid().or(z.literal("")).default(""),
  sort: z.enum(["RECENT", "OLDEST", "TITLE_ASC", "SIZE_DESC", "SIZE_ASC"]).default("RECENT"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(10).max(50).default(20),
});

export const documentUploadPrepareSchema = z.object({
  folderId: z.string().uuid("Selecione uma pasta."),
  files: z.array(z.object({
    clientId: z.string().min(1).max(100),
    title: z.string().trim().min(1).max(180),
    originalFileName: z.string().trim().min(1).max(255),
    fileSize: z.number().int().positive().max(ADMINISTRATIVE_DOCUMENT_MAX_SIZE),
  })).min(1).max(ADMINISTRATIVE_DOCUMENT_MAX_FILES),
});

export const documentUploadIdsSchema = z.array(documentIdSchema).min(1).max(
  ADMINISTRATIVE_DOCUMENT_MAX_FILES,
);

export const documentMetadataSchema = z.object({
  id: documentIdSchema,
  title: z.string().trim().min(1, "Informe o título.").max(180),
  description: optionalText(2000),
  documentDate: z.iso.date().or(z.literal("")).default(""),
  referenceNumber: optionalText(120),
  physicalLocation: optionalText(500),
  notes: optionalText(3000),
  tagNames: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
});

export const documentReplacementPrepareSchema = z.object({
  id: documentIdSchema,
  originalFileName: z.string().trim().min(1).max(255),
  fileSize: z.number().int().positive().max(ADMINISTRATIVE_DOCUMENT_MAX_SIZE),
});

export const documentLifecycleSchema = z.object({
  id: documentIdSchema,
  action: z.enum(["ARCHIVE", "RESTORE", "TRASH", "RESTORE_TRASH", "DELETE_PERMANENTLY"]),
});
