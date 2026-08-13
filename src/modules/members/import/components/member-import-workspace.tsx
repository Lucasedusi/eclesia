"use client";

import {
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Download,
  FileCheck2,
  FileDown,
  FileSpreadsheet,
  History,
  Info,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  UploadCloud,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Modal } from "@/components/ui/modal";
import { Toast, ToastViewport } from "@/components/ui/toast";
import {
  cancelMemberImportAction,
  confirmMemberImportAction,
  getMemberImportWorkspaceAction,
  prepareMemberImportAction,
  resolveMemberImportItemAction,
  resolveMemberImportMappingAction,
  rollbackMemberImportAction,
} from "../actions/member-import.actions";
import {
  MARITAL_STATUS_IMPORT_OPTIONS,
  MEMBER_IMPORT_CLASSIFICATION_LABELS,
  MEMBER_IMPORT_PAGE_SIZES,
  MEMBER_IMPORT_STATUS_LABELS,
  MEMBER_IMPORT_STEPS,
} from "../constants/member-import";
import type {
  MemberImportItem,
  MemberImportReviewParams,
  MemberImportWorkspaceData,
} from "../types/member-import.types";
import * as S from "./member-import.styles";

type Props = { initial: MemberImportWorkspaceData };
type Notice = { title: string; description: string; variant: "success" | "danger" | "warning" };
type Resolution =
  | "SKIP"
  | "RESTORE"
  | "IMPORT_WITHOUT_CPF"
  | "IMPORT_WITHOUT_BIRTH_DATE"
  | "IMPORT_WITHOUT_RECEIVED_DATE"
  | "IMPORT_WITHOUT_BAPTISM_DATE"
  | "IMPORT_WITHOUT_HOLY_SPIRIT_BAPTISM_DATE"
  | "IMPORT_WITHOUT_CONVERSION_DATE"
  | "IMPORT_AS_NEW";

const CLASSIFICATION_FILTERS = ["", "VALID", "WARNING", "ERROR", "SKIPPED", "IMPORTED"] as const;
const TERMINAL_STATUSES = ["COMPLETED", "ROLLED_BACK", "CANCELLED"];

function initialStep(data: MemberImportWorkspaceData) {
  if (!data.batch) return 1;
  if (TERMINAL_STATUSES.includes(data.batch.status)) return 5;
  return data.batch.status === "READY" ? 3 : 2;
}

function formatDate(value: string | null, withTime = false) {
  if (!value) return "Não informado";
  return new Intl.DateTimeFormat("pt-BR", withTime
    ? { dateStyle: "short", timeStyle: "short" }
    : { timeZone: "UTC" }).format(new Date(value));
}

