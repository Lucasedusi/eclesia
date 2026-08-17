"use client";

import {
  type ChangeEvent,
  type FormEvent,
  Suspense,
  use,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import Image from "next/image";
import {
  AlertTriangle,
  Archive,
  ArchiveRestore,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  File,
  FileArchive,
  FileImage,
  FileSpreadsheet,
  FileText,
  Filter,
  Folder,
  FolderOpen,
  FolderPlus,
  HardDriveUpload,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Replace,
  Search,
  Settings2,
  Tags,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { Toast, ToastViewport } from "@/components/ui/toast";
import {
  cancelDocumentReplacementAction,
  cancelDocumentUploadsAction,
  changeAdministrativeDocumentStateAction,
  changeDocumentCategoryStateAction,
  changeDocumentFolderStateAction,
  createAdministrativeDocumentUrlAction,
  deleteUnusedDocumentTagAction,
  finalizeDocumentReplacementAction,
  finalizeDocumentUploadsAction,
  getDocumentWorkspaceAction,
  listAdministrativeDocumentsAction,
  prepareDocumentReplacementAction,
  prepareDocumentUploadsAction,
  saveDocumentCategoryAction,
  saveDocumentFolderAction,
  updateAdministrativeDocumentMetadataAction,
} from "../actions/document.actions";
import {
  ADMINISTRATIVE_DOCUMENT_ACCEPT,
  ADMINISTRATIVE_DOCUMENT_BUCKET,
  ADMINISTRATIVE_DOCUMENT_FORMAT_OPTIONS,
  ADMINISTRATIVE_DOCUMENT_MAX_FILES,
  ADMINISTRATIVE_DOCUMENT_MAX_SIZE,
  DOCUMENT_CATEGORY_COLORS,
} from "../constants/documents";
import type {
  AdministrativeDocumentItem,
  DocumentActionState,
  DocumentCategoryItem,
  DocumentFolderItem,
  DocumentListParams,
  DocumentStats,
  DocumentWorkspaceData,
} from "../types/document.types";
import * as S from "./documents.styles";

type Props = {
  initial: DocumentWorkspaceData;
  initialStats: Promise<DocumentStats>;
};

type Notice = {
  title: string;
  description: string;
  variant: "success" | "danger" | "warning";
};

type CategoryDraft = {
  id?: string;
  name: string;
  description: string;
  color: string;
};

type FolderDraft = {
  id?: string;
  categoryId: string;
  name: string;
  description: string;
  physicalLocation: string;
};

type UploadEntry = {
  clientId: string;
  file: globalThis.File;
  title: string;
};

type Confirmation = {
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  run: () => Promise<DocumentActionState>;
};

const statusLabels = {
  ACTIVE: "Ativo",
  ARCHIVED: "Arquivado",
  DELETED: "Na lixeira",
} as const;

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string | null, withTime = false) {
  if (!value) return "—";
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const parsedValue = dateOnly
    ? (() => {
        const [year, month, day] = value.split("-").map(Number);
        return new Date(year, month - 1, day, 12);
      })()
    : new Date(value);
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    ...(withTime ? { timeStyle: "short" as const } : {}),
    timeZone: "America/Sao_Paulo",
  }).format(parsedValue);
}

function titleFromFileName(name: string) {
  return name
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180) || "Documento";
}

function fileKind(document: Pick<AdministrativeDocumentItem, "mimeType" | "fileExtension">) {
  if (document.mimeType === "application/pdf") return "pdf" as const;
  if (document.mimeType.startsWith("image/")) return "image" as const;
  if (["xls", "xlsx"].includes(document.fileExtension)) return "sheet" as const;
  return "word" as const;
}

function DocumentIcon({ document }: { document: Pick<AdministrativeDocumentItem, "mimeType" | "fileExtension"> }) {
  const kind = fileKind(document);
  return (
    <S.FileIcon $kind={kind} aria-hidden="true">
      {kind === "pdf" ? <FileText /> : kind === "image" ? <FileImage /> : kind === "sheet" ? <FileSpreadsheet /> : <File />}
    </S.FileIcon>
  );
}

type DocumentStatsCardsProps = {
  stats: DocumentStats;
  state: DocumentListParams["state"];
  onStateChange: (state: DocumentListParams["state"]) => void;
  onOpenCategories: () => void;
  onOpenFolders: () => void;
};

function DocumentStatsCards({
  stats,
  state,
  onStateChange,
  onOpenCategories,
  onOpenFolders,
}: DocumentStatsCardsProps) {
  return (
    <S.Stats aria-label="Resumo do arquivo administrativo">
      <S.Stat $active={state === "ACTIVE"} $tone="success" onClick={() => onStateChange("ACTIVE")}><span><FileArchive size={18} /></span><div><strong>{stats.active}</strong><small>Documentos ativos</small></div></S.Stat>
      <S.Stat $active={state === "ARCHIVED"} $tone="warning" onClick={() => onStateChange("ARCHIVED")}><span><Archive size={18} /></span><div><strong>{stats.archived}</strong><small>Arquivados</small></div></S.Stat>
      <S.Stat $active={state === "DELETED"} $tone="danger" onClick={() => onStateChange("DELETED")}><span><Trash2 size={18} /></span><div><strong>{stats.deleted}</strong><small>Na lixeira</small></div></S.Stat>
      <S.Stat onClick={onOpenCategories}><span><FolderOpen size={18} /></span><div><strong>{stats.categories}</strong><small>Categorias ativas</small></div></S.Stat>
      <S.Stat onClick={onOpenFolders}><span><Folder size={18} /></span><div><strong>{stats.folders}</strong><small>Pastas ativas</small></div></S.Stat>
    </S.Stats>
  );
}

function StreamedDocumentStats({ promise, ...props }: Omit<DocumentStatsCardsProps, "stats"> & { promise: Promise<DocumentStats> }) {
  return <DocumentStatsCards stats={use(promise)} {...props} />;
}

function DocumentStatsLoading() {
  return <div className="app-skeleton-stats" aria-busy="true" aria-label="Carregando resumo dos documentos">{Array.from({ length: 5 }, (_, index) => <span key={index} className="app-skeleton-block app-skeleton-stat" />)}</div>;
}

