"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CreditCard,
  Download,
  Eye,
  File,
  FileText,
  FolderOpen,
  Image as ImageIcon,
  Loader2,
  MessageCircle,
  Paperclip,
  Pencil,
  Plus,
  Trash2,
  Upload,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Modal } from "@/components/ui/modal";
import { Toast, ToastViewport } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import * as D from "@/modules/organization/components/congregation-documents.styles";
import {
  addMemberHistoryNoteAction,
  getMemberDetailsAction,
  getMemberDocumentsAction,
  getMemberFinanceAction,
  getMemberHistoryAction,
  manageMemberRoleAction,
} from "../actions/member.actions";
import {
  cancelMemberDocumentUploadAction,
  deleteMemberDocumentAction,
  finalizeMemberDocumentUploadAction,
  getMemberDocumentUrlAction,
  prepareMemberDocumentUploadAction,
  updateMemberDocumentAction,
} from "../actions/member-document.actions";
import {
  getMemberDocumentTypeLabel,
  MEMBER_DOCUMENT_ACCEPT,
  MEMBER_DOCUMENT_BUCKET,
  MEMBER_DOCUMENT_MAX_SIZE,
  MEMBER_DOCUMENT_TYPES,
  type MemberDocumentType,
} from "../constants/member-documents";
import type {
  MemberCapabilities,
  MemberCoreDetails,
  MemberDocumentItem,
  MemberFilters,
  MemberFinanceItem,
  MemberHistoryItem,
  PaginatedTab,
} from "../types/member.types";
import {
  formatGender,
  formatMemberHistoryValue,
  formatMaritalStatus,
  memberRoleStatusLabels,
  memberStatusLabels,
  memberTypeLabels,
  receivedByLabels,
} from "../utils/member-formatters";
import * as M from "./members.styles";
import * as S from "./member-details.styles";

type Tab = "data" | "history" | "finance" | "documents";
type Notice = {
  title: string;
  description: string;
  variant: "success" | "danger" | "warning";
};
type DocumentBusy = {
  id: string;
  kind: "open" | "edit" | "delete";
} | null;

function date(value: string | null | undefined) {
  return value
    ? new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(
        new Date(`${value.slice(0, 10)}T12:00:00Z`),
      )
    : "Não informado";
}

function dateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatFileSize(value: number | null) {
  if (value == null) return "Tamanho não informado";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function documentTypeLabel(value: string) {
  return getMemberDocumentTypeLabel(value);
}

function validateBrowserFile(file: File | null) {
  if (!file) return "Selecione um arquivo.";
  if (file.size > MEMBER_DOCUMENT_MAX_SIZE) {
    return "O documento deve ter no máximo 10 MB.";
  }
  if (!/\.(pdf|jpe?g|png|webp)$/i.test(file.name)) {
    return "Formato não permitido. Envie PDF, JPG, PNG ou WebP.";
  }
  return null;
}

function whatsappUrl(value: string | null | undefined) {
  const digits = value?.replace(/\D/g, "") ?? "";
  if (/^55\d{10,11}$/.test(digits)) return `https://wa.me/${digits}`;
  if (/^\d{10,11}$/.test(digits)) return `https://wa.me/55${digits}`;
  return null;
}

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <S.Field>
      <dt>{label}</dt>
      <dd>{value || "Não informado"}</dd>
    </S.Field>
  );
}

function WhatsAppField({ value }: { value?: string | null }) {
  const url = whatsappUrl(value);
  return (
    <S.Field>
      <dt>WhatsApp</dt>
      <dd>
        <S.WhatsAppValue>
          <span>{value || "Não informado"}</span>
          {url && (
            <S.WhatsAppLink
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Abrir conversa no WhatsApp"
              title="Abrir conversa no WhatsApp"
            >
              <MessageCircle /> Abrir WhatsApp
            </S.WhatsAppLink>
          )}
        </S.WhatsAppValue>
      </dd>
    </S.Field>
  );
}

function HistoryChange({ item }: { item: MemberHistoryItem }) {
  if (!item.oldValue && !item.newValue) return null;
  const oldValue = formatMemberHistoryValue(item.oldValue);
  const newValue = formatMemberHistoryValue(item.newValue);
  return (
    <S.HistoryChange>
      {oldValue && <strong>{oldValue}</strong>}
      {oldValue && newValue && <ArrowRight />}
      {newValue && <strong>{newValue}</strong>}
    </S.HistoryChange>
  );
}

function DocumentIcon({ document }: { document: MemberDocumentItem }) {
  if (document.mimeType?.startsWith("image/")) return <ImageIcon />;
  if (document.mimeType === "application/pdf") return <FileText />;
  return <File />;
}