function formatBytes(value: number) {
  return value < 1024 * 1024 ? `${Math.ceil(value / 1024)} KB` : `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function maskCpf(value: string | null) {
  return value ? `***.***.***-${value.slice(-2)}` : "Não informado";
}

function genderLabel(value: MemberImportItem["gender"]) {
  return value === "MALE" ? "Masculino" : value === "FEMALE" ? "Feminino" : "Não informado";
}

function naturalityLabel(item: MemberImportItem) {
  if (!item.naturalCity && !item.naturalState) return "Não informada";
  return [item.naturalCity, item.naturalState].filter(Boolean).join(" / ");
}

function addressLabel(item: MemberImportItem) {
  const location = [item.city, item.state].filter(Boolean).join(" / ");
  if (!location && !item.zipCode) return "Não informado";
  return [location, item.zipCode ? `CEP ${item.zipCode}` : ""].filter(Boolean).join(" · ");
}

function issueCodes(item: MemberImportItem) {
  return new Set(item.issues.filter((issue) => !issue.resolved).map((issue) => issue.code));
}

function ItemActions({
  item,
  busy,
  onResolve,
}: {
  item: MemberImportItem;
  busy: string;
  onResolve: (item: MemberImportItem, resolution: Resolution) => void;
}) {
  const codes = issueCodes(item);
  const related = item.issues.find((issue) => issue.relatedMemberId);
  const canChange = item.classification !== "IMPORTED";
  if (!canChange) {
    return item.importedMemberId ? (
      <Link href={`/membros?search=${encodeURIComponent(item.importedMemberCode ?? item.fullName)}`} className="app-button-secondary">
        Abrir membro
      </Link>
    ) : null;
  }
  const loading = (resolution: Resolution) => busy === `item:${item.id}:${resolution}`;
  return (
    <S.RowActions>
      {item.classification === "SKIPPED" ? (
        <Button size="sm" variant="outline" loading={loading("RESTORE")} onClick={() => onResolve(item, "RESTORE")}>
          Restaurar
        </Button>
      ) : (
        <Button size="sm" variant="secondary" loading={loading("SKIP")} onClick={() => onResolve(item, "SKIP")}>
          Pular
        </Button>
      )}
      {(codes.has("CPF_INVALID") || codes.has("CPF_DUPLICATE_FILE")) && (
        <Button size="sm" variant="outline" loading={loading("IMPORT_WITHOUT_CPF")} onClick={() => onResolve(item, "IMPORT_WITHOUT_CPF")}>
          Sem CPF
        </Button>
      )}
      {["BIRTH_DATE_INVALID", "BIRTH_DATE_FUTURE", "BIRTH_DATE_TOO_OLD", "RECEIVED_BEFORE_BIRTH"].some((code) => codes.has(code)) && (
        <Button size="sm" variant="outline" loading={loading("IMPORT_WITHOUT_BIRTH_DATE")} onClick={() => onResolve(item, "IMPORT_WITHOUT_BIRTH_DATE")}>
          Sem nascimento
        </Button>
      )}
      {["RECEIVED_DATE_INVALID", "RECEIVED_DATE_FUTURE", "RECEIVED_BEFORE_BIRTH"].some((code) => codes.has(code)) && (
        <Button size="sm" variant="outline" loading={loading("IMPORT_WITHOUT_RECEIVED_DATE")} onClick={() => onResolve(item, "IMPORT_WITHOUT_RECEIVED_DATE")}>
          Sem recebimento
        </Button>
      )}
      {["BAPTISM_DATE_INVALID", "BAPTISM_DATE_FUTURE", "BAPTISM_BEFORE_BIRTH"].some((code) => codes.has(code)) && (
        <Button size="sm" variant="outline" loading={loading("IMPORT_WITHOUT_BAPTISM_DATE")} onClick={() => onResolve(item, "IMPORT_WITHOUT_BAPTISM_DATE")}>
          Sem batismo
        </Button>
      )}
      {["HOLY_SPIRIT_BAPTISM_DATE_INVALID", "HOLY_SPIRIT_BAPTISM_DATE_FUTURE", "HOLY_SPIRIT_BAPTISM_BEFORE_BIRTH"].some((code) => codes.has(code)) && (
        <Button size="sm" variant="outline" loading={loading("IMPORT_WITHOUT_HOLY_SPIRIT_BAPTISM_DATE")} onClick={() => onResolve(item, "IMPORT_WITHOUT_HOLY_SPIRIT_BAPTISM_DATE")}>
          Sem batismo no Espírito
        </Button>
      )}
      {["CONVERSION_DATE_INVALID", "CONVERSION_DATE_FUTURE", "CONVERSION_BEFORE_BIRTH"].some((code) => codes.has(code)) && (
        <Button size="sm" variant="outline" loading={loading("IMPORT_WITHOUT_CONVERSION_DATE")} onClick={() => onResolve(item, "IMPORT_WITHOUT_CONVERSION_DATE")}>
          Sem conversão
        </Button>
      )}
      {(codes.has("POSSIBLE_DUPLICATE_NAME") || codes.has("POSSIBLE_DUPLICATE_NAME_BIRTH")) && !codes.has("CPF_ALREADY_EXISTS") && (
        <Button size="sm" variant="outline" loading={loading("IMPORT_AS_NEW")} onClick={() => onResolve(item, "IMPORT_AS_NEW")}>
          Importar como novo
        </Button>
      )}
      {related?.relatedMemberId && (
        <Link
          href={`/membros?search=${encodeURIComponent(related.relatedMemberName ?? item.fullName)}${related.relatedMemberArchived ? "&archived=true" : ""}`}
          className="app-button-secondary"
        >
          Ver existente
        </Link>
      )}
    </S.RowActions>
  );
}

export function MemberImportWorkspace({ initial }: Props) {
  const [workspace, setWorkspace] = useState(initial);
  const [tab, setTab] = useState<"new" | "history">("new");
  const [step, setStep] = useState(() => initialStep(initial));
  const [congregationId, setCongregationId] = useState(initial.batch?.congregationId ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [rollbackOpen, setRollbackOpen] = useState(false);
  const [rollbackBlockers, setRollbackBlockers] = useState<Array<Record<string, string>>>([]);
  const [filters, setFilters] = useState<MemberImportReviewParams>({ page: 1, pageSize: 20, search: "", classification: "" });
  const [searchInput, setSearchInput] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
  }, []);

  const batch = workspace.batch;
  const items = workspace.items;

  function showResult(success: boolean, message: string) {
    setNotice({
      title: success ? "Operação concluída" : "Não foi possível continuar",
      description: message,
      variant: success ? "success" : "danger",
    });
  }

  function applyWorkspace(data: MemberImportWorkspaceData, nextStep?: number) {
    setWorkspace(data);
    setCongregationId(data.batch?.congregationId ?? congregationId);
    setStep(nextStep ?? initialStep(data));
    const url = data.batch ? `/membros/importar?batch=${data.batch.id}` : "/membros/importar";
    window.history.replaceState(null, "", url);
  }

  function chooseFile(next: File | null) {
    if (next && !next.name.toLocaleLowerCase("pt-BR").endsWith(".xlsx")) {
      setFile(null);
      setNotice({ title: "Arquivo inválido", description: "Selecione uma planilha no formato XLSX.", variant: "danger" });
      return;
    }
    setFile(next);
  }

  function drop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    chooseFile(event.dataTransfer.files.item(0));
  }

  async function analyze(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || !congregationId) {
      setNotice({ title: "Dados incompletos", description: "Selecione a Congregação e a planilha XLSX.", variant: "warning" });
      return;
    }
    const form = new FormData();
    form.set("congregationId", congregationId);
    form.set("file", file);
    setBusy("analyze");
    try {
      const response = await prepareMemberImportAction(form);
      if (response.success) {
        applyWorkspace(response.data, 2);
        showResult(true, response.message);
      } else {
        if (response.existingBatchId) {
          const loaded = await getMemberImportWorkspaceAction({ batchId: response.existingBatchId });
          if (loaded.success) applyWorkspace(loaded.data);
        }
        showResult(false, response.message);
      }
    } finally {
      setBusy("");
    }
  }

  async function loadBatch(batchId: string) {
    setBusy(`batch:${batchId}`);
    try {
      const response = await getMemberImportWorkspaceAction({ batchId });
      if (response.success) {
        setTab("new");
        setFilters({ page: 1, pageSize: 20, search: "", classification: "" });
        setSearchInput("");
        applyWorkspace(response.data);
      } else showResult(false, response.message);
    } finally {
      setBusy("");
    }
  }

  async function mapValue(kind: "ROLE" | "MARITAL_STATUS", rawValue: string, value: string) {
    if (!batch || !value) return;
    setBusy(`mapping:${kind}:${rawValue}`);
    try {
      const response = await resolveMemberImportMappingAction({ kind, batchId: batch.id, rawValue, value });
      if (response.success) {
        applyWorkspace(response.data, 2);
        showResult(true, response.message);
      } else showResult(false, response.message);
    } finally {
      setBusy("");
    }
  }

  async function loadReview(next: MemberImportReviewParams) {
    if (!batch) return;
    setFilters(next);
    setBusy("review");
    try {
      const response = await getMemberImportWorkspaceAction({ batchId: batch.id, ...next });
      if (response.success) {
        setWorkspace(response.data);
        setStep(3);
      } else showResult(false, response.message);
    } finally {
      setBusy("");
    }
  }

  function search(event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    setSearchInput(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!value.trim()) {
      void loadReview({ ...filters, page: 1, search: "" });
      return;
    }
    if (value.trim().length < 3) return;
    searchTimer.current = setTimeout(() => void loadReview({ ...filters, page: 1, search: value.trim() }), 400);
  }

  async function resolveItem(item: MemberImportItem, resolution: Resolution) {
    if (!batch) return;
    setBusy(`item:${item.id}:${resolution}`);
    try {
      const response = await resolveMemberImportItemAction({ batchId: batch.id, itemId: item.id, resolution });
      if (response.success) {
        setWorkspace(response.data);
        setStep(3);
        showResult(true, response.message);
      } else showResult(false, response.message);
    } finally {
      setBusy("");
    }
  }

  async function confirmImport() {
    if (!batch || !accepted || busy) return;
    setBusy("confirm");
    try {
      const response = await confirmMemberImportAction(batch.id);
      if (response.success) {
        applyWorkspace(response.data, 5);
        showResult(true, response.message);
      } else showResult(false, response.message);
    } finally {
      setBusy("");
    }
  }

  async function cancelBatch() {
    if (!batch || busy) return;
    setBusy("cancel");
    try {
      const response = await cancelMemberImportAction(batch.id);
      if (response.success) {
        applyWorkspace(response.data);
        showResult(true, response.message);
      } else showResult(false, response.message);
    } finally {
      setBusy("");
    }
  }

  async function rollback() {
    if (!batch || busy) return;
    setBusy("rollback");
    setRollbackBlockers([]);
    try {
      const response = await rollbackMemberImportAction(batch.id);
      if (response.success) {
        setWorkspace(response.data.workspace);
        setRollbackBlockers(response.data.blockers);
        if (!response.data.blocked) {
          setRollbackOpen(false);
          setStep(5);
        }
        showResult(!response.data.blocked, response.message);
      } else showResult(false, response.message);
    } finally {
      setBusy("");
    }
  }

  async function download(url: string, key: string) {
    setBusy(key);
    try {
      const response = await fetch(url, { credentials: "same-origin" });
      if (!response.ok) throw new Error();
      const blob = await response.blob();
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = response.headers.get("Content-Disposition")?.match(/filename="?([^";]+)"?/)?.[1] ?? "arquivo.xlsx";
      anchor.click();
      URL.revokeObjectURL(href);
    } catch {
      showResult(false, "Não foi possível gerar o arquivo solicitado.");
    } finally {
      setBusy("");
    }
  }

  function newImport() {
    setWorkspace({ ...workspace, batch: null, items: null, roleMappings: [], maritalMappings: [] });
    setFile(null);
    setCongregationId("");
    setAccepted(false);
    setStep(1);
    setTab("new");
    window.history.replaceState(null, "", "/membros/importar");
  }

  return (
    <S.Module>
      <S.Tabs role="tablist" aria-label="Importação de membros">
        <S.Tab type="button" $active={tab === "new"} onClick={() => setTab("new")} role="tab" aria-selected={tab === "new"}>
          <FileSpreadsheet size={16} /> Nova importação
        </S.Tab>
        <S.Tab type="button" $active={tab === "history"} onClick={() => setTab("history")} role="tab" aria-selected={tab === "history"}>
          <History size={16} /> Histórico
        </S.Tab>
      </S.Tabs>

      {tab === "history" ? (
        <HistoryView workspace={workspace} busy={busy} onOpen={loadBatch} onNew={newImport} />
      ) : (
        <>
          {step <= 4 && <Progress current={step} />}
          {step === 1 && (
            <S.Card>
              <S.CardHeader>
                <div><h2>Destino e arquivo</h2><p>Escolha uma Congregação e envie a planilha-padrão do EKLESIA.</p></div>
                <Button size="sm" variant="outline" loading={busy === "template"} onClick={() => download("/api/members/imports/template", "template")}>
                  <FileDown size={16} /> Baixar modelo
                </Button>
              </S.CardHeader>
              <form onSubmit={analyze}>
                <S.CardBody>
                  <S.Field>
                    <span>Congregação de destino *</span>
                    <S.Select value={congregationId} onChange={(event) => setCongregationId(event.target.value)} required>
                      <option value="">Selecione a Congregação</option>
                      {workspace.congregations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </S.Select>
                    <small>Todos os membros deste lote serão vinculados a esta Congregação.</small>
                  </S.Field>
                  <S.Dropzone
                    $dragging={dragging}
                    onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={drop}
                  >
                    <div>
                      <UploadCloud aria-hidden="true" />
                      <strong>Arraste a planilha aqui ou clique para selecionar</strong>
                      <p>Somente arquivo XLSX, com até 5 MB e 500 membros.</p>
                      <small>Modelo oficial com 18 campos cadastrais; os formatos anteriores continuam aceitos.</small>
                    </div>
                    <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => chooseFile(event.target.files?.item(0) ?? null)} />
                  </S.Dropzone>
                  {file && (
                    <S.FileSelected>
                      <div><FileCheck2 size={20} /><div><strong>{file.name}</strong><small>{formatBytes(file.size)}</small></div></div>
                      <button type="button" onClick={() => setFile(null)} aria-label="Remover arquivo"><X size={17} /></button>
                    </S.FileSelected>
                  )}
                </S.CardBody>
                <S.Footer>
                  <span />
                  <div>
                    <Button type="submit" loading={busy === "analyze"} disabled={!file || !congregationId}>
                      Analisar planilha <ArrowRight size={16} />
                    </Button>
                  </div>
                </S.Footer>
              </form>
            </S.Card>
          )}

          {step === 2 && batch && (
            <ValidationStep
              workspace={workspace}
              busy={busy}
              onMap={mapValue}
              onBack={newImport}
              onReview={() => { setStep(3); void loadReview(filters); }}
              onCancel={cancelBatch}
            />
          )}

          {step === 3 && batch && items && (
            <ReviewStep
              workspace={workspace}
              busy={busy}
              filters={filters}
              searchInput={searchInput}
              onSearch={search}
              onLoad={loadReview}
              onResolve={resolveItem}
              onBack={() => setStep(2)}
              onContinue={() => setStep(4)}
            />
          )}

          {step === 4 && batch && (
            <ConfirmationStep
              workspace={workspace}
              accepted={accepted}
              busy={busy}
              onAccepted={setAccepted}
              onBack={() => setStep(3)}
              onConfirm={confirmImport}
            />
          )}

          {step === 5 && batch && (
            <ResultStep
              workspace={workspace}
              busy={busy}
              onNew={newImport}
              onHistory={() => setTab("history")}
              onReport={() => download(`/api/members/imports/${batch.id}/report`, "report")}
              onRollback={() => { setRollbackBlockers([]); setRollbackOpen(true); }}
            />
          )}
        </>
      )}

      <Modal
        open={rollbackOpen}
        title="Desfazer lote importado"
        description="Esta operação só é permitida quando os membros não receberam alterações posteriores."
        icon={<RotateCcw />}
        busy={busy === "rollback"}
        onClose={() => setRollbackOpen(false)}
        footer={(
          <S.ModalFooter>
            <Button variant="secondary" onClick={() => setRollbackOpen(false)} disabled={busy === "rollback"}>Cancelar</Button>
            <Button variant="danger" loading={busy === "rollback"} onClick={rollback}><Trash2 size={16} /> Desfazer lote</Button>
          </S.ModalFooter>
        )}
      >
        <S.ModalContent>
          <p>Os membros, identidades sensíveis, Cargos e históricos criados exclusivamente por este lote serão removidos de forma transacional.</p>
          {rollbackBlockers.length > 0 && (
            <S.InfoBox $tone="danger">
              <h3>O lote não pode ser desfeito</h3>
              <ul>{rollbackBlockers.map((blocker, index) => <li key={`${blocker.member_id ?? index}`}>{blocker.full_name ?? "Membro"}: {blocker.reason ?? "possui alterações posteriores"}</li>)}</ul>
            </S.InfoBox>
          )}
        </S.ModalContent>
      </Modal>

      <ToastViewport>
        {notice && <Toast title={notice.title} description={notice.description} variant={notice.variant} onClose={() => setNotice(null)} />}
      </ToastViewport>
    </S.Module>
  );
}

function Progress({ current }: { current: number }) {
  return (
    <S.Progress aria-label={`Etapa ${current} de 4`}>
      {MEMBER_IMPORT_STEPS.map((item) => (
        <S.ProgressItem key={item.id} $active={current === item.id} $done={current > item.id}>
          <span>{current > item.id ? <Check size={15} /> : item.id}</span>
          <div><strong>{item.title}</strong><small>{item.description}</small></div>
        </S.ProgressItem>
      ))}
    </S.Progress>
  );
}

function BatchStats({ workspace }: { workspace: MemberImportWorkspaceData }) {
  const batch = workspace.batch!;
  return (
    <S.Stats>
      <S.Stat><strong>{batch.totalRows}</strong><small>Total de linhas</small></S.Stat>
      <S.Stat $tone="success"><strong>{batch.validRows}</strong><small>Prontas</small></S.Stat>
      <S.Stat $tone="warning"><strong>{batch.warningRows}</strong><small>Com alertas</small></S.Stat>
      <S.Stat $tone="danger"><strong>{batch.errorRows}</strong><small>Com erros</small></S.Stat>
      <S.Stat $tone="muted"><strong>{batch.skippedRows}</strong><small>Puladas</small></S.Stat>
    </S.Stats>
  );
}

function ValidationStep({
  workspace,
  busy,
  onMap,
  onBack,
  onReview,
  onCancel,
}: {
  workspace: MemberImportWorkspaceData;
  busy: string;
  onMap: (kind: "ROLE" | "MARITAL_STATUS", raw: string, value: string) => void;
  onBack: () => void;
  onReview: () => void;
  onCancel: () => void;
}) {
  const batch = workspace.batch!;
  const settings = batch.settingsSnapshot;
  const ignored = Array.isArray(settings.ignored_columns) ? settings.ignored_columns as string[] : [];
  const unresolvedRoles = workspace.roleMappings.filter((item) => item.status === "REQUIRES_MAPPING").length;
  const unresolvedMarital = workspace.maritalMappings.filter((item) => item.status === "REQUIRES_MAPPING").length;
  return (
    <S.Card>
      <S.CardHeader>
        <div><h2>Validação e equivalências</h2><p>{batch.originalFilename} · aba {batch.worksheetName} · {formatBytes(batch.fileSizeBytes)}</p></div>
        <S.Status $status={batch.status}>{MEMBER_IMPORT_STATUS_LABELS[batch.status] ?? batch.status}</S.Status>
      </S.CardHeader>
      <S.CardBody>
        <BatchStats workspace={workspace} />
        <S.InfoGrid>
          <S.InfoBox $tone="success"><h3>Estrutura reconhecida</h3><p>{Array.isArray(settings.recognized_columns) ? settings.recognized_columns.length : 0} de 18 campos reconhecidos. Os formatos antigos permanecem compatíveis.</p></S.InfoBox>
          <S.InfoBox $tone={ignored.length ? "warning" : "info"}><h3>Colunas ignoradas</h3><p>{ignored.length ? ignored.join(", ") : "Nenhuma coluna extra encontrada."}</p></S.InfoBox>
        </S.InfoGrid>
        <div>
          <h3>Equivalência de Cargos</h3>
          <S.MappingList>
            {workspace.roleMappings.map((mapping) => (
              <S.Mapping key={mapping.rawValue}>
                <div><strong>{mapping.rawValue || "Não informado"}</strong><small>{mapping.count} linha(s)</small></div>
                {mapping.status === "RECOGNIZED" ? <S.Status $status="VALID">{mapping.roleName}</S.Status> : !mapping.rawValue ? (
                  <S.Status $status="ERROR">Cargo obrigatório</S.Status>
                ) : (
                  <S.Select
                    aria-label={`Mapear Cargo ${mapping.rawValue}`}
                    defaultValue=""
                    disabled={busy === `mapping:ROLE:${mapping.rawValue}`}
                    onChange={(event) => onMap("ROLE", mapping.rawValue, event.target.value)}
                  >
                    <option value="">Selecione o Cargo correspondente</option>
                    {workspace.roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
                  </S.Select>
                )}
              </S.Mapping>
            ))}
          </S.MappingList>
        </div>
        {workspace.maritalMappings.length > 0 && (
          <div>
            <h3>Equivalência de estado civil</h3>
            <S.MappingList>
              {workspace.maritalMappings.map((mapping) => (
                <S.Mapping key={mapping.rawValue}>
                  <div><strong>{mapping.rawValue}</strong><small>{mapping.count} linha(s)</small></div>
                  {mapping.status === "RECOGNIZED" ? <S.Status $status="VALID">{mapping.label}</S.Status> : (
                    <S.Select
                      aria-label={`Mapear estado civil ${mapping.rawValue}`}
                      defaultValue=""
                      disabled={busy === `mapping:MARITAL_STATUS:${mapping.rawValue}`}
                      onChange={(event) => onMap("MARITAL_STATUS", mapping.rawValue, event.target.value)}
                    >
                      <option value="">Selecione a equivalência</option>
                      {MARITAL_STATUS_IMPORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </S.Select>
                  )}
                </S.Mapping>
              ))}
            </S.MappingList>
          </div>
        )}
        {(unresolvedRoles > 0 || unresolvedMarital > 0) && (
          <S.InfoBox $tone="warning"><h3>Mapeamentos pendentes</h3><p>Há {unresolvedRoles} Cargo(s) e {unresolvedMarital} estado(s) civil(is) que exigem equivalência. Também é possível pular as linhas correspondentes na revisão.</p></S.InfoBox>
        )}
      </S.CardBody>
      <S.Footer>
        <div><Button variant="ghost" onClick={onBack}><ArrowLeft size={16} /> Nova planilha</Button><Button variant="ghost" loading={busy === "cancel"} onClick={onCancel}>Cancelar lote</Button></div>
        <div><Button onClick={onReview}>Revisar membros <ArrowRight size={16} /></Button></div>
      </S.Footer>
    </S.Card>
  );
}

function ReviewStep({
  workspace,
  busy,
  filters,
  searchInput,
  onSearch,
  onLoad,
  onResolve,
  onBack,
  onContinue,
}: {
  workspace: MemberImportWorkspaceData;
  busy: string;
  filters: MemberImportReviewParams;
  searchInput: string;
  onSearch: (event: ChangeEvent<HTMLInputElement>) => void;
  onLoad: (params: MemberImportReviewParams) => void;
  onResolve: (item: MemberImportItem, resolution: Resolution) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const batch = workspace.batch!;
  const items = workspace.items!;
  return (
    <S.Card>
      <S.CardHeader>
        <div><h2>Revisão dos membros</h2><p>Confira dados normalizados e registre uma decisão para cada pendência.</p></div>
        <S.Status $status={batch.status}>{MEMBER_IMPORT_STATUS_LABELS[batch.status] ?? batch.status}</S.Status>
      </S.CardHeader>
      <S.Toolbar>
        <S.Search><Search aria-hidden="true" /><input value={searchInput} onChange={onSearch} placeholder="Buscar por nome (mínimo 3 caracteres)" /></S.Search>
        <S.Select value={filters.classification} onChange={(event) => onLoad({ ...filters, page: 1, classification: event.target.value })}>
          {CLASSIFICATION_FILTERS.map((value) => <option key={value || "all"} value={value}>{value ? MEMBER_IMPORT_CLASSIFICATION_LABELS[value] : "Todas as situações"}</option>)}
        </S.Select>
        <S.Select value={filters.pageSize} onChange={(event) => onLoad({ ...filters, page: 1, pageSize: Number(event.target.value) as 20 | 50 | 100 })}>
          {MEMBER_IMPORT_PAGE_SIZES.map((size) => <option key={size} value={size}>{size} por página</option>)}
        </S.Select>
      </S.Toolbar>
      <S.TableWrap aria-busy={busy === "review"}>
        <S.Table>
          <thead><tr><th>Linha / situação</th><th>Membro</th><th>Contato e datas</th><th>Endereço, naturalidade e filiação</th><th>Cargo</th><th>Pendências</th><th>Decisão</th></tr></thead>
          <tbody>
            {items.items.map((item) => (
              <tr key={item.id}>
                <td><strong>#{item.rowNumber}</strong><small><S.Status $status={item.classification}>{MEMBER_IMPORT_CLASSIFICATION_LABELS[item.classification]}</S.Status></small></td>
                <td><strong>{item.fullName || "Nome ausente"}</strong><small>{genderLabel(item.gender)} · CPF {maskCpf(item.cpf)}</small><small>{item.maritalStatusRaw || "Estado civil não informado"}</small></td>
                <td>{item.whatsapp || item.phoneRaw || "Sem telefone"}<small>Nasc.: {formatDate(item.birthDate)} · Conversão: {formatDate(item.conversionDate)}</small><small>Águas: {formatDate(item.baptismDate)} · Espírito: {formatDate(item.holySpiritBaptismDate)} · Receb.: {formatDate(item.receivedDate)}</small></td>
                <td><strong>{addressLabel(item)}</strong><small>Naturalidade: {naturalityLabel(item)}</small><small>Pai: {item.fatherName || "não informado"} · Mãe: {item.motherName || "não informada"}</small></td>
                <td><strong>{item.roleName ?? "Não mapeado"}</strong><small>Origem: {item.roleRaw || "—"}</small></td>
                <td>{item.issues.length ? <IssueList item={item} /> : <S.Status $status="VALID">Sem pendências</S.Status>}</td>
                <td><ItemActions item={item} busy={busy} onResolve={onResolve} /></td>
              </tr>
            ))}
          </tbody>
        </S.Table>
      </S.TableWrap>
      <S.MobileRows>
        {items.items.map((item) => (
          <S.MobileRow key={item.id}>
            <header><div><h3>#{item.rowNumber} · {item.fullName || "Nome ausente"}</h3><p>{item.roleName ?? item.roleRaw ?? "Cargo não mapeado"}</p></div><S.Status $status={item.classification}>{MEMBER_IMPORT_CLASSIFICATION_LABELS[item.classification]}</S.Status></header>
            <div><strong>Sexo:</strong> {genderLabel(item.gender)} · <strong>CPF:</strong> {maskCpf(item.cpf)}</div>
            <div><strong>Nascimento:</strong> {formatDate(item.birthDate)} · <strong>Conversão:</strong> {formatDate(item.conversionDate)}</div>
            <div><strong>Batismo nas águas:</strong> {formatDate(item.baptismDate)} · <strong>Batismo com o Espírito:</strong> {formatDate(item.holySpiritBaptismDate)}</div>
            <div><strong>Endereço:</strong> {addressLabel(item)}</div>
            <div><strong>Naturalidade:</strong> {naturalityLabel(item)}</div>
            <div><strong>Filiação:</strong> {item.fatherName || "Pai não informado"} · {item.motherName || "Mãe não informada"}</div>
            {item.issues.length ? <IssueList item={item} /> : <S.Status $status="VALID">Sem pendências</S.Status>}
            <ItemActions item={item} busy={busy} onResolve={onResolve} />
          </S.MobileRow>
        ))}
      </S.MobileRows>
      {items.total === 0 && <S.Empty><div><Users /><h3>Nenhuma linha encontrada</h3><p>Ajuste os filtros para visualizar os membros deste lote.</p></div></S.Empty>}
      <S.Pagination>
        <span>{items.total} linha(s) · página {items.page} de {items.pageCount}</span>
        <div>
          <Button size="sm" variant="secondary" disabled={items.page <= 1 || busy === "review"} onClick={() => onLoad({ ...filters, page: items.page - 1 })}>Anterior</Button>
          <Button size="sm" variant="secondary" disabled={items.page >= items.pageCount || busy === "review"} onClick={() => onLoad({ ...filters, page: items.page + 1 })}>Próxima</Button>
        </div>
      </S.Pagination>
      <S.Footer>
        <div><Button variant="ghost" onClick={onBack}><ArrowLeft size={16} /> Validação</Button></div>
        <div>
          {batch.status !== "READY" && <S.InfoBox $tone="warning">Resolva ou pule as {batch.errorRows} linha(s) pendentes.</S.InfoBox>}
          <Button disabled={batch.status !== "READY"} onClick={onContinue}>Revisar confirmação <ArrowRight size={16} /></Button>
        </div>
      </S.Footer>
    </S.Card>
  );
}

function IssueList({ item }: { item: MemberImportItem }) {
  return (
    <S.Issues>
      {item.issues.map((issue, index) => (
        <li key={`${issue.code}-${index}`}>
          {issue.severity === "INFO" ? <Info /> : issue.resolved ? <CheckCircle2 /> : <AlertTriangle />}
          <span>{issue.message}{issue.resolved ? ` · Resolvido: ${issue.resolution ?? "decisão registrada"}` : ""}</span>
        </li>
      ))}
    </S.Issues>
  );
}

function ConfirmationStep({
  workspace,
  accepted,
  busy,
  onAccepted,
  onBack,
  onConfirm,
}: {
  workspace: MemberImportWorkspaceData;
  accepted: boolean;
  busy: string;
  onAccepted: (value: boolean) => void;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const batch = workspace.batch!;
  const willImport = batch.totalRows - batch.skippedRows;
  return (
    <S.Card>
      <S.CardHeader><div><h2>Confirmação do lote</h2><p>Esta é a última etapa antes da gravação transacional dos membros.</p></div><S.Status $status={batch.status}>{MEMBER_IMPORT_STATUS_LABELS[batch.status]}</S.Status></S.CardHeader>
      <S.CardBody>
        <S.Stats>
          <S.Stat $tone="success"><strong>{willImport}</strong><small>Serão importados</small></S.Stat>
          <S.Stat $tone="muted"><strong>{batch.skippedRows}</strong><small>Serão pulados</small></S.Stat>
          <S.Stat $tone="warning"><strong>{batch.warningRows}</strong><small>Com alertas aceitos</small></S.Stat>
          <S.Stat><strong>{workspace.roleMappings.filter((item) => item.roleId).length}</strong><small>Cargos atribuídos</small></S.Stat>
          <S.Stat><strong>1</strong><small>Operação atômica</small></S.Stat>
        </S.Stats>
        <S.InfoGrid>
          <S.InfoBox $tone="info"><h3>Destino</h3><p>{batch.churchName}<br />{batch.congregationName}</p></S.InfoBox>
          <S.InfoBox $tone="info"><h3>Arquivo de origem</h3><p>{batch.originalFilename}<br />Aba {batch.worksheetName}</p></S.InfoBox>
        </S.InfoGrid>
        <S.SummaryList>
          <div><ShieldCheck /><span>A importação revalidará CPF, Cargo e Congregação imediatamente antes de gravar.</span></div>
          <div><Users /><span>Os membros serão criados como <strong>MEMBER</strong> e <strong>ACTIVE</strong>. Sexo, CEP, cidade/UF, naturalidade e filiação serão gravados quando informados.</span></div>
          <div><History /><span>O Cargo atual não terá data inicial. Recebimento, conversão e os dois tipos de batismo serão preservados no cadastro e na linha do tempo.</span></div>
          <div><FileCheck2 /><span>O lote, a linha de origem e as decisões registradas permanecerão rastreáveis para auditoria e relatório.</span></div>
        </S.SummaryList>
        <S.InfoBox $tone="warning">
          <Checkbox
            id="confirm-member-import"
            checked={accepted}
            onChange={(event) => onAccepted(event.target.checked)}
            label={`Confirmo a importação de ${willImport} membro(s) para ${batch.congregationName}.`}
          />
        </S.InfoBox>
      </S.CardBody>
      <S.Footer>
        <div><Button variant="ghost" disabled={busy === "confirm"} onClick={onBack}><ArrowLeft size={16} /> Revisão</Button></div>
        <div><Button loading={busy === "confirm"} disabled={!accepted || batch.status !== "READY"} onClick={onConfirm}><CheckCircle2 size={17} /> Confirmar importação</Button></div>
      </S.Footer>
    </S.Card>
  );
}

function ResultStep({
  workspace,
  busy,
  onNew,
  onHistory,
  onReport,
  onRollback,
}: {
  workspace: MemberImportWorkspaceData;
  busy: string;
  onNew: () => void;
  onHistory: () => void;
  onReport: () => void;
  onRollback: () => void;
}) {
  const batch = workspace.batch!;
  const rolledBack = batch.status === "ROLLED_BACK";
  const cancelled = batch.status === "CANCELLED";
  return (
    <S.Card>
      <S.CardBody>
        <S.ResultHero $rolledBack={rolledBack || cancelled}>
          <span>{rolledBack ? <RotateCcw /> : cancelled ? <X /> : <CheckCircle2 />}</span>
          <h2>{rolledBack ? "Lote desfeito" : cancelled ? "Lote cancelado" : "Importação concluída"}</h2>
          <p>{rolledBack ? "Os registros criados exclusivamente pelo lote foram removidos." : cancelled ? "Nenhum membro foi criado por este lote." : `${batch.importedRows} membro(s) foram adicionados a ${batch.congregationName}.`}</p>
        </S.ResultHero>
        <BatchStats workspace={workspace} />
        <S.InfoGrid>
          <S.InfoBox $tone="info"><h3>Lote</h3><p>{batch.id}<br />Criado por {batch.createdByName} em {formatDate(batch.createdAt, true)}</p></S.InfoBox>
          <S.InfoBox $tone={rolledBack || cancelled ? "warning" : "success"}><h3>Status</h3><p>{MEMBER_IMPORT_STATUS_LABELS[batch.status]}{batch.completedAt ? ` em ${formatDate(batch.completedAt, true)}` : ""}</p></S.InfoBox>
        </S.InfoGrid>
      </S.CardBody>
      <S.Footer>
        <div>{!rolledBack && !cancelled && <Button variant="danger" loading={busy === "rollback"} onClick={onRollback}><RotateCcw size={16} /> Desfazer lote</Button>}</div>
        <div>
          <Button variant="secondary" onClick={onHistory}><History size={16} /> Histórico</Button>
          <Button variant="report" loading={busy === "report"} onClick={onReport}><Download size={16} /> Relatório</Button>
          {!rolledBack && !cancelled && <Link href={`/membros?importBatch=${batch.id}`} className="app-button-secondary"><Users size={16} /> Ver membros</Link>}
          <Button onClick={onNew}>Nova importação</Button>
        </div>
      </S.Footer>
    </S.Card>
  );
}

function HistoryView({
  workspace,
  busy,
  onOpen,
  onNew,
}: {
  workspace: MemberImportWorkspaceData;
  busy: string;
  onOpen: (batchId: string) => void;
  onNew: () => void;
}) {
  const { history } = workspace;
  return (
    <S.Card>
      <S.CardHeader><div><h2>Histórico de importações</h2><p>Consulte lotes, decisões, relatórios e resultados anteriores.</p></div><Button size="sm" onClick={onNew}><FileSpreadsheet size={16} /> Nova importação</Button></S.CardHeader>
      <S.CardBody>
        <S.HistoryStats>
          <S.Stat $tone="success"><strong>{history.stats.completed}</strong><small>Lotes concluídos</small></S.Stat>
          <S.Stat><strong>{history.stats.imported}</strong><small>Membros importados</small></S.Stat>
          <S.Stat $tone="warning"><strong>{history.stats.warnings}</strong><small>Lotes com alertas</small></S.Stat>
          <S.Stat $tone="muted"><strong>{history.stats.rolledBack}</strong><small>Lotes desfeitos</small></S.Stat>
        </S.HistoryStats>
        {history.items.length ? (
          <S.HistoryList>
            {history.items.map((item) => (
              <S.HistoryItem key={item.id}>
                <div><strong>{item.originalFilename}</strong><small>{item.congregationName}</small></div>
                <div><strong>{formatDate(item.createdAt, true)}</strong><small>{item.createdByName}</small></div>
                <div><strong>{item.importedRows} importado(s)</strong><small>{item.warningRows} alerta(s)</small></div>
                <S.Status $status={item.status}>{MEMBER_IMPORT_STATUS_LABELS[item.status] ?? item.status}</S.Status>
                <Button size="sm" variant="outline" loading={busy === `batch:${item.id}`} onClick={() => onOpen(item.id)}>
                  {TERMINAL_STATUSES.includes(item.status) ? "Ver detalhes" : "Continuar"}
                </Button>
              </S.HistoryItem>
            ))}
          </S.HistoryList>
        ) : (
          <S.Empty><div><History /><h3>Nenhum lote encontrado</h3><p>As importações preparadas aparecerão aqui.</p></div></S.Empty>
        )}
      </S.CardBody>
    </S.Card>
  );
}
