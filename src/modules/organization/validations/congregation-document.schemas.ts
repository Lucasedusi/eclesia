import { z } from "zod";
import { CONGREGATION_DOCUMENT_MAX_SIZE } from "../constants/congregation-documents";

export const congregationDocumentCategorySchema = z.enum([
  "WATER_BILL",
  "ENERGY_BILL",
  "DEED",
  "CONTRACT",
  "TAX_DOCUMENT",
  "RECEIPT",
  "OTHER",
]);

export const congregationDocumentMetadataSchema = z.object({
  congregationId: z.uuid("Congregação inválida."),
  title: z
    .string()
    .trim()
    .min(3, "Informe um nome com pelo menos 3 caracteres.")
    .max(140, "Use no máximo 140 caracteres."),
  category: congregationDocumentCategorySchema,
});

export const congregationDocumentPrepareSchema =
  congregationDocumentMetadataSchema.extend({
    originalFileName: z
      .string()
      .trim()
      .min(1, "Selecione o arquivo que deseja anexar.")
      .max(255, "O nome original do arquivo é muito longo."),
    fileSize: z
      .number()
      .int()
      .positive("Selecione um arquivo válido.")
      .max(
        CONGREGATION_DOCUMENT_MAX_SIZE,
        "O arquivo deve ter no máximo 10 MB.",
      ),
  });

export const congregationDocumentUpdateSchema = z.object({
  id: z.uuid("Documento inválido."),
  congregationId: z.uuid("Congregação inválida."),
  title: z
    .string()
    .trim()
    .min(3, "Informe um nome com pelo menos 3 caracteres.")
    .max(140, "Use no máximo 140 caracteres."),
  category: congregationDocumentCategorySchema,
});

export const congregationDocumentTargetSchema = z.object({
  id: z.uuid("Documento inválido."),
  congregationId: z.uuid("Congregação inválida."),
});
