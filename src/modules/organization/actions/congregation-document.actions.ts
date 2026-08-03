"use server";

import { revalidatePath } from "next/cache";
import type {
  CongregationDocumentListState,
  CongregationDocumentUploadState,
  CongregationDocumentUrlState,
  OrganizationActionState,
} from "../types/organization.types";
import {
  congregationDocumentPrepareSchema,
  congregationDocumentTargetSchema,
  congregationDocumentUpdateSchema,
} from "../validations/congregation-document.schemas";
import {
  archiveCongregationDocument,
  cancelCongregationDocumentUpload,
  CongregationDocumentServiceError,
  createCongregationDocumentUrl,
  finalizeCongregationDocumentUpload,
  listCongregationDocuments,
  prepareCongregationDocumentUpload,
  updateCongregationDocument,
} from "../services/congregation-document.service";

function actionError(
  error: unknown,
  fallback: string,
): OrganizationActionState & { status: "error" } {
  if (error instanceof CongregationDocumentServiceError) {
    return { status: "error", message: error.message };
  }

  console.error("[congregation-documents] unexpected action failure", error);
  return { status: "error", message: fallback };
}

function refreshOrganization() {
  revalidatePath("/estrutura-eclesiastica", "layout");
}

export async function listCongregationDocumentsAction(
  congregationId: string,
): Promise<CongregationDocumentListState> {
  const parsed = congregationDocumentTargetSchema.shape.congregationId.safeParse(
    congregationId,
  );
  if (!parsed.success) {
    return {
      status: "error",
      message: "Congregação inválida.",
      documents: [],
    };
  }

  try {
    const documents = await listCongregationDocuments(parsed.data);
    return { status: "success", message: "", documents };
  } catch (error) {
    const state = actionError(error, "Não foi possível carregar os documentos.");
    return { status: "error", message: state.message, documents: [] };
  }
}

export async function prepareCongregationDocumentUploadAction(input: {
  congregationId: string;
  title: string;
  category: string;
  originalFileName: string;
  fileSize: number;
}): Promise<CongregationDocumentUploadState> {
  const parsed = congregationDocumentPrepareSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Revise os campos do documento.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const prepared = await prepareCongregationDocumentUpload(
      {
        congregationId: parsed.data.congregationId,
        title: parsed.data.title,
        category: parsed.data.category,
      },
      parsed.data.originalFileName,
      parsed.data.fileSize,
    );

    return {
      status: "success",
      message: "",
      ...prepared,
    };
  } catch (error) {
    return actionError(
      error,
      "Não foi possível preparar o envio do documento.",
    );
  }
}

export async function finalizeCongregationDocumentUploadAction(input: {
  id: string;
  congregationId: string;
}): Promise<OrganizationActionState> {
  const parsed = congregationDocumentTargetSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: "Documento inválido." };
  }

  try {
    await finalizeCongregationDocumentUpload(
      parsed.data.id,
      parsed.data.congregationId,
    );
    refreshOrganization();
    return { status: "success", message: "Documento anexado com sucesso." };
  } catch (error) {
    return actionError(error, "Não foi possível confirmar o documento.");
  }
}

export async function cancelCongregationDocumentUploadAction(input: {
  id: string;
  congregationId: string;
}) {
  const parsed = congregationDocumentTargetSchema.safeParse(input);
  if (!parsed.success) return;
  await cancelCongregationDocumentUpload(
    parsed.data.id,
    parsed.data.congregationId,
  );
}

export async function updateCongregationDocumentAction(input: {
  id: string;
  congregationId: string;
  title: string;
  category: string;
}): Promise<OrganizationActionState> {
  const parsed = congregationDocumentUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Revise os dados do documento.",
    };
  }

  try {
    await updateCongregationDocument(parsed.data);
    refreshOrganization();
    return { status: "success", message: "Documento atualizado com sucesso." };
  } catch (error) {
    return actionError(error, "Não foi possível atualizar o documento.");
  }
}

export async function archiveCongregationDocumentAction(input: {
  id: string;
  congregationId: string;
}): Promise<OrganizationActionState> {
  const parsed = congregationDocumentTargetSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: "Documento inválido." };
  }

  try {
    await archiveCongregationDocument(parsed.data.id, parsed.data.congregationId);
    refreshOrganization();
    return { status: "success", message: "Documento excluído com sucesso." };
  } catch (error) {
    return actionError(error, "Não foi possível excluir o documento.");
  }
}

export async function createCongregationDocumentUrlAction(input: {
  id: string;
  congregationId: string;
  download: boolean;
}): Promise<CongregationDocumentUrlState> {
  const parsed = congregationDocumentTargetSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: "Documento inválido." };
  }

  try {
    const url = await createCongregationDocumentUrl(
      parsed.data.id,
      parsed.data.congregationId,
      Boolean(input.download),
    );
    return { status: "success", message: "", url };
  } catch (error) {
    const state = actionError(error, "Não foi possível abrir o documento.");
    return { status: "error", message: state.message };
  }
}
