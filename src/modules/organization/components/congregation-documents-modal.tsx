"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Download,
  Eye,
  File,
  FileText,
  Image as ImageIcon,
  Loader2,
  Paperclip,
  Pencil,
  RotateCw,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import {
  archiveCongregationDocumentAction,
  cancelCongregationDocumentUploadAction,
  createCongregationDocumentUrlAction,
  finalizeCongregationDocumentUploadAction,
  listCongregationDocumentsAction,
  prepareCongregationDocumentUploadAction,
  updateCongregationDocumentAction,
} from "../actions/congregation-document.actions";
import {
  CONGREGATION_DOCUMENT_ACCEPT,
  CONGREGATION_DOCUMENT_BUCKET,
  CONGREGATION_DOCUMENT_CATEGORIES,
  CONGREGATION_DOCUMENT_MAX_SIZE,
  getCongregationDocumentCategoryLabel,
} from "../constants/congregation-documents";
import type {
  CongregationDocumentCategory,
  CongregationDocumentItem,
  CongregationItem,
  OrganizationActionState,
} from "../types/organization.types";
import { INITIAL_ORGANIZATION_ACTION_STATE } from "../types/organization.types";
import * as D from "./congregation-documents.styles";

type BusyAction = {
  id: string;
  kind: "view" | "download" | "edit" | "delete";
} | null;

type Props = {
  congregation: CongregationItem;
  canManage: boolean;
  onClose: () => void;
  onResult: (state: OrganizationActionState) => void;
};

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function isPreviewable(document: CongregationDocumentItem) {
  return (
    document.mimeType === "application/pdf" ||
    document.mimeType.startsWith("image/")
  );
}

function DocumentTypeIcon({
  document,
}: {
  document: CongregationDocumentItem;
}) {
  if (document.mimeType.startsWith("image/")) return <ImageIcon />;
  if (document.mimeType === "application/pdf") return <FileText />;
  return <File />;
}