export function DocumentManagement({ initial, initialStats }: Props) {
  const [data, setData] = useState(initial);
  const [useCurrentStats, setUseCurrentStats] = useState(false);
  const [params, setParams] = useState(initial.params);
  const [searchInput, setSearchInput] = useState(initial.params.search);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestId = useRef(0);

  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);
  const [managerTab, setManagerTab] = useState<"categories" | "tags">("categories");
  const [categoryDraft, setCategoryDraft] = useState<CategoryDraft | null>(null);
  const [folderManagerOpen, setFolderManagerOpen] = useState(false);
  const [folderDraft, setFolderDraft] = useState<FolderDraft | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFolderId, setUploadFolderId] = useState(initial.params.folderId);
  const [uploadFiles, setUploadFiles] = useState<UploadEntry[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedDocument, setSelectedDocument] = useState<AdministrativeDocumentItem | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [editingDocument, setEditingDocument] = useState<AdministrativeDocumentItem | null>(null);
  const [replacementDocument, setReplacementDocument] = useState<AdministrativeDocumentItem | null>(null);
  const [replacementFile, setReplacementFile] = useState<globalThis.File | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);

  useEffect(() => () => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    requestId.current += 1;
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 5500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const activeCategories = useMemo(
    () => data.categories.filter((item) => !item.deletedAt && item.status === "ACTIVE"),
    [data.categories],
  );
  const activeFolders = useMemo(
    () => data.folders.filter((item) =>
      !item.deletedAt &&
      item.status === "ACTIVE" &&
      (!params.categoryId || item.categoryId === params.categoryId)
    ),
    [data.folders, params.categoryId],
  );
  const selectedCategory = data.categories.find((item) => item.id === params.categoryId) ?? null;
  const selectedFolder = data.folders.find((item) => item.id === params.folderId) ?? null;
  const hasAdvancedFilters = Boolean(
    params.tagId || params.format || params.dateFrom || params.dateTo || params.uploadedBy,
  );

  function writeUrl(next: DocumentListParams) {
    const query = new URLSearchParams();
    if (next.page > 1) query.set("page", String(next.page));
    if (next.pageSize !== 20) query.set("pageSize", String(next.pageSize));
    if (next.search) query.set("search", next.search);
    if (next.categoryId) query.set("category", next.categoryId);
    if (next.folderId) query.set("folder", next.folderId);
    if (next.tagId) query.set("tag", next.tagId);
    if (next.format) query.set("format", next.format);
    if (next.state !== "ACTIVE") query.set("state", next.state.toLowerCase());
    if (next.dateFrom) query.set("from", next.dateFrom);
    if (next.dateTo) query.set("to", next.dateTo);
    if (next.uploadedBy) query.set("uploader", next.uploadedBy);
    if (next.sort !== "RECENT") query.set("sort", next.sort.toLowerCase());
    window.history.replaceState(null, "", query.size ? `/documentos?${query}` : "/documentos");
  }

  function loadDocuments(next: DocumentListParams) {
    const currentRequest = ++requestId.current;
    setParams(next);
    writeUrl(next);
    startTransition(async () => {
      const result = await listAdministrativeDocumentsAction(next);
      if (currentRequest !== requestId.current) return;
      if (result.status === "success") {
        setData((current) => ({ ...current, documents: result.data, params: next }));
      } else {
        setNotice({ title: "Listagem indisponível", description: result.message, variant: "danger" });
      }
    });
  }

  function changeParams(changes: Partial<DocumentListParams>) {
    const next = { ...params, ...changes, page: changes.page ?? 1 };
    if (changes.categoryId !== undefined) {
      const folderStillMatches = data.folders.some(
        (folder) => folder.id === next.folderId && folder.categoryId === changes.categoryId,
      );
      if (!folderStillMatches) next.folderId = "";
    }
    loadDocuments(next);
  }

  function handleSearch(event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    setSearchInput(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => changeParams({ search: value.trim() }), 400);
  }

  async function reloadAll(nextParams = params) {
    const result = await getDocumentWorkspaceAction(nextParams);
    if (result.status === "success") {
      setData(result.data);
      setUseCurrentStats(true);
      setParams(result.data.params);
      return true;
    }
    setNotice({ title: "Atualização incompleta", description: result.message, variant: "danger" });
    return false;
  }

  function showResult(result: DocumentActionState, successTitle = "Operação concluída") {
    setNotice({
      title: result.status === "success" ? successTitle : "Não foi possível concluir",
      description: result.message,
      variant: result.status === "success" ? "success" : "danger",
    });
  }

  async function runMutation(action: () => Promise<DocumentActionState>, after?: () => void) {
    setBusy(true);
    try {
      const result = await action();
      showResult(result);
      if (result.status === "success") {
        after?.();
        await reloadAll();
      }
      return result;
    } finally {
      setBusy(false);
    }
  }

  function openCategoryForm(category?: DocumentCategoryItem) {
    setCategoryDraft({
      id: category?.id,
      name: category?.name ?? "",
      description: category?.description ?? "",
      color: category?.color ?? DOCUMENT_CATEGORY_COLORS[0],
    });
  }

  async function submitCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!categoryDraft) return;
    const result = await runMutation(
      () => saveDocumentCategoryAction(categoryDraft),
      () => setCategoryDraft(null),
    );
    if (result.status === "error" && result.fieldErrors) {
      setNotice({ title: "Revise a categoria", description: Object.values(result.fieldErrors).flat()[0] ?? result.message, variant: "danger" });
    }
  }

  function openFolderForm(folder?: DocumentFolderItem) {
    const categoryId = folder?.categoryId || params.categoryId || activeCategories[0]?.id || "";
    setFolderDraft({
      id: folder?.id,
      categoryId,
      name: folder?.name ?? "",
      description: folder?.description ?? "",
      physicalLocation: folder?.physicalLocation ?? "",
    });
    setFolderManagerOpen(true);
  }

  async function submitFolder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!folderDraft) return;
    const categoryChanged = Boolean(
      folderDraft.id && data.folders.find((item) => item.id === folderDraft.id)?.categoryId !== folderDraft.categoryId,
    );
    const save = async () => runMutation(
      () => saveDocumentFolderAction(folderDraft),
      () => setFolderDraft(null),
    );
    if (categoryChanged) {
      setConfirmation({
        title: "Mover pasta para outra categoria?",
        description: "Os documentos continuarão preservados e passarão a aparecer na nova categoria.",
        confirmLabel: "Mover e salvar",
        run: async () => {
          const result = await save();
          return result;
        },
      });
      return;
    }
    await save();
  }

  function chooseFiles(files: FileList | null) {
    if (!files) return;
    const selected = Array.from(files).slice(0, ADMINISTRATIVE_DOCUMENT_MAX_FILES);
    const entries: UploadEntry[] = [];
    let errorMessage = "";
    for (const file of selected) {
      const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
      if (!ADMINISTRATIVE_DOCUMENT_ACCEPT.split(",").includes(`.${extension}`)) {
        errorMessage ||= `O formato de “${file.name}” não é permitido.`;
        continue;
      }
      if (file.size > ADMINISTRATIVE_DOCUMENT_MAX_SIZE || file.size <= 0) {
        errorMessage ||= `“${file.name}” deve ter no máximo 10 MB.`;
        continue;
      }
      entries.push({ clientId: crypto.randomUUID(), file, title: titleFromFileName(file.name) });
    }
    setUploadFiles(entries);
    if (errorMessage) setNotice({ title: "Arquivo rejeitado", description: errorMessage, variant: "danger" });
  }

  async function submitUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!uploadFolderId || uploadFiles.length === 0) {
      setNotice({ title: "Envio incompleto", description: "Selecione uma pasta e pelo menos um arquivo.", variant: "danger" });
      return;
    }
    setBusy(true);
    setUploadProgress(5);
    try {
      const prepared = await prepareDocumentUploadsAction({
        folderId: uploadFolderId,
        files: uploadFiles.map((entry) => ({
          clientId: entry.clientId,
          title: entry.title,
          originalFileName: entry.file.name,
          fileSize: entry.file.size,
        })),
      });
      if (prepared.status === "error") {
        setNotice({ title: "Não foi possível iniciar o envio", description: prepared.message, variant: "danger" });
        return;
      }

      const ready = prepared.files.filter(
        (item) => item.status === "success" && item.documentId && item.path && item.token && item.contentType,
      );
      const uploadedIds: string[] = [];
      const failedIds: string[] = [];
      let completed = 0;
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      await Promise.all(ready.map(async (item) => {
        const entry = uploadFiles.find((file) => file.clientId === item.clientId);
        if (!entry || !item.documentId || !item.path || !item.token || !item.contentType) return;
        const { error } = await supabase.storage
          .from(ADMINISTRATIVE_DOCUMENT_BUCKET)
          .uploadToSignedUrl(item.path, item.token, entry.file, {
            cacheControl: "3600",
            contentType: item.contentType,
          });
        if (error) failedIds.push(item.documentId);
        else uploadedIds.push(item.documentId);
        completed += 1;
        setUploadProgress(10 + Math.round((completed / Math.max(ready.length, 1)) * 65));
      }));

      if (failedIds.length) await cancelDocumentUploadsAction(failedIds);
      let finalized: UploadFinalizationResultLike[] = [];
      if (uploadedIds.length) {
        const confirmationResult = await finalizeDocumentUploadsAction(uploadedIds);
        if (confirmationResult.status === "success") finalized = confirmationResult.files;
        else finalized = uploadedIds.map((documentId) => ({ documentId, status: "error", message: confirmationResult.message }));
      }
      setUploadProgress(100);
      const successCount = finalized.filter((item) => item.status === "success").length;
      const failureCount = uploadFiles.length - successCount;
      setNotice({
        title: successCount ? "Envio concluído" : "Nenhum arquivo foi enviado",
        description: failureCount
          ? `${successCount} arquivo(s) enviado(s) e ${failureCount} com falha.`
          : `${successCount} arquivo(s) enviado(s) com sucesso.`,
        variant: successCount && failureCount ? "warning" : successCount ? "success" : "danger",
      });
      if (successCount) {
        setUploadOpen(false);
        setUploadFiles([]);
        setUploadProgress(0);
        await reloadAll({ ...params, folderId: uploadFolderId, categoryId: data.folders.find((item) => item.id === uploadFolderId)?.categoryId ?? params.categoryId, page: 1 });
      }
    } finally {
      setBusy(false);
    }
  }

  async function loadPreview(document: AdministrativeDocumentItem) {
    setSelectedDocument(document);
    setPreviewUrl("");
    if (document.effectiveStatus === "DELETED") return;
    if (!(document.mimeType === "application/pdf" || document.mimeType.startsWith("image/"))) return;
    setPreviewLoading(true);
    const result = await createAdministrativeDocumentUrlAction({ id: document.id, download: false });
    setPreviewLoading(false);
    if (result.status === "success") setPreviewUrl(result.url);
    else setNotice({ title: "Pré-visualização indisponível", description: result.message, variant: "danger" });
  }

  async function downloadDocument(document: AdministrativeDocumentItem) {
    setBusy(true);
    try {
      const result = await createAdministrativeDocumentUrlAction({ id: document.id, download: true });
      if (result.status === "error") {
        setNotice({ title: "Download indisponível", description: result.message, variant: "danger" });
        return;
      }
      const link = window.document.createElement("a");
      link.href = result.url;
      link.rel = "noopener noreferrer";
      link.click();
    } finally {
      setBusy(false);
    }
  }

  async function submitMetadata(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingDocument) return;
    const form = new FormData(event.currentTarget);
    await runMutation(
      () => updateAdministrativeDocumentMetadataAction({
        id: editingDocument.id,
        title: String(form.get("title") ?? ""),
        description: String(form.get("description") ?? ""),
        documentDate: String(form.get("documentDate") ?? ""),
        referenceNumber: String(form.get("referenceNumber") ?? ""),
        physicalLocation: String(form.get("physicalLocation") ?? ""),
        notes: String(form.get("notes") ?? ""),
        tagNames: String(form.get("tags") ?? "")
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      }),
      () => {
        setEditingDocument(null);
        setSelectedDocument(null);
      },
    );
  }

  async function submitReplacement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!replacementDocument || !replacementFile) return;
    setBusy(true);
    try {
      const prepared = await prepareDocumentReplacementAction({
        id: replacementDocument.id,
        originalFileName: replacementFile.name,
        fileSize: replacementFile.size,
      });
      if (prepared.status === "error" || !prepared.path || !prepared.token || !prepared.contentType) {
        setNotice({ title: "Substituição indisponível", description: prepared.message, variant: "danger" });
        return;
      }
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { error } = await supabase.storage
        .from(ADMINISTRATIVE_DOCUMENT_BUCKET)
        .uploadToSignedUrl(prepared.path, prepared.token, replacementFile, {
          cacheControl: "3600",
          contentType: prepared.contentType,
        });
      if (error) {
        await cancelDocumentReplacementAction(replacementDocument.id);
        setNotice({ title: "Falha no envio", description: "O arquivo atual foi preservado.", variant: "danger" });
        return;
      }
      const result = await finalizeDocumentReplacementAction(replacementDocument.id);
      showResult(result, "Arquivo substituído");
      if (result.status === "success") {
        setReplacementDocument(null);
        setReplacementFile(null);
        setSelectedDocument(null);
        await reloadAll();
      }
    } finally {
      setBusy(false);
    }
  }

  function confirmDocumentAction(
    document: AdministrativeDocumentItem,
    action: "ARCHIVE" | "RESTORE" | "TRASH" | "RESTORE_TRASH" | "DELETE_PERMANENTLY",
  ) {
    const content = {
      ARCHIVE: ["Arquivar documento?", "Ele deixará a listagem ativa, mas continuará preservado.", "Arquivar", false],
      RESTORE: ["Restaurar documento?", "O documento voltará à listagem ativa se sua pasta e categoria também estiverem ativas.", "Restaurar", false],
      TRASH: ["Enviar documento para a lixeira?", "O arquivo continuará preservado e poderá ser restaurado.", "Enviar para lixeira", true],
      RESTORE_TRASH: ["Restaurar documento da lixeira?", "Os metadados e o arquivo serão recuperados.", "Restaurar", false],
      DELETE_PERMANENTLY: ["Excluir documento definitivamente?", "Esta ação removerá o arquivo físico e não poderá ser desfeita.", "Excluir definitivamente", true],
    }[action] as [string, string, string, boolean];
    setConfirmation({
      title: content[0],
      description: content[1],
      confirmLabel: content[2],
      danger: content[3],
      run: () => changeAdministrativeDocumentStateAction({ id: document.id, action }),
    });
  }

  async function executeConfirmation() {
    if (!confirmation) return;
    setBusy(true);
    try {
      const result = await confirmation.run();
      showResult(result);
      if (result.status === "success") {
        setConfirmation(null);
        setSelectedDocument(null);
        await reloadAll();
      }
    } finally {
      setBusy(false);
    }
  }

  const pageStart = data.documents.total ? (data.documents.page - 1) * data.documents.pageSize + 1 : 0;
  const pageEnd = Math.min(data.documents.page * data.documents.pageSize, data.documents.total);

  return (
    <S.Module>
      <PageHeader
        title="Documentos"
        subtitle="Arquivo digital administrativo da igreja, organizado por categorias e dossiês."
        badge="Acesso administrativo"
        action={
          <S.HeaderActions>
            <Button variant="outline" onClick={() => setCategoryManagerOpen(true)}><Settings2 size={16} /> Categorias e tags</Button>
            <Button variant="outline" onClick={() => openFolderForm()} disabled={!activeCategories.length}><FolderPlus size={16} /> Nova pasta</Button>
            <Button onClick={() => {
              setUploadFolderId(params.folderId || activeFolders[0]?.id || "");
              setUploadOpen(true);
            }} disabled={!data.folders.some((item) => !item.deletedAt && item.status === "ACTIVE")}><Upload size={16} /> Enviar documentos</Button>
          </S.HeaderActions>
        }
      />

      <Suspense fallback={<DocumentStatsLoading />}>
        {useCurrentStats ? (
          <DocumentStatsCards
            stats={data.stats}
            state={params.state}
            onStateChange={(state) => changeParams({ state })}
            onOpenCategories={() => { setManagerTab("categories"); setCategoryManagerOpen(true); }}
            onOpenFolders={() => setFolderManagerOpen(true)}
          />
        ) : (
          <StreamedDocumentStats
            promise={initialStats}
            state={params.state}
            onStateChange={(state) => changeParams({ state })}
            onOpenCategories={() => { setManagerTab("categories"); setCategoryManagerOpen(true); }}
            onOpenFolders={() => setFolderManagerOpen(true)}
          />
        )}
      </Suspense>

      {!activeCategories.length ? (
        <S.Empty>
          <div><span><FileArchive size={24} /></span><h3>Comece criando a primeira categoria</h3><p>As categorias representam as divisões principais do arquivo, como Veículos, Imóveis, Contratos ou Compras.</p><Button onClick={() => { setCategoryManagerOpen(true); openCategoryForm(); }}><Plus size={16} /> Criar categoria</Button></div>
        </S.Empty>
      ) : (
        <S.Workspace>
          <S.CategoryRail>
            <S.RailHeading><div><strong>Categorias</strong><small>Classificação principal</small></div><S.TinyButton type="button" aria-label="Gerenciar categorias" onClick={() => setCategoryManagerOpen(true)}><Settings2 /></S.TinyButton></S.RailHeading>
            <S.RailList>
              <S.RailItem $active={!params.categoryId} onClick={() => changeParams({ categoryId: "", folderId: "" })}><S.RailIcon><FileArchive /></S.RailIcon><S.RailText><strong>Todos os documentos</strong><small>Arquivo administrativo</small></S.RailText></S.RailItem>
              {activeCategories.map((category) => (
                <S.RailItem key={category.id} $active={params.categoryId === category.id} onClick={() => changeParams({ categoryId: category.id, folderId: "" })}>
                  <S.RailIcon $color={category.color ?? undefined}><FolderOpen /></S.RailIcon>
                  <S.RailText><strong>{category.name}</strong><small>{category.description || "Sem descrição"}</small></S.RailText>
                  <S.RailCount>{data.folders.filter((folder) => !folder.deletedAt && folder.categoryId === category.id).length}</S.RailCount>
                </S.RailItem>
              ))}
            </S.RailList>
          </S.CategoryRail>

          <S.FolderRail>
            <S.RailHeading><div><strong>Pastas e dossiês</strong><small>{selectedCategory?.name ?? "Todas as categorias"}</small></div><S.ManagerActions><S.TinyButton type="button" aria-label="Criar pasta" onClick={() => openFolderForm()}><Plus /></S.TinyButton><S.TinyButton type="button" aria-label="Gerenciar pastas" onClick={() => setFolderManagerOpen(true)}><Settings2 /></S.TinyButton></S.ManagerActions></S.RailHeading>
            <S.RailList>
              <S.RailItem $active={!params.folderId} onClick={() => changeParams({ folderId: "" })}><S.RailIcon><FileArchive /></S.RailIcon><S.RailText><strong>Todas as pastas</strong><small>{selectedCategory ? `Em ${selectedCategory.name}` : "De todas as categorias"}</small></S.RailText></S.RailItem>
              {activeFolders.map((folder) => (
                <S.RailItem key={folder.id} $active={params.folderId === folder.id} onClick={() => changeParams({ categoryId: folder.categoryId, folderId: folder.id })}>
                  <S.RailIcon $color={data.categories.find((category) => category.id === folder.categoryId)?.color ?? undefined}><Folder /></S.RailIcon>
                  <S.RailText><strong>{folder.name}</strong><small>{folder.physicalLocation || folder.description || "Dossiê digital"}</small></S.RailText>
                </S.RailItem>
              ))}
            </S.RailList>
            {!activeFolders.length && <S.RailEmpty>Nenhuma pasta ativa neste contexto. Crie uma pasta para começar a enviar documentos.</S.RailEmpty>}
          </S.FolderRail>

          <S.Main>
            <S.Breadcrumb aria-label="Localização atual"><button onClick={() => changeParams({ categoryId: "", folderId: "" })}>Documentos</button>{selectedCategory && <><ChevronRight /><button onClick={() => changeParams({ categoryId: selectedCategory.id, folderId: "" })}>{selectedCategory.name}</button></>}{selectedFolder && <><ChevronRight /><strong>{selectedFolder.name}</strong></>}</S.Breadcrumb>
            <S.Toolbar>
              <S.SearchField><Search /><S.Input value={searchInput} onChange={handleSearch} placeholder="Pesquisar título, referência, pasta, categoria ou tag..." aria-label="Pesquisar documentos" />{searchInput && <button type="button" aria-label="Limpar pesquisa" onClick={() => { setSearchInput(""); changeParams({ search: "" }); }}><X size={13} /></button>}</S.SearchField>
              <S.Select value={params.state} onChange={(event) => changeParams({ state: event.target.value as DocumentListParams["state"] })} aria-label="Situação"><option value="ACTIVE">Documentos ativos</option><option value="ARCHIVED">Arquivados</option><option value="DELETED">Lixeira</option></S.Select>
              <S.Select value={params.sort} onChange={(event) => changeParams({ sort: event.target.value as DocumentListParams["sort"] })} aria-label="Ordenação"><option value="RECENT">Mais recentes</option><option value="OLDEST">Mais antigos</option><option value="TITLE_ASC">Título A–Z</option><option value="SIZE_DESC">Maior tamanho</option><option value="SIZE_ASC">Menor tamanho</option></S.Select>
              <S.FilterButton type="button" $active={filtersOpen || hasAdvancedFilters} onClick={() => setFiltersOpen((value) => !value)}><Filter /> Filtros</S.FilterButton>
            </S.Toolbar>
            <S.Filters $open={filtersOpen}>
              <S.Field><span>Tag</span><S.Select value={params.tagId} onChange={(event) => changeParams({ tagId: event.target.value })}><option value="">Todas as tags</option>{data.tags.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}</S.Select></S.Field>
              <S.Field><span>Formato</span><S.Select value={params.format} onChange={(event) => changeParams({ format: event.target.value })}>{ADMINISTRATIVE_DOCUMENT_FORMAT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</S.Select></S.Field>
              <S.Field><span>Enviado por</span><S.Select value={params.uploadedBy} onChange={(event) => changeParams({ uploadedBy: event.target.value })}><option value="">Todos os usuários</option>{data.uploaders.map((uploader) => <option key={uploader.id} value={uploader.id}>{uploader.name}</option>)}</S.Select></S.Field>
              <S.Field><span>Itens por página</span><S.Select value={params.pageSize} onChange={(event) => changeParams({ pageSize: Number(event.target.value) })}><option value="10">10 por página</option><option value="20">20 por página</option><option value="50">50 por página</option></S.Select></S.Field>
              <S.Field><span>Incluído a partir de</span><S.Input type="date" value={params.dateFrom} onChange={(event) => changeParams({ dateFrom: event.target.value })} /></S.Field>
              <S.Field><span>Incluído até</span><S.Input type="date" value={params.dateTo} onChange={(event) => changeParams({ dateTo: event.target.value })} /></S.Field>
              <S.SpanAll><Button variant="ghost" size="sm" onClick={() => changeParams({ tagId: "", format: "", uploadedBy: "", dateFrom: "", dateTo: "" })}>Limpar filtros avançados</Button></S.SpanAll>
            </S.Filters>
            <S.ListHeader><strong>{selectedFolder?.name ?? selectedCategory?.name ?? "Documentos administrativos"}</strong><span>{data.documents.total} registro(s)</span></S.ListHeader>
            {data.documents.items.length ? (
              <>
                <S.TableWrap>
                  {pending && <S.BusyOverlay><Loader2 aria-label="Atualizando documentos" /></S.BusyOverlay>}
                  <S.Table>
                    <thead><tr><th>Documento</th><th>Categoria / pasta</th><th>Tags</th><th>Responsável</th><th>Inclusão</th><th>Tamanho</th><th>Situação</th><th aria-label="Ações" /></tr></thead>
                    <tbody>{data.documents.items.map((document) => (
                      <tr key={document.id}>
                        <td><S.DocumentCell><DocumentIcon document={document} /><div><strong>{document.title}</strong><small>{document.originalFileName}</small></div></S.DocumentCell></td>
                        <td><S.PathCell><strong>{document.categoryName}</strong><small>{document.folderName}</small></S.PathCell></td>
                        <td><S.Tags>{document.tags.slice(0, 2).map((tag) => <S.Tag key={tag.id}>{tag.name}</S.Tag>)}{document.tags.length > 2 && <S.Tag>+{document.tags.length - 2}</S.Tag>}{!document.tags.length && <span>—</span>}</S.Tags></td>
                        <td>{document.uploadedByName}</td><td>{formatDate(document.uploadedAt, true)}</td><td>{formatBytes(document.fileSize)}</td><td><S.Status $status={document.effectiveStatus}>{statusLabels[document.effectiveStatus]}</S.Status></td>
                        <td><S.RowActions>
                          <S.IconButton type="button" title="Ver detalhes" aria-label={`Ver ${document.title}`} onClick={() => void loadPreview(document)}><Eye /></S.IconButton>
                          {document.effectiveStatus !== "DELETED" && <S.IconButton type="button" title="Baixar" aria-label={`Baixar ${document.title}`} onClick={() => void downloadDocument(document)}><Download /></S.IconButton>}
                          {document.effectiveStatus === "ACTIVE" && <><S.IconButton type="button" title="Editar metadados" onClick={() => setEditingDocument(document)}><Pencil /></S.IconButton><S.IconButton type="button" title="Substituir arquivo" onClick={() => { setReplacementDocument(document); setReplacementFile(null); }}><Replace /></S.IconButton><S.IconButton type="button" title="Arquivar" onClick={() => confirmDocumentAction(document, "ARCHIVE")}><Archive /></S.IconButton><S.IconButton type="button" $danger title="Enviar para lixeira" onClick={() => confirmDocumentAction(document, "TRASH")}><Trash2 /></S.IconButton></>}
                          {document.effectiveStatus === "ARCHIVED" && <><S.IconButton type="button" title="Restaurar" onClick={() => confirmDocumentAction(document, "RESTORE")}><ArchiveRestore /></S.IconButton><S.IconButton type="button" $danger title="Enviar para lixeira" onClick={() => confirmDocumentAction(document, "TRASH")}><Trash2 /></S.IconButton></>}
                          {document.effectiveStatus === "DELETED" && <><S.IconButton type="button" title="Restaurar da lixeira" onClick={() => confirmDocumentAction(document, "RESTORE_TRASH")}><RefreshCw /></S.IconButton><S.IconButton type="button" $danger title="Excluir definitivamente" onClick={() => confirmDocumentAction(document, "DELETE_PERMANENTLY")}><Trash2 /></S.IconButton></>}
                        </S.RowActions></td>
                      </tr>
                    ))}</tbody>
                  </S.Table>
                </S.TableWrap>
                <S.Pagination><span>Exibindo {pageStart}–{pageEnd} de {data.documents.total}</span><div><Button size="sm" variant="outline" disabled={data.documents.page <= 1 || pending} onClick={() => changeParams({ page: data.documents.page - 1 })}><ChevronLeft size={14} /> Anterior</Button><Button size="sm" variant="outline" disabled={data.documents.page >= data.documents.pageCount || pending} onClick={() => changeParams({ page: data.documents.page + 1 })}>Próxima <ChevronRight size={14} /></Button></div></S.Pagination>
              </>
            ) : (
              <S.Empty><div><span>{params.state === "DELETED" ? <Trash2 size={23} /> : params.state === "ARCHIVED" ? <Archive size={23} /> : <FileArchive size={23} />}</span><h3>{params.state === "DELETED" ? "A lixeira está vazia" : params.state === "ARCHIVED" ? "Nenhum documento arquivado" : "Nenhum documento encontrado"}</h3><p>{params.search || hasAdvancedFilters ? "Revise a pesquisa ou limpe os filtros aplicados." : selectedFolder ? "Envie o primeiro arquivo para esta pasta." : "Selecione uma pasta ou envie um novo documento."}</p>{params.state === "ACTIVE" && <Button onClick={() => { setUploadFolderId(params.folderId || activeFolders[0]?.id || ""); setUploadOpen(true); }} disabled={!activeFolders.length}><Upload size={16} /> Enviar documento</Button>}</div></S.Empty>
            )}
          </S.Main>
        </S.Workspace>
      )}

      {categoryManagerOpen && (
        <Modal title={categoryDraft ? (categoryDraft.id ? "Editar categoria" : "Nova categoria") : "Categorias e tags"} description="Organize o catálogo administrativo da igreja" icon={categoryDraft ? <FolderOpen /> : <Settings2 />} size="lg" onClose={() => { if (!busy) { setCategoryManagerOpen(false); setCategoryDraft(null); } }} busy={busy}>
          <S.ModalContent>
            {categoryDraft ? (
              <form onSubmit={submitCategory}><S.ModalContent><S.FormGrid><S.Field><span>Nome *</span><S.Input autoFocus value={categoryDraft.name} onChange={(event) => setCategoryDraft({ ...categoryDraft, name: event.target.value })} placeholder="Ex.: Veículos" required /></S.Field><S.Field><span>Cor de identificação</span><S.ColorGrid>{DOCUMENT_CATEGORY_COLORS.map((color) => <S.ColorButton key={color} type="button" $color={color} $active={categoryDraft.color === color} aria-label={`Usar cor ${color}`} onClick={() => setCategoryDraft({ ...categoryDraft, color })} />)}</S.ColorGrid></S.Field><S.SpanAll><S.Field><span>Descrição</span><S.Textarea value={categoryDraft.description} onChange={(event) => setCategoryDraft({ ...categoryDraft, description: event.target.value })} placeholder="Descreva o tipo de documento desta categoria" /></S.Field></S.SpanAll></S.FormGrid><S.ModalFooter><Button variant="outline" onClick={() => setCategoryDraft(null)}>Voltar</Button><Button type="submit" loading={busy}>{categoryDraft.id ? "Salvar alterações" : "Criar categoria"}</Button></S.ModalFooter></S.ModalContent></form>
            ) : (
              <><S.ManagerToolbar><S.Segmented><button type="button" data-active={managerTab === "categories"} onClick={() => setManagerTab("categories")}>Categorias</button><button type="button" data-active={managerTab === "tags"} onClick={() => setManagerTab("tags")}>Tags</button></S.Segmented>{managerTab === "categories" && <Button size="sm" onClick={() => openCategoryForm()}><Plus size={14} /> Nova categoria</Button>}</S.ManagerToolbar>
              <S.ManagerList>{managerTab === "categories" ? data.categories.map((category) => (
                <S.ManagerItem key={category.id}><S.RailIcon $color={category.color ?? undefined}><FolderOpen /></S.RailIcon><div><strong>{category.name}</strong><p>{category.deletedAt ? "Na lixeira" : category.status === "ARCHIVED" ? "Arquivada" : category.description || "Categoria ativa"}</p></div><S.ManagerActions>{!category.deletedAt && <S.IconButton type="button" title="Editar" onClick={() => openCategoryForm(category)}><Pencil /></S.IconButton>}{!category.deletedAt && category.status === "ACTIVE" && <S.IconButton type="button" title="Arquivar" onClick={() => setConfirmation({ title: "Arquivar categoria?", description: "Suas pastas e documentos deixarão as listagens ativas, sem serem apagados.", confirmLabel: "Arquivar", run: () => changeDocumentCategoryStateAction({ id: category.id, action: "ARCHIVE" }) })}><Archive /></S.IconButton>}{!category.deletedAt && category.status === "ARCHIVED" && <S.IconButton type="button" title="Restaurar" onClick={() => setConfirmation({ title: "Restaurar categoria?", description: "A categoria e seu conteúdo preservado voltarão a ficar disponíveis.", confirmLabel: "Restaurar", run: () => changeDocumentCategoryStateAction({ id: category.id, action: "RESTORE" }) })}><ArchiveRestore /></S.IconButton>}{!category.deletedAt && <S.IconButton type="button" $danger title="Excluir categoria vazia" onClick={() => setConfirmation({ title: "Excluir categoria?", description: "A exclusão só será permitida se não houver nenhuma pasta vinculada.", confirmLabel: "Excluir", danger: true, run: () => changeDocumentCategoryStateAction({ id: category.id, action: "DELETE" }) })}><Trash2 /></S.IconButton>}{category.deletedAt && <S.IconButton type="button" title="Recuperar categoria" onClick={() => setConfirmation({ title: "Recuperar categoria?", description: "A categoria voltará ao catálogo administrativo.", confirmLabel: "Recuperar", run: () => changeDocumentCategoryStateAction({ id: category.id, action: "RESTORE_DELETED" }) })}><RefreshCw /></S.IconButton>}</S.ManagerActions></S.ManagerItem>
              )) : data.tags.length ? data.tags.map((tag) => <S.ManagerItem key={tag.id}><S.RailIcon><Tags /></S.RailIcon><div><strong>{tag.name}</strong><p>Classificação complementar</p></div><S.ManagerActions><S.IconButton type="button" $danger title="Excluir tag não utilizada" onClick={() => setConfirmation({ title: "Excluir tag?", description: "A exclusão será permitida somente se a tag não estiver associada a nenhum documento.", confirmLabel: "Excluir tag", danger: true, run: () => deleteUnusedDocumentTagAction(tag.id) })}><Trash2 /></S.IconButton></S.ManagerActions></S.ManagerItem>) : <S.RailEmpty>As tags são criadas ao editar os metadados de um documento.</S.RailEmpty>}</S.ManagerList></>
            )}
          </S.ModalContent>
        </Modal>
      )}

      {folderManagerOpen && (
        <Modal title={folderDraft ? (folderDraft.id ? "Editar pasta ou dossiê" : "Nova pasta ou dossiê") : "Gerenciar pastas e dossiês"} description="Cada pasta pertence a uma única categoria" icon={<Folder />} size="lg" onClose={() => { if (!busy) { setFolderManagerOpen(false); setFolderDraft(null); } }} busy={busy}>
          <S.ModalContent>{folderDraft ? <form onSubmit={submitFolder}><S.ModalContent><S.FormGrid><S.Field><span>Categoria *</span><S.Select value={folderDraft.categoryId} onChange={(event) => setFolderDraft({ ...folderDraft, categoryId: event.target.value })} required><option value="">Selecione</option>{activeCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</S.Select></S.Field><S.Field><span>Nome da pasta *</span><S.Input autoFocus value={folderDraft.name} onChange={(event) => setFolderDraft({ ...folderDraft, name: event.target.value })} placeholder="Ex.: SW4 Preta — Carro Pastoral" required /></S.Field><S.SpanAll><S.Field><span>Descrição</span><S.Textarea value={folderDraft.description} onChange={(event) => setFolderDraft({ ...folderDraft, description: event.target.value })} placeholder="Assunto, bem, processo ou conjunto de documentos" /></S.Field></S.SpanAll><S.SpanAll><S.Field><span>Localização física</span><S.Input value={folderDraft.physicalLocation} onChange={(event) => setFolderDraft({ ...folderDraft, physicalLocation: event.target.value })} placeholder="Ex.: Armário 02 — Gaveta Veículos" /></S.Field></S.SpanAll></S.FormGrid><S.ModalFooter><Button variant="outline" onClick={() => setFolderDraft(null)}>Voltar</Button><Button type="submit" loading={busy}>{folderDraft.id ? "Salvar alterações" : "Criar pasta"}</Button></S.ModalFooter></S.ModalContent></form> : <><S.ManagerToolbar><span /><Button size="sm" onClick={() => openFolderForm()}><Plus size={14} /> Nova pasta</Button></S.ManagerToolbar><S.ManagerList>{data.folders.map((folder) => { const category = data.categories.find((item) => item.id === folder.categoryId); return <S.ManagerItem key={folder.id}><S.RailIcon $color={category?.color ?? undefined}><Folder /></S.RailIcon><div><strong>{folder.name}</strong><p>{category?.name ?? "Categoria indisponível"} · {folder.deletedAt ? "Na lixeira" : folder.status === "ARCHIVED" ? "Arquivada" : folder.physicalLocation || "Pasta ativa"}</p></div><S.ManagerActions>{!folder.deletedAt && <S.IconButton title="Editar" onClick={() => openFolderForm(folder)}><Pencil /></S.IconButton>}{!folder.deletedAt && folder.status === "ACTIVE" && <S.IconButton title="Arquivar" onClick={() => setConfirmation({ title: "Arquivar pasta?", description: "Os documentos continuarão preservados, mas deixarão a listagem ativa.", confirmLabel: "Arquivar", run: () => changeDocumentFolderStateAction({ id: folder.id, action: "ARCHIVE" }) })}><Archive /></S.IconButton>}{!folder.deletedAt && folder.status === "ARCHIVED" && <S.IconButton title="Restaurar" onClick={() => setConfirmation({ title: "Restaurar pasta?", description: "A pasta e seus documentos preservados voltarão a ficar disponíveis.", confirmLabel: "Restaurar", run: () => changeDocumentFolderStateAction({ id: folder.id, action: "RESTORE" }) })}><ArchiveRestore /></S.IconButton>}{!folder.deletedAt && <S.IconButton $danger title="Excluir pasta vazia" onClick={() => setConfirmation({ title: "Excluir pasta?", description: "A exclusão só será permitida se não houver documentos vinculados.", confirmLabel: "Excluir", danger: true, run: () => changeDocumentFolderStateAction({ id: folder.id, action: "DELETE" }) })}><Trash2 /></S.IconButton>}{folder.deletedAt && <S.IconButton title="Recuperar pasta" onClick={() => setConfirmation({ title: "Recuperar pasta?", description: "A pasta voltará ao catálogo administrativo.", confirmLabel: "Recuperar", run: () => changeDocumentFolderStateAction({ id: folder.id, action: "RESTORE_DELETED" }) })}><RefreshCw /></S.IconButton>}</S.ManagerActions></S.ManagerItem>; })}</S.ManagerList></>}</S.ModalContent>
        </Modal>
      )}

      {uploadOpen && (
        <Modal title="Enviar documentos" description="Envie um ou vários arquivos para a mesma pasta" icon={<HardDriveUpload />} size="lg" onClose={() => { if (!busy) { setUploadOpen(false); setUploadFiles([]); setUploadProgress(0); } }} busy={busy}>
          <form onSubmit={submitUpload}><S.ModalContent><S.Field><span>Pasta ou dossiê *</span><S.Select value={uploadFolderId} onChange={(event) => setUploadFolderId(event.target.value)} required><option value="">Selecione uma pasta</option>{data.folders.filter((folder) => !folder.deletedAt && folder.status === "ACTIVE" && data.categories.some((category) => category.id === folder.categoryId && !category.deletedAt && category.status === "ACTIVE")).map((folder) => <option key={folder.id} value={folder.id}>{data.categories.find((category) => category.id === folder.categoryId)?.name} — {folder.name}</option>)}</S.Select></S.Field><S.DropZone><input type="file" multiple accept={ADMINISTRATIVE_DOCUMENT_ACCEPT} onChange={(event) => chooseFiles(event.target.files)} disabled={busy} /><div><Upload /><strong>Selecione ou arraste os arquivos</strong><small>PDF, JPG, PNG, WEBP, DOC, DOCX, XLS ou XLSX. Até 10 MB por arquivo e no máximo {ADMINISTRATIVE_DOCUMENT_MAX_FILES} arquivos por envio.</small></div></S.DropZone>{uploadFiles.length > 0 && <S.UploadList>{uploadFiles.map((entry) => <S.UploadItem key={entry.clientId}><DocumentIcon document={{ mimeType: entry.file.type || "application/octet-stream", fileExtension: entry.file.name.split(".").pop()?.toLowerCase() ?? "" }} /><div><S.Input value={entry.title} onChange={(event) => setUploadFiles((current) => current.map((item) => item.clientId === entry.clientId ? { ...item, title: event.target.value } : item))} aria-label={`Título de ${entry.file.name}`} required /><small>{entry.file.name} · {formatBytes(entry.file.size)}</small></div><S.IconButton type="button" aria-label={`Remover ${entry.file.name}`} onClick={() => setUploadFiles((current) => current.filter((item) => item.clientId !== entry.clientId))}><X /></S.IconButton></S.UploadItem>)}</S.UploadList>}{busy && uploadProgress > 0 && <S.Progress aria-label={`Envio ${uploadProgress}%`}><span style={{ width: `${uploadProgress}%` }} /></S.Progress>}<S.ModalFooter><Button variant="outline" onClick={() => { setUploadOpen(false); setUploadFiles([]); }} disabled={busy}>Cancelar</Button><Button type="submit" loading={busy} disabled={!uploadFolderId || !uploadFiles.length}>Enviar {uploadFiles.length ? `${uploadFiles.length} arquivo(s)` : "documentos"}</Button></S.ModalFooter></S.ModalContent></form>
        </Modal>
      )}

      {selectedDocument && (
        <Modal title={selectedDocument.title} description={`${selectedDocument.categoryName} › ${selectedDocument.folderName}`} icon={<FileText />} size="xl" onClose={() => { if (!busy) { setSelectedDocument(null); setPreviewUrl(""); } }} busy={busy}>
          <S.ModalContent>{selectedDocument.mimeType === "application/pdf" || selectedDocument.mimeType.startsWith("image/") ? <S.Preview>{previewLoading ? <div><Loader2 className="animate-spin" /> Preparando visualização segura...</div> : previewUrl ? selectedDocument.mimeType === "application/pdf" ? <iframe src={previewUrl} title={`Pré-visualização de ${selectedDocument.title}`} /> : <Image src={previewUrl} alt={`Pré-visualização de ${selectedDocument.title}`} width={900} height={600} unoptimized /> : <div>Pré-visualização indisponível.</div>}</S.Preview> : <S.Preview><div><File size={35} />Este formato não possui pré-visualização. Utilize o download para abrir o arquivo.</div></S.Preview>}<S.DetailGrid><div><dt>Arquivo original</dt><dd>{selectedDocument.originalFileName}</dd></div><div><dt>Formato e tamanho</dt><dd>{selectedDocument.fileExtension.toUpperCase()} · {formatBytes(selectedDocument.fileSize)}</dd></div><div><dt>Situação</dt><dd>{statusLabels[selectedDocument.effectiveStatus]}</dd></div><div><dt>Data do documento</dt><dd>{formatDate(selectedDocument.documentDate)}</dd></div><div><dt>Número / referência</dt><dd>{selectedDocument.referenceNumber || "—"}</dd></div><div><dt>Enviado por</dt><dd>{selectedDocument.uploadedByName}<br />{formatDate(selectedDocument.uploadedAt, true)}</dd></div><div><dt>Localização física</dt><dd>{selectedDocument.physicalLocation || "—"}</dd></div><div><dt>Tags</dt><dd>{selectedDocument.tags.map((tag) => tag.name).join(", ") || "—"}</dd></div><div><dt>Última alteração</dt><dd>{formatDate(selectedDocument.updatedAt, true)}</dd></div>{selectedDocument.description && <div><dt>Descrição</dt><dd>{selectedDocument.description}</dd></div>}{selectedDocument.notes && <div><dt>Observações</dt><dd>{selectedDocument.notes}</dd></div>}</S.DetailGrid><S.ModalFooter><Button variant="outline" onClick={() => setSelectedDocument(null)}>Fechar</Button>{selectedDocument.effectiveStatus !== "DELETED" && <><Button variant="outline" onClick={() => void downloadDocument(selectedDocument)} loading={busy}><Download size={15} /> Baixar</Button><Button onClick={() => { setEditingDocument(selectedDocument); setSelectedDocument(null); }}><Pencil size={15} /> Editar metadados</Button></>}</S.ModalFooter></S.ModalContent>
        </Modal>
      )}

      {editingDocument && (
        <Modal title="Editar metadados" description={editingDocument.originalFileName} icon={<Pencil />} size="lg" onClose={() => { if (!busy) setEditingDocument(null); }} busy={busy}>
          <form onSubmit={submitMetadata}><S.ModalContent><S.FormGrid><S.Field><span>Título *</span><S.Input name="title" defaultValue={editingDocument.title} required /></S.Field><S.Field><span>Data do documento</span><S.Input name="documentDate" type="date" defaultValue={editingDocument.documentDate ?? ""} /></S.Field><S.Field><span>Número ou referência</span><S.Input name="referenceNumber" defaultValue={editingDocument.referenceNumber ?? ""} placeholder="Ex.: Contrato 018/2026" /></S.Field><S.Field><span>Localização física</span><S.Input name="physicalLocation" defaultValue={editingDocument.physicalLocation ?? ""} placeholder="Armário, gaveta e pasta" /></S.Field><S.SpanAll><S.Field><span>Descrição</span><S.Textarea name="description" defaultValue={editingDocument.description ?? ""} /></S.Field></S.SpanAll><S.SpanAll><S.Field><span>Tags</span><S.Input name="tags" defaultValue={editingDocument.tags.map((tag) => tag.name).join(", ")} placeholder="Separe as tags por vírgula: 2026, Seguro, Confidencial" /><small>Tags novas serão criadas automaticamente para esta igreja.</small></S.Field></S.SpanAll><S.SpanAll><S.Field><span>Observações</span><S.Textarea name="notes" defaultValue={editingDocument.notes ?? ""} /></S.Field></S.SpanAll></S.FormGrid><S.ModalFooter><Button variant="outline" onClick={() => setEditingDocument(null)}>Cancelar</Button><Button type="submit" loading={busy}>Salvar alterações</Button></S.ModalFooter></S.ModalContent></form>
        </Modal>
      )}

      {replacementDocument && (
        <Modal title="Substituir arquivo" description={replacementDocument.title} icon={<Replace />} size="md" onClose={() => { if (!busy) { setReplacementDocument(null); setReplacementFile(null); } }} busy={busy}>
          <form onSubmit={submitReplacement}><S.ModalContent><S.Confirmation><span><AlertTriangle /></span><p>O novo arquivo substituirá <strong>{replacementDocument.originalFileName}</strong>. Não será mantido histórico de versões. Se o envio ou a validação falhar, o arquivo atual permanecerá disponível.</p></S.Confirmation><S.DropZone><input type="file" accept={ADMINISTRATIVE_DOCUMENT_ACCEPT} onChange={(event) => setReplacementFile(event.target.files?.[0] ?? null)} disabled={busy} /><div><Replace /><strong>{replacementFile?.name ?? "Selecione o novo arquivo"}</strong><small>{replacementFile ? formatBytes(replacementFile.size) : "Formatos permitidos e limite de 10 MB."}</small></div></S.DropZone><S.ModalFooter><Button variant="outline" onClick={() => setReplacementDocument(null)} disabled={busy}>Cancelar</Button><Button type="submit" loading={busy} disabled={!replacementFile}>Substituir arquivo</Button></S.ModalFooter></S.ModalContent></form>
        </Modal>
      )}

      {confirmation && (
        <Modal title={confirmation.title} icon={<AlertTriangle />} size="sm" onClose={() => { if (!busy) setConfirmation(null); }} busy={busy}>
          <S.ModalContent><S.Confirmation><span><AlertTriangle /></span><p>{confirmation.description}</p></S.Confirmation><S.ModalFooter><Button variant="outline" onClick={() => setConfirmation(null)} disabled={busy}>Cancelar</Button><Button variant={confirmation.danger ? "danger" : "primary"} onClick={() => void executeConfirmation()} loading={busy}>{confirmation.confirmLabel}</Button></S.ModalFooter></S.ModalContent>
        </Modal>
      )}

      {notice && <ToastViewport><Toast title={notice.title} description={notice.description} variant={notice.variant} onClose={() => setNotice(null)} /></ToastViewport>}
    </S.Module>
  );
}

type UploadFinalizationResultLike = {
  documentId: string;
  status: "success" | "error";
  message: string;
};