type Props = {
  memberId: string;
  capabilities: MemberCapabilities;
  filters: MemberFilters;
  onClose: () => void;
  onChanged: () => void;
};

export function MemberDetailsModal({
  memberId,
  capabilities,
  filters,
  onClose,
  onChanged,
}: Props) {
  const [supabase] = useState(() => createClient());
  const [details, setDetails] = useState<MemberCoreDetails | null>(null);
  const [loadError, setLoadError] = useState("");
  const [tab, setTab] = useState<Tab>("data");
  const [history, setHistory] =
    useState<PaginatedTab<MemberHistoryItem> | null>(null);
  const [finance, setFinance] =
    useState<PaginatedTab<MemberFinanceItem> | null>(null);
  const [documents, setDocuments] = useState<MemberDocumentItem[] | null>(null);
  const [tabLoading, setTabLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [documentBusy, setDocumentBusy] = useState<DocumentBusy>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editDocument, setEditDocument] =
    useState<MemberDocumentItem | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [replacementFile, setReplacementFile] = useState<File | null>(null);
  const [showHistoryForm, setShowHistoryForm] = useState(false);
  const [showRoleEditor, setShowRoleEditor] = useState(false);
  const [roleId, setRoleId] = useState("");
  const [roleStartDate, setRoleStartDate] = useState("");
  const [roleNotes, setRoleNotes] = useState("");
  const [roleSaved, setRoleSaved] = useState(false);

  useEffect(() => {
    let active = true;
    void getMemberDetailsAction(memberId).then((result) => {
      if (!active) return;
      if (result.success) setDetails(result.data);
      else setLoadError(result.message);
    });
    return () => {
      active = false;
    };
  }, [memberId]);

  async function refreshDetails() {
    const result = await getMemberDetailsAction(memberId);
    if (result.success) setDetails(result.data);
  }

  async function chooseTab(next: Tab) {
    setTab(next);
    if (
      next === "data" ||
      (next === "history" && history) ||
      (next === "finance" && finance) ||
      (next === "documents" && documents)
    ) {
      return;
    }
    setTabLoading(true);
    if (next === "history") {
      const result = await getMemberHistoryAction(memberId);
      if (result.success) setHistory(result.data);
      else
        setNotice({
          title: "Histórico indisponível",
          description: result.message,
          variant: "danger",
        });
    }
    if (next === "finance") {
      const result = await getMemberFinanceAction(memberId);
      if (result.success) setFinance(result.data);
      else
        setNotice({
          title: "Financeiro indisponível",
          description: result.message,
          variant: "danger",
        });
    }
    if (next === "documents") {
      const result = await getMemberDocumentsAction(memberId);
      if (result.success) setDocuments(result.data);
      else
        setNotice({
          title: "Documentos indisponíveis",
          description: result.message,
          variant: "danger",
        });
    }
    setTabLoading(false);
  }

  async function refreshDocuments() {
    const result = await getMemberDocumentsAction(memberId);
    if (result.success) setDocuments(result.data);
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fileError = validateBrowserFile(selectedFile);
    if (fileError || !selectedFile) {
      setNotice({
        title: selectedFile?.size && selectedFile.size > MEMBER_DOCUMENT_MAX_SIZE
          ? "Arquivo muito grande"
          : "Revise o documento",
        description: fileError ?? "Selecione um arquivo.",
        variant: "danger",
      });
      return;
    }

    setBusy(true);
    const form = event.currentTarget;
    const formData = new FormData(form);
    const metadata = {
      memberId,
      type: String(formData.get("type") ?? "OTHER") as MemberDocumentType,
      title: String(formData.get("title") ?? ""),
      description: String(formData.get("description") ?? ""),
      sensitive: formData.get("sensitive") === "true",
      originalFileName: selectedFile.name,
      fileSize: selectedFile.size,
    };
    let result: Awaited<ReturnType<typeof finalizeMemberDocumentUploadAction>>;
    let prepared: Awaited<ReturnType<typeof prepareMemberDocumentUploadAction>> | null = null;

    try {
      prepared = await prepareMemberDocumentUploadAction(metadata);
      if (!prepared.success) {
        result = prepared;
      } else if (!prepared.data) {
        result = {
          success: false,
          message: "Não foi possível preparar o envio do documento.",
        };
      } else {
        const { error: uploadError } = await supabase.storage
          .from(MEMBER_DOCUMENT_BUCKET)
          .uploadToSignedUrl(
            prepared.data.path,
            prepared.data.token,
            selectedFile,
            {
              cacheControl: "3600",
              contentType: prepared.data.contentType,
            },
          );
        if (uploadError) {
          await cancelMemberDocumentUploadAction({
            memberId,
            uploadId: prepared.data.uploadId,
            path: prepared.data.path,
            originalFileName: selectedFile.name,
            fileSize: selectedFile.size,
          });
          result = {
            success: false,
            message: "Não foi possível enviar o arquivo. Tente novamente.",
          };
        } else {
          result = await finalizeMemberDocumentUploadAction({
            ...metadata,
            uploadId: prepared.data.uploadId,
            path: prepared.data.path,
          });
        }
      }
    } catch (error) {
      console.error("[member-documents] browser upload failed", error);
      if (prepared?.success && prepared.data) {
        await cancelMemberDocumentUploadAction({
          memberId,
          uploadId: prepared.data.uploadId,
          path: prepared.data.path,
          originalFileName: selectedFile.name,
          fileSize: selectedFile.size,
        });
      }
      result = { success: false, message: "Não foi possível anexar o documento." };
    } finally {
      setBusy(false);
    }

    setNotice({
      title: result.success ? "Documento enviado" : "Falha no envio",
      description: result.message,
      variant: result.success ? "success" : "danger",
    });
    if (result.success) {
      form.reset();
      setSelectedFile(null);
      await refreshDocuments();
      onChanged();
    }
  }

  async function openDocument(document: MemberDocumentItem) {
    const previewWindow = window.open("", "_blank");
    if (previewWindow) {
      previewWindow.opener = null;
      previewWindow.document.title = "Abrindo documento...";
    }
    setDocumentBusy({ id: document.id, kind: "open" });
    const result = await getMemberDocumentUrlAction(document.id);
    setDocumentBusy(null);
    if (result.success && result.data) {
      if (previewWindow) previewWindow.location.replace(result.data.url);
      else window.location.assign(result.data.url);
      return;
    }
    previewWindow?.close();
    setNotice({
      title: "Documento indisponível",
      description: result.message,
      variant: "danger",
    });
  }

  async function removeDocument() {
    if (!deleteId) return;
    setDocumentBusy({ id: deleteId, kind: "delete" });
    const result = await deleteMemberDocumentAction(deleteId);
    setDocumentBusy(null);
    setDeleteId(null);
    setNotice({
      title: result.success
        ? "Documento excluído"
        : "Não foi possível excluir",
      description: result.message,
      variant: result.success ? "success" : "danger",
    });
    if (result.success) {
      await refreshDocuments();
      onChanged();
    }
  }

  async function updateDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editDocument) return;
    const fileError = replacementFile
      ? validateBrowserFile(replacementFile)
      : null;
    if (fileError) {
      setNotice({
        title: replacementFile && replacementFile.size > MEMBER_DOCUMENT_MAX_SIZE
          ? "Arquivo muito grande"
          : "Revise o documento",
        description: fileError,
        variant: "danger",
      });
      return;
    }

    setDocumentBusy({ id: editDocument.id, kind: "edit" });
    const form = new FormData(event.currentTarget);
    const metadata = {
      memberId,
      documentId: editDocument.id,
      type: String(form.get("type") ?? "OTHER") as MemberDocumentType,
      title: String(form.get("title") ?? ""),
      description: String(form.get("description") ?? ""),
      sensitive: form.get("sensitive") === "true",
    };
    let result: Awaited<ReturnType<typeof updateMemberDocumentAction>>;
    let prepared: Awaited<ReturnType<typeof prepareMemberDocumentUploadAction>> | null = null;

    try {
      if (!replacementFile) {
        result = await updateMemberDocumentAction(editDocument.id, metadata);
      } else {
        const prepareInput = {
          ...metadata,
          originalFileName: replacementFile.name,
          fileSize: replacementFile.size,
        };
        prepared = await prepareMemberDocumentUploadAction(prepareInput);
        if (!prepared.success) {
          result = prepared;
        } else if (!prepared.data) {
          result = {
            success: false,
            message: "Não foi possível preparar o envio do novo arquivo.",
          };
        } else {
          const { error: uploadError } = await supabase.storage
            .from(MEMBER_DOCUMENT_BUCKET)
            .uploadToSignedUrl(
              prepared.data.path,
              prepared.data.token,
              replacementFile,
              {
                cacheControl: "3600",
                contentType: prepared.data.contentType,
              },
            );
          if (uploadError) {
            await cancelMemberDocumentUploadAction({
              memberId,
              uploadId: prepared.data.uploadId,
              path: prepared.data.path,
              originalFileName: replacementFile.name,
              fileSize: replacementFile.size,
            });
            result = {
              success: false,
              message: "Não foi possível enviar o novo arquivo.",
            };
          } else {
            result = await finalizeMemberDocumentUploadAction({
              ...prepareInput,
              uploadId: prepared.data.uploadId,
              path: prepared.data.path,
            });
          }
        }
      }
    } catch (error) {
      console.error("[member-documents] browser update failed", error);
      if (prepared?.success && prepared.data && replacementFile) {
        await cancelMemberDocumentUploadAction({
          memberId,
          uploadId: prepared.data.uploadId,
          path: prepared.data.path,
          originalFileName: replacementFile.name,
          fileSize: replacementFile.size,
        });
      }
      result = { success: false, message: "Não foi possível atualizar o documento." };
    } finally {
      setDocumentBusy(null);
    }

    setNotice({
      title: result.success
        ? "Documento atualizado"
        : "Não foi possível atualizar",
      description: result.message,
      variant: result.success ? "success" : "danger",
    });
    if (result.success) {
      setEditDocument(null);
      setReplacementFile(null);
      await refreshDocuments();
      onChanged();
    }
  }

  async function addHistory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const result = await addMemberHistoryNoteAction({
      memberId,
      title: String(form.get("title") ?? ""),
      description: String(form.get("description") ?? ""),
      eventDate: String(form.get("eventDate") ?? ""),
      sensitive: form.get("sensitive") === "on",
    });
    setBusy(false);
    setNotice({
      title: result.success ? "Evento registrado" : "Falha ao registrar",
      description: result.message,
      variant: result.success ? "success" : "danger",
    });
    if (result.success) {
      setShowHistoryForm(false);
      const updated = await getMemberHistoryAction(memberId);
      if (updated.success) setHistory(updated.data);
    }
  }

  function openRoleEditor() {
    const currentRole = details?.roles.find((role) => role.status === "ACTIVE");
    setRoleId(currentRole?.roleId ?? "");
    setRoleStartDate(
      currentRole?.startDate ?? new Date().toISOString().slice(0, 10),
    );
    setRoleNotes(currentRole?.notes ?? "");
    setRoleSaved(false);
    setShowRoleEditor(true);
  }

  function changeSelectedRole(nextRoleId: string) {
    const currentRole = details?.roles.find((role) => role.status === "ACTIVE");
    setRoleId(nextRoleId);
    setRoleSaved(false);
    if (nextRoleId !== (currentRole?.roleId ?? "")) {
      setRoleStartDate(new Date().toISOString().slice(0, 10));
      setRoleNotes("");
    }
  }

  async function saveRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await manageMemberRoleAction({
        memberId,
        operation: "SET",
        roleId,
        startDate: roleStartDate,
        notes: roleNotes,
      });
      setNotice({
        title: result.success ? "Cargo atualizado" : "Falha ao atualizar Cargo",
        description: result.message,
        variant: result.success ? "success" : "danger",
      });
      if (result.success) {
        await refreshDetails();
        if (history) {
          const updatedHistory = await getMemberHistoryAction(memberId);
          if (updatedHistory.success) setHistory(updatedHistory.data);
        }
        setRoleSaved(true);
        onChanged();
      }
    } catch (error) {
      console.error("Erro ao atualizar Cargo do membro:", error);
      setNotice({
        title: "Falha ao atualizar Cargo",
        description: "Ocorreu um erro inesperado. Tente novamente.",
        variant: "danger",
      });
    } finally {
      setBusy(false);
    }
  }

  const deleteDocument = documents?.find((document) => document.id === deleteId);
  const footer =
    details && capabilities.update ? (
      <Link
        href={`/membros/${memberId}/editar`}
        className="app-button-primary"
      >
        <Pencil size={16} /> Editar cadastro
      </Link>
    ) : undefined;

  return (
    <>
      <Modal
        open
        title="Ficha do membro"
        description="Consulta cadastral, eclesiástica, financeira e documental."
        icon={<UserRound />}
        size="xl"
        onClose={onClose}
        footer={footer}
        busy={busy}
      >
        {!details && !loadError && (
          <S.Loading>
            <Loader2 />
          </S.Loading>
        )}
        {loadError && <S.Error>{loadError}</S.Error>}
        {details && (
          <>
            <S.HeaderCard>
              <S.Identity>
                <span>{initials(details.fullName)}</span>
                <div>
                  <h3>{details.fullName}</h3>
                  <p>
                    {details.memberCode || "Sem código"} ·{" "}
                    {details.congregationName}
                    {details.regionName ? ` · ${details.regionName}` : ""}
                  </p>
                </div>
              </S.Identity>
              <M.Status $status={details.memberStatus}>
                {memberStatusLabels[details.memberStatus]}
              </M.Status>
            </S.HeaderCard>
            <S.Tabs aria-label="Seções da ficha">
              <S.Tab
                $active={tab === "data"}
                onClick={() => void chooseTab("data")}
              >
                <UserRound /> Dados de cadastro
              </S.Tab>
              {capabilities.viewHistory && (
                <S.Tab
                  $active={tab === "history"}
                  onClick={() => void chooseTab("history")}
                >
                  <BookOpen /> Histórico eclesiástico
                </S.Tab>
              )}
              {capabilities.viewFinance && (
                <S.Tab
                  $active={tab === "finance"}
                  onClick={() => void chooseTab("finance")}
                >
                  <CreditCard /> Financeiro
                </S.Tab>
              )}
              {capabilities.viewDocuments && (
                <S.Tab
                  $active={tab === "documents"}
                  onClick={() => void chooseTab("documents")}
                >
                  <FolderOpen /> Documentos
                </S.Tab>
              )}
            </S.Tabs>

            {tabLoading && (
              <S.Loading>
                <Loader2 />
              </S.Loading>
            )}

            {!tabLoading && tab === "data" && (
              <S.Section>
                <h4>Identificação e vínculo</h4>
                <S.Grid>
                  <Field
                    label="Tipo"
                    value={memberTypeLabels[details.memberType]}
                  />
                  <Field
                    label="Situação"
                    value={memberStatusLabels[details.memberStatus]}
                  />
                  <Field label="Nascimento" value={date(details.birthDate)} />
                  <Field label="Sexo" value={formatGender(details.gender)} />
                  <Field
                    label="Estado civil"
                    value={formatMaritalStatus(
                      details.maritalStatus,
                      details.gender,
                    )}
                  />
                  <Field label="CPF" value={details.cpf} />
                  <Field
                    label="RG / órgão"
                    value={[details.rg, details.issuingAgency]
                      .filter(Boolean)
                      .join(" / ")}
                  />
                </S.Grid>

                <S.Divider />
                <h4>Contato, endereço e família</h4>
                <S.Grid>
                  <WhatsAppField value={details.whatsapp} />
                  <Field label="E-mail" value={details.email} />
                  <Field label="Endereço" value={details.address} />
                  <Field label="Pai" value={details.fatherName} />
                  <Field label="Mãe" value={details.motherName} />
                  <Field label="Cônjuge" value={details.spouseName} />
                </S.Grid>

                <S.Divider />
                <S.TabHeader>
                  <div>
                    <h4>Cargo</h4>
                    <p>Um único Cargo atual, com os vínculos anteriores preservados.</p>
                  </div>
                  {capabilities.manageRoles && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={openRoleEditor}
                    >
                      <Pencil size={14} /> Editar Cargo
                    </Button>
                  )}
                </S.TabHeader>
                {!details.roles.length ? (
                  <S.Empty>Nenhum Cargo vinculado ao membro.</S.Empty>
                ) : (
                  <S.Documents>
                    {details.roles.map((role) => (
                      <S.Document key={role.id}>
                        <div>
                          <h5>
                            {role.name}
                            {role.status === "ACTIVE" && (
                              <S.CurrentBadge>Atual</S.CurrentBadge>
                            )}
                          </h5>
                          <p>
                            {memberRoleStatusLabels[role.status] ?? role.status} ·{" "}
                            {date(role.startDate)}
                            {role.endDate ? ` até ${date(role.endDate)}` : ""}
                          </p>
                        </div>
                      </S.Document>
                    ))}
                  </S.Documents>
                )}

                <S.Divider />
                <h4>Histórico de fé</h4>
                <S.Grid>
                  <Field label="Conversão" value={date(details.conversionDate)} />
                  <Field
                    label="Batismo nas águas"
                    value={date(details.baptismDate)}
                  />
                  <Field label="Igreja do batismo" value={details.baptismChurch} />
                  <Field
                    label="Batismo com Espírito Santo"
                    value={
                      details.hasHolySpiritBaptism
                        ? date(details.holySpiritBaptismDate)
                        : "Não informado"
                    }
                  />
                  <Field
                    label="Recebido por"
                    value={
                      details.receivedBy
                        ? receivedByLabels[details.receivedBy]
                        : null
                    }
                  />
                  <Field
                    label="Data de recebimento"
                    value={date(details.receivedDate)}
                  />
                </S.Grid>
                {(details.notes || details.pastoralNotes) && (
                  <>
                    <S.Divider />
                    <h4>Observações</h4>
                    <S.Grid>
                      <Field label="Gerais" value={details.notes} />
                      <Field
                        label="Pastorais (restritas)"
                        value={details.pastoralNotes}
                      />
                    </S.Grid>
                  </>
                )}
              </S.Section>
            )}

            {!tabLoading && tab === "history" && (
              <S.Section>
                <S.TabHeader>
                  <div>
                    <h4>Linha do tempo</h4>
                    <p>{history?.total ?? 0} evento(s) visível(is).</p>
                  </div>
                  {capabilities.createHistory && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setShowHistoryForm((value) => !value)}
                    >
                      <Plus size={14} /> Adicionar evento
                    </Button>
                  )}
                </S.TabHeader>
                {showHistoryForm && (
                  <S.UploadForm onSubmit={addHistory}>
                    <S.FormField>
                      <span>Título *</span>
                      <S.FormControl name="title" required />
                    </S.FormField>
                    <S.FormField>
                      <span>Data *</span>
                      <S.FormControl
                        name="eventDate"
                        type="date"
                        required
                        max={new Date().toISOString().slice(0, 10)}
                      />
                    </S.FormField>
                    <S.FormField $span={2}>
                      <span>Descrição</span>
                      <S.FormControl name="description" />
                    </S.FormField>
                    <S.CheckField $span={2}>
                      <Checkbox
                        id="member-history-sensitive"
                        name="sensitive"
                        label="Evento sensível"
                      />
                    </S.CheckField>
                    <S.FormActions>
                      <Button type="submit" size="sm" loading={busy}>
                        Registrar
                      </Button>
                    </S.FormActions>
                  </S.UploadForm>
                )}
                {!history?.items.length ? (
                  <S.Empty>Nenhum evento encontrado.</S.Empty>
                ) : (
                  <S.Timeline>
                    {history.items.map((item) => (
                      <S.Event key={item.id}>
                        <article>
                          <S.TabHeader>
                            <h5>
                              {item.title}
                              {item.sensitive ? " · Restrito" : ""}
                            </h5>
                            <time>{date(item.eventDate)}</time>
                          </S.TabHeader>
                          <HistoryChange item={item} />
                          {item.description && <p>{item.description}</p>}
                        </article>
                      </S.Event>
                    ))}
                  </S.Timeline>
                )}
              </S.Section>
            )}

            {!tabLoading && tab === "finance" && (
              <S.Section>
                <S.TabHeader>
                  <div>
                    <h4>Histórico financeiro</h4>
                    <p>Consulta somente leitura dos lançamentos vinculados.</p>
                  </div>
                </S.TabHeader>
                <S.FinanceSummary>
                  <article>
                    <small>Total visível</small>
                    <strong>
                      {money(
                        finance?.items.reduce(
                          (sum, item) => sum + item.amount,
                          0,
                        ) ?? 0,
                      )}
                    </strong>
                  </article>
                  <article>
                    <small>Lançamentos</small>
                    <strong>{finance?.total ?? 0}</strong>
                  </article>
                </S.FinanceSummary>
                {!finance?.items.length ? (
                  <S.Empty>Nenhum lançamento vinculado ao membro.</S.Empty>
                ) : (
                  <S.SimpleTable>
                    <table>
                      <thead>
                        <tr>
                          <th>Data</th>
                          <th>Categoria</th>
                          <th>Descrição</th>
                          <th>Valor</th>
                          <th>Situação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {finance.items.map((item) => (
                          <tr key={item.id}>
                            <td>{date(item.transactionDate)}</td>
                            <td>{item.category}</td>
                            <td>
                              {item.description || item.transactionNumber || "—"}
                            </td>
                            <td>{money(item.amount)}</td>
                            <td>{item.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </S.SimpleTable>
                )}
              </S.Section>
            )}

            {!tabLoading && tab === "documents" && (
              <D.Content>
                {capabilities.manageDocuments && (
                  <D.UploadPanel>
                    <D.SectionHeading>
                      <div>
                        <h3>Anexar novo documento</h3>
                        <p>
                          O arquivo ficará privado e disponível somente para
                          usuários autorizados.
                        </p>
                      </div>
                    </D.SectionHeading>
                    <D.UploadForm onSubmit={upload}>
                      <D.FormGrid>
                        <D.Field>
                          <span>Nome do documento *</span>
                          <D.Input
                            name="title"
                            placeholder="Ex.: Certidão de casamento"
                            maxLength={140}
                            required
                            disabled={busy}
                          />
                        </D.Field>
                        <D.Field>
                          <span>Tipo *</span>
                          <D.Select name="type" defaultValue="OTHER" disabled={busy}>
                            {MEMBER_DOCUMENT_TYPES.map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </D.Select>
                        </D.Field>
                      </D.FormGrid>
                      <D.FileDrop>
                        <input
                          name="file"
                          type="file"
                          accept={MEMBER_DOCUMENT_ACCEPT}
                          required
                          disabled={busy}
                          onChange={(event) =>
                            setSelectedFile(event.target.files?.[0] ?? null)
                          }
                        />
                        <div>
                          <Upload />
                          <strong>Clique para selecionar o arquivo</strong>
                          <small>PDF, JPG, PNG ou WEBP · máximo de 10 MB</small>
                          {selectedFile && (
                            <D.SelectedFile>
                              <Paperclip /> {selectedFile.name} ·{" "}
                              {formatFileSize(selectedFile.size)}
                            </D.SelectedFile>
                          )}
                        </div>
                      </D.FileDrop>
                      <S.CheckField>
                        <Checkbox
                          id="member-document-sensitive"
                          name="sensitive"
                          value="true"
                          label="Documento sensível"
                        />
                      </S.CheckField>
                      <D.UploadFooter>
                        <small>
                          O nome original do arquivo será preservado para
                          consulta.
                        </small>
                        <Button type="submit" size="sm" loading={busy}>
                          <Upload /> {busy ? "Enviando..." : "Anexar documento"}
                        </Button>
                      </D.UploadFooter>
                    </D.UploadForm>
                  </D.UploadPanel>
                )}

                <D.DocumentsSection>
                  <D.SectionHeading>
                    <div>
                      <h3>Documentos anexados</h3>
                      <p>
                        Visualize os arquivos vinculados à ficha deste membro.
                      </p>
                    </div>
                    <D.CountBadge>{documents?.length ?? 0}</D.CountBadge>
                  </D.SectionHeading>
                  {!documents?.length ? (
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
                          documentBusy?.id === document.id
                            ? documentBusy.kind
                            : null;
                        return (
                          <D.DocumentRow key={document.id}>
                            <D.DocumentIcon
                              $image={Boolean(
                                document.mimeType?.startsWith("image/"),
                              )}
                            >
                              <DocumentIcon document={document} />
                            </D.DocumentIcon>
                            <D.DocumentInfo>
                              <strong title={document.title}>
                                {document.title}
                              </strong>
                              <span>
                                <span>{documentTypeLabel(document.type)}</span>
                                <span>{formatFileSize(document.fileSize)}</span>
                                <span>{dateTime(document.uploadedAt)}</span>
                                <span title={document.fileName}>
                                  {document.fileName}
                                </span>
                                {document.sensitive && <span>Restrito</span>}
                              </span>
                            </D.DocumentInfo>
                            <D.DocumentActions>
                              <D.DocumentAction
                                type="button"
                                title="Visualizar"
                                aria-label={`Visualizar ${document.title}`}
                                disabled={Boolean(action)}
                                data-loading={action === "open"}
                                onClick={() => void openDocument(document)}
                              >
                                {action === "open" ? (
                                  <Loader2 />
                                ) : document.mimeType === "application/pdf" ||
                                  document.mimeType?.startsWith("image/") ? (
                                  <Eye />
                                ) : (
                                  <Download />
                                )}
                              </D.DocumentAction>
                              {capabilities.manageDocuments && (
                                <>
                                  <D.DocumentAction
                                    type="button"
                                    title="Editar"
                                    aria-label={`Editar ${document.title}`}
                                    disabled={Boolean(action)}
                                    onClick={() => {
                                      setReplacementFile(null);
                                      setEditDocument(document);
                                    }}
                                  >
                                    <Pencil />
                                  </D.DocumentAction>
                                  <D.DocumentAction
                                    type="button"
                                    $danger
                                    title="Excluir"
                                    aria-label={`Excluir ${document.title}`}
                                    disabled={Boolean(action)}
                                    onClick={() => setDeleteId(document.id)}
                                  >
                                    <Trash2 />
                                  </D.DocumentAction>
                                </>
                              )}
                            </D.DocumentActions>
                          </D.DocumentRow>
                        );
                      })}
                    </D.DocumentList>
                  )}
                </D.DocumentsSection>
              </D.Content>
            )}
          </>
        )}
      </Modal>

      {showRoleEditor && details && (
        <Modal
          open
          title="Editar Cargo"
          description={details.fullName}
          icon={<Pencil />}
          size="sm"
          onClose={() => setShowRoleEditor(false)}
          busy={busy}
        >
          <S.RoleForm onSubmit={saveRole}>
            {roleSaved ? (
              <>
                <S.RoleSuccess role="status">
                  Cargo atualizado com sucesso. A ficha e o Histórico Eclesiástico já estão atualizados.
                </S.RoleSuccess>
                <S.FormActions>
                  <Button type="button" onClick={() => setShowRoleEditor(false)}>
                    Concluir
                  </Button>
                </S.FormActions>
              </>
            ) : (
              <>
                <S.RoleNotice>
                  Ao trocar o Cargo, o vínculo atual será encerrado e permanecerá
                  disponível no Histórico Eclesiástico.
                </S.RoleNotice>
                <S.FormField>
                  <span>Cargo</span>
                  <S.SelectControl
                    value={roleId}
                    onChange={(event) => changeSelectedRole(event.target.value)}
                  >
                    <option value="">Sem Cargo</option>
                    {filters.roles.map((role) => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </S.SelectControl>
                </S.FormField>
                {roleId && (
                  <S.FormField>
                    <span>Data de início</span>
                    <S.FormControl
                      type="date"
                      value={roleStartDate}
                      max={new Date().toISOString().slice(0, 10)}
                      onChange={(event) => setRoleStartDate(event.target.value)}
                    />
                  </S.FormField>
                )}
                <S.FormField>
                  <span>Observação</span>
                  <S.FormControl
                    value={roleNotes}
                    onChange={(event) => setRoleNotes(event.target.value)}
                    placeholder="Observação opcional"
                  />
                </S.FormField>
                <S.FormActions>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setShowRoleEditor(false)}
                    disabled={busy}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" loading={busy}>
                    Salvar Cargo
                  </Button>
                </S.FormActions>
              </>
            )}
          </S.RoleForm>
        </Modal>
      )}

      {deleteId && (
        <Modal
          open
          title="Excluir documento"
          description="Confirme a exclusão permanente do arquivo privado."
          icon={<Trash2 />}
          size="sm"
          onClose={() => setDeleteId(null)}
          busy={documentBusy?.kind === "delete"}
          footer={
            <>
              <Button
                variant="ghost"
                onClick={() => setDeleteId(null)}
                disabled={documentBusy?.kind === "delete"}
              >
                Cancelar
              </Button>
              <Button
                variant="danger"
                onClick={() => void removeDocument()}
                loading={documentBusy?.kind === "delete"}
              >
                <Trash2 /> Excluir documento
              </Button>
            </>
          }
        >
          <D.DeleteText>
            O documento <strong>{deleteDocument?.title}</strong> será removido
            da ficha e não poderá ser recuperado por esta tela.
          </D.DeleteText>
        </Modal>
      )}

      {editDocument && (
        <Modal
          open
          title="Editar documento"
          description="Atualize os dados ou substitua o arquivo privado."
          icon={<Pencil />}
          size="lg"
          onClose={() => setEditDocument(null)}
          busy={documentBusy?.kind === "edit"}
        >
          <D.Content>
            <D.UploadPanel>
              <D.UploadForm onSubmit={updateDocument}>
                <D.FormGrid>
                  <D.Field>
                    <span>Nome do documento *</span>
                    <D.Input
                      name="title"
                      required
                      defaultValue={editDocument.title}
                      maxLength={140}
                    />
                  </D.Field>
                  <D.Field>
                    <span>Tipo *</span>
                    <D.Select name="type" defaultValue={editDocument.type}>
                      {MEMBER_DOCUMENT_TYPES.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </D.Select>
                  </D.Field>
                </D.FormGrid>
                <D.FileDrop>
                  <input
                    name="file"
                    type="file"
                    accept={MEMBER_DOCUMENT_ACCEPT}
                    onChange={(event) =>
                      setReplacementFile(event.target.files?.[0] ?? null)
                    }
                  />
                  <div>
                    <Upload />
                    <strong>Selecionar um novo arquivo</strong>
                    <small>
                      Opcional · PDF, JPG, PNG ou WEBP · máximo de 10 MB
                    </small>
                    {replacementFile && (
                      <D.SelectedFile>
                        <Paperclip /> {replacementFile.name} ·{" "}
                        {formatFileSize(replacementFile.size)}
                      </D.SelectedFile>
                    )}
                  </div>
                </D.FileDrop>
                <S.CheckField>
                  <Checkbox
                    id="edit-member-document-sensitive"
                    name="sensitive"
                    value="true"
                    defaultChecked={editDocument.sensitive}
                    label="Documento sensível"
                  />
                </S.CheckField>
                <D.UploadFooter>
                  <small>
                    Se nenhum arquivo for escolhido, o arquivo atual será
                    mantido.
                  </small>
                  <Button
                    type="submit"
                    size="sm"
                    loading={documentBusy?.kind === "edit"}
                  >
                    Salvar alterações
                  </Button>
                </D.UploadFooter>
              </D.UploadForm>
            </D.UploadPanel>
          </D.Content>
        </Modal>
      )}

      {notice && (
        <ToastViewport>
          <Toast
            title={notice.title}
            description={notice.description}
            variant={notice.variant}
            onClose={() => setNotice(null)}
          />
        </ToastViewport>
      )}
    </>
  );
}