export function CongregationDocumentsModal({
  congregation,
  canManage,
  onClose,
  onResult,
}: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [documents, setDocuments] = useState<CongregationDocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadCategory, setUploadCategory] =
    useState<CongregationDocumentCategory>("OTHER");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadPending, setUploadPending] = useState(false);
  const [uploadState, setUploadState] = useState<OrganizationActionState>(
    INITIAL_ORGANIZATION_ACTION_STATE,
  );
  const [editing, setEditing] = useState<CongregationDocumentItem | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editCategory, setEditCategory] =
    useState<CongregationDocumentCategory>("OTHER");
  const [deleteTarget, setDeleteTarget] =
    useState<CongregationDocumentItem | null>(null);
  const [busyAction, setBusyAction] = useState<BusyAction>(null);

  const reloadDocuments = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    const result = await listCongregationDocumentsAction(congregation.id);
    setDocuments(result.documents);
    if (result.status === "error") setLoadError(result.message);
    setLoading(false);
  }, [congregation.id]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void reloadDocuments();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [reloadDocuments]);

  async function uploadDocument(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedFile) {
      const result: OrganizationActionState = {
        status: "error",
        message: "Selecione o arquivo que deseja anexar.",
        fieldErrors: { file: ["Selecione um arquivo."] },
      };
      setUploadState(result);
      onResult(result);
      return;
    }

    if (selectedFile.size > CONGREGATION_DOCUMENT_MAX_SIZE) {
      const result: OrganizationActionState = {
        status: "error",
        message: "O arquivo deve ter no máximo 10 MB.",
        fieldErrors: { file: ["O arquivo deve ter no máximo 10 MB."] },
      };
      setUploadState(result);
      onResult(result);
      return;
    }

    setUploadPending(true);
    setUploadState(INITIAL_ORGANIZATION_ACTION_STATE);
    let preparedDocumentId: string | undefined;

    try {
      const prepared = await prepareCongregationDocumentUploadAction({
        congregationId: congregation.id,
        title: uploadTitle,
        category: uploadCategory,
        originalFileName: selectedFile.name,
        fileSize: selectedFile.size,
      });

      if (
        prepared.status === "error" ||
        !prepared.documentId ||
        !prepared.path ||
        !prepared.token ||
        !prepared.contentType
      ) {
        const result: OrganizationActionState = {
          status: "error",
          message: prepared.message,
          fieldErrors: prepared.fieldErrors,
        };
        setUploadState(result);
        onResult(result);
        return;
      }

      preparedDocumentId = prepared.documentId;
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from(CONGREGATION_DOCUMENT_BUCKET)
        .uploadToSignedUrl(prepared.path, prepared.token, selectedFile, {
          cacheControl: "3600",
          contentType: prepared.contentType,
        });

      if (uploadError) {
        await cancelCongregationDocumentUploadAction({
          id: prepared.documentId,
          congregationId: congregation.id,
        });
        const result: OrganizationActionState = {
          status: "error",
          message: "Não foi possível enviar o arquivo. Tente novamente.",
        };
        setUploadState(result);
        onResult(result);
        return;
      }

      const result = await finalizeCongregationDocumentUploadAction({
        id: prepared.documentId,
        congregationId: congregation.id,
      });
      setUploadState(result);
      onResult(result);

      if (result.status === "success") {
        formRef.current?.reset();
        setUploadTitle("");
        setUploadCategory("OTHER");
        setSelectedFile(null);
        await reloadDocuments();
      }
    } catch (error) {
      console.error("[congregation-documents] browser upload failed", error);
      if (preparedDocumentId) {
        await cancelCongregationDocumentUploadAction({
          id: preparedDocumentId,
          congregationId: congregation.id,
        });
      }
      const result: OrganizationActionState = {
        status: "error",
        message: "Não foi possível anexar o documento.",
      };
      setUploadState(result);
      onResult(result);
    } finally {
      setUploadPending(false);
    }
  }

  function startEditing(document: CongregationDocumentItem) {
    setEditing(document);
    setEditTitle(document.title);
    setEditCategory(document.category);
  }

  async function saveEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;

    setBusyAction({ id: editing.id, kind: "edit" });
    const result = await updateCongregationDocumentAction({
      id: editing.id,
      congregationId: congregation.id,
      title: editTitle,
      category: editCategory,
    });
    setBusyAction(null);
    onResult(result);

    if (result.status === "success") {
      setEditing(null);
      await reloadDocuments();
    }
  }

  async function deleteDocument() {
    if (!deleteTarget) return;

    setBusyAction({ id: deleteTarget.id, kind: "delete" });
    const result = await archiveCongregationDocumentAction({
      id: deleteTarget.id,
      congregationId: congregation.id,
    });
    setBusyAction(null);
    onResult(result);

    if (result.status === "success") {
      setDeleteTarget(null);
      if (editing?.id === deleteTarget.id) setEditing(null);
      await reloadDocuments();
    }
  }

  async function openDocument(
    document: CongregationDocumentItem,
    download: boolean,
  ) {
    const previewWindow = download ? null : window.open("", "_blank");
    if (previewWindow) {
      previewWindow.opener = null;
      previewWindow.document.title = "Abrindo documento...";
    }

    setBusyAction({ id: document.id, kind: download ? "download" : "view" });
    const result = await createCongregationDocumentUrlAction({
      id: document.id,
      congregationId: congregation.id,
      download,
    });
    setBusyAction(null);

    if (result.status === "error" || !result.url) {
      previewWindow?.close();
      onResult({ status: "error", message: result.message });
      return;
    }

    if (download) {
      const link = window.document.createElement("a");
      link.href = result.url;
      link.rel = "noopener noreferrer";
      link.click();
      return;
    }

    if (previewWindow) previewWindow.location.replace(result.url);
    else window.location.assign(result.url);
  }

  const modalBusy =
    uploadPending ||
    busyAction?.kind === "edit" ||
    busyAction?.kind === "delete" ||
    Boolean(deleteTarget);

  return (
    <>
      <Modal
        title="Documentos da Congregação"
        description={congregation.name}
        icon={<Paperclip />}
        size="lg"
        onClose={onClose}
        busy={modalBusy}
      >
        <D.Content>
          {canManage ? (
            <D.UploadPanel>
              <D.SectionHeading>
                <div>
                  <h3>Anexar novo documento</h3>
                  <p>
                    O arquivo ficará privado e disponível somente para usuários
                    autorizados.
                  </p>
                </div>
              </D.SectionHeading>

              <D.UploadForm ref={formRef} onSubmit={uploadDocument}>
                <D.FormGrid>
                  <D.Field>
                    <span>Nome do documento *</span>
                    <D.Input
                      value={uploadTitle}
                      onChange={(event) => setUploadTitle(event.target.value)}
                      placeholder="Ex.: Fatura de energia — Julho de 2026"
                      maxLength={140}
                      required
                      disabled={uploadPending}
                      $invalid={Boolean(uploadState.fieldErrors?.title)}
                    />
                    {uploadState.fieldErrors?.title?.[0] ? (
                      <D.FieldError>
                        {uploadState.fieldErrors.title[0]}
                      </D.FieldError>
                    ) : null}
                  </D.Field>

                  <D.Field>
                    <span>Categoria *</span>
                    <D.Select
                      value={uploadCategory}
                      onChange={(event) =>
                        setUploadCategory(
                          event.target.value as CongregationDocumentCategory,
                        )
                      }
                      disabled={uploadPending}
                      $invalid={Boolean(uploadState.fieldErrors?.category)}
                    >
                      {CONGREGATION_DOCUMENT_CATEGORIES.map((category) => (
                        <option key={category.value} value={category.value}>
                          {category.label}
                        </option>
                      ))}
                    </D.Select>
                  </D.Field>
                </D.FormGrid>

                <D.FileDrop
                  $invalid={Boolean(
                    uploadState.fieldErrors?.file ||
                    uploadState.fieldErrors?.originalFileName ||
                    uploadState.fieldErrors?.fileSize,
                  )}
                >
                  <input
                    type="file"
                    accept={CONGREGATION_DOCUMENT_ACCEPT}
                    required
                    disabled={uploadPending}
                    onChange={(event) =>
                      setSelectedFile(event.target.files?.[0] ?? null)
                    }
                  />
                  <div>
                    <Upload aria-hidden="true" />
                    <strong>Clique para selecionar o arquivo</strong>
                    <small>
                      PDF, JPG, PNG, WEBP, DOC ou DOCX · máximo de 10 MB
                    </small>
                    {selectedFile ? (
                      <D.SelectedFile>
                        <Paperclip />
                        {selectedFile.name} ·{" "}
                        {formatFileSize(selectedFile.size)}
                      </D.SelectedFile>
                    ) : null}
                  </div>
                </D.FileDrop>
                {uploadState.fieldErrors?.file?.[0] ? (
                  <D.FieldError>{uploadState.fieldErrors.file[0]}</D.FieldError>
                ) : uploadState.fieldErrors?.originalFileName?.[0] ? (
                  <D.FieldError>
                    {uploadState.fieldErrors.originalFileName[0]}
                  </D.FieldError>
                ) : uploadState.fieldErrors?.fileSize?.[0] ? (
                  <D.FieldError>
                    {uploadState.fieldErrors.fileSize[0]}
                  </D.FieldError>
                ) : null}

                <D.UploadFooter>
                  <small>
                    O nome original do arquivo será preservado para download.
                  </small>
                  <Button type="submit" size="sm" loading={uploadPending}>
                    <Upload />{" "}
                    {uploadPending ? "Enviando..." : "Anexar documento"}
                  </Button>
                </D.UploadFooter>
              </D.UploadForm>
            </D.UploadPanel>
          ) : null}

          <D.DocumentsSection>
            <D.SectionHeading>
              <div>
                <h3>Documentos anexados</h3>
                <p>
                  Visualize ou baixe os arquivos relacionados a esta
                  Congregação.
                </p>
              </div>
              {!loading ? (
                <D.CountBadge>{documents.length}</D.CountBadge>
              ) : null}
            </D.SectionHeading>

            {loading ? (
              <D.LoadingState>
                <span>
                  <Loader2 /> Carregando documentos...
                </span>
              </D.LoadingState>
            ) : loadError ? (
              <D.ErrorState>
                <div>
                  <span>
                    <FileText />
                  </span>
                  <h4>Não foi possível carregar</h4>
                  <p>{loadError}</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void reloadDocuments()}
                  >
                    <RotateCw /> Tentar novamente
                  </Button>
                </div>
              </D.ErrorState>
            ) : documents.length === 0 ? (
              <D.EmptyState>
                <div>
                  <span>
                    <Paperclip />
                  </span>
                  <h4>Nenhum documento anexado</h4>
                  <p>Os documentos enviados aparecerão organizados aqui.</p>
                </div>
              </D.EmptyState>
            ) : (
              <D.DocumentList>
                {documents.map((document) => {
                  const action =
                    busyAction?.id === document.id ? busyAction.kind : null;
                  return (
                    <D.DocumentRow key={document.id}>
                      <D.DocumentIcon
                        $image={document.mimeType.startsWith("image/")}
                      >
                        <DocumentTypeIcon document={document} />
                      </D.DocumentIcon>
                      <D.DocumentInfo>
                        <strong title={document.title}>{document.title}</strong>
                        <span>
                          <span>
                            {getCongregationDocumentCategoryLabel(
                              document.category,
                            )}
                          </span>
                          <span>{formatFileSize(document.fileSize)}</span>
                          <span>{formatDate(document.uploadedAt)}</span>
                          <span title={document.originalFileName}>
                            {document.originalFileName}
                          </span>
                        </span>
                      </D.DocumentInfo>
                      <D.DocumentActions>
                        {isPreviewable(document) ? (
                          <D.DocumentAction
                            type="button"
                            title="Visualizar"
                            aria-label={`Visualizar ${document.title}`}
                            disabled={Boolean(action)}
                            data-loading={action === "view"}
                            onClick={() => void openDocument(document, false)}
                          >
                            {action === "view" ? <Loader2 /> : <Eye />}
                          </D.DocumentAction>
                        ) : null}
                        <D.DocumentAction
                          type="button"
                          title="Baixar"
                          aria-label={`Baixar ${document.title}`}
                          disabled={Boolean(action)}
                          data-loading={action === "download"}
                          onClick={() => void openDocument(document, true)}
                        >
                          {action === "download" ? <Loader2 /> : <Download />}
                        </D.DocumentAction>
                        {canManage ? (
                          <>
                            <D.DocumentAction
                              type="button"
                              title="Editar nome e categoria"
                              aria-label={`Editar ${document.title}`}
                              disabled={Boolean(action)}
                              onClick={() => startEditing(document)}
                            >
                              <Pencil />
                            </D.DocumentAction>
                            <D.DocumentAction
                              type="button"
                              $danger
                              title="Excluir"
                              aria-label={`Excluir ${document.title}`}
                              disabled={Boolean(action)}
                              onClick={() => setDeleteTarget(document)}
                            >
                              <Trash2 />
                            </D.DocumentAction>
                          </>
                        ) : null}
                      </D.DocumentActions>

                      {editing?.id === document.id ? (
                        <D.EditForm onSubmit={saveEdit}>
                          <D.Field>
                            <span>Nome do documento</span>
                            <D.Input
                              value={editTitle}
                              onChange={(event) =>
                                setEditTitle(event.target.value)
                              }
                              maxLength={140}
                              required
                            />
                          </D.Field>
                          <D.Field>
                            <span>Categoria</span>
                            <D.Select
                              value={editCategory}
                              onChange={(event) =>
                                setEditCategory(
                                  event.target
                                    .value as CongregationDocumentCategory,
                                )
                              }
                            >
                              {CONGREGATION_DOCUMENT_CATEGORIES.map(
                                (category) => (
                                  <option
                                    key={category.value}
                                    value={category.value}
                                  >
                                    {category.label}
                                  </option>
                                ),
                              )}
                            </D.Select>
                          </D.Field>
                          <D.EditActions>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditing(null)}
                            >
                              <X /> Cancelar
                            </Button>
                            <Button
                              type="submit"
                              size="sm"
                              loading={action === "edit"}
                            >
                              <Save /> Salvar
                            </Button>
                          </D.EditActions>
                        </D.EditForm>
                      ) : null}
                    </D.DocumentRow>
                  );
                })}
              </D.DocumentList>
            )}
          </D.DocumentsSection>
        </D.Content>
      </Modal>

      {deleteTarget ? (
        <Modal
          open
          title="Excluir documento"
          description="Confirme a exclusão permanente do arquivo."
          icon={<Trash2 />}
          size="sm"
          onClose={() => setDeleteTarget(null)}
          busy={busyAction?.kind === "delete"}
          footer={
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDeleteTarget(null)}
                disabled={busyAction?.kind === "delete"}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="danger"
                loading={busyAction?.kind === "delete"}
                onClick={() => void deleteDocument()}
              >
                <Trash2 /> Excluir documento
              </Button>
            </>
          }
        >
          <D.DeleteText>
            O documento <strong>{deleteTarget.title}</strong> será removido da
            Congregação e não poderá ser recuperado por esta tela.
          </D.DeleteText>
        </Modal>
      ) : null}
    </>
  );
}
