"use client";

import { ResultsSkeleton } from "@/components/ui/results-skeleton";

import { DateField } from "@/components/form/pickers/date-field";
import {
  ChangeEvent,
  FormEvent,
  KeyboardEvent,
  type ComponentProps,
  Suspense,
  use,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  ArrowRight,
  Building2,
  Church,
  Eye,
  FileSpreadsheet,
  FileChartColumn,
  MoreHorizontal,
  Pencil,
  Plus,
  ShieldAlert,
  ShieldCheck,
  RotateCcw,
  SlidersHorizontal,
  UserCheck,
  UserRoundX,
  UsersRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Modal, ModalLoading } from "@/components/ui/modal";
import { LinkPendingIndicator } from "@/components/navigation/navigation-feedback";
import { Toast, ToastViewport } from "@/components/ui/toast";
import {
  changeMemberLifecycleAction,
  listMembersAction,
} from "../actions/member.actions";
import {
  memberStatusOptions,
  memberTypeOptions,
} from "../constants/member-form-options";
import type {
  MemberCapabilities,
  MemberFilters,
  MemberLifecycleInput,
  MemberListItem,
  MemberListParams,
  MemberListData,
  MemberStats,
} from "../types/member.types";
import {
  memberStatusLabels,
} from "../utils/member-formatters";
import { MemberIdentity, MemberSearchField } from "./member-list-fields";
import { MemberDetailsModal, prepareMemberDetails } from "./member-details-dialog";
import * as S from "./members.styles";

const MemberReportModal = dynamic(
  () => import("./member-report-modal").then((module) => module.MemberReportModal),
  { loading: () => <ModalLoading title="Preparando listagem de membros" description="Carregando as opções do relatório." /> },
);

type Props = {
  initial: MemberListData;
  params: MemberListParams;
  filters: Promise<MemberFilters | null>;
  capabilities: MemberCapabilities;
};

type Notice = {
  title: string;
  description: string;
  variant: "success" | "danger" | "warning";
};

type FilterSelectProps = ComponentProps<typeof S.Select> & {
  filters: Props["filters"];
  catalog: keyof MemberFilters;
  placeholder: string;
};

function MemberFilterOptions({ filters, catalog, placeholder, ...props }: FilterSelectProps) {
  const options = use(filters);
  return <S.Select {...props} disabled={!options}>
    <option value="">{options ? placeholder : "Opções indisponíveis"}</option>
    {options?.[catalog].map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
  </S.Select>;
}

function MemberFilterSelect(props: FilterSelectProps) {
  return <Suspense fallback={<S.Select aria-label={props["aria-label"]} disabled><option>Carregando opções…</option></S.Select>}>
    <MemberFilterOptions {...props} />
  </Suspense>;
}

function DetailsWithFilters({ filters, ...props }: Omit<ComponentProps<typeof MemberDetailsModal>, "filters"> & { filters: Props["filters"] }) {
  return <MemberDetailsModal {...props} filters={use(filters) ?? { regions: [], congregations: [], roles: [] }} />;
}

export function MemberStatsCards({ stats }: { stats: MemberStats | null }) {
  if (!stats) return <S.Panel className="p-4" role="status">Resumo dos membros indisponível.</S.Panel>;
  return (
    <S.Stats aria-label="Resumo dos membros">
      <S.Stat>
        <span>
          <UsersRound size={19} />
        </span>
        <div>
          <strong>{stats.total}</strong>
          <small>Total de Cadastros</small>
        </div>
      </S.Stat>
      <S.Stat $tone="success">
        <span>
          <UserCheck size={19} />
        </span>
        <div>
          <strong>{stats.active}</strong>
          <small>Ativos</small>
        </div>
      </S.Stat>
      <S.Stat $tone="warning">
        <span>
          <UserRoundX size={19} />
        </span>
        <div>
          <strong>{stats.inactive}</strong>
          <small>Inativos</small>
        </div>
      </S.Stat>
      <S.Stat $tone="danger">
        <span>
          <Archive size={19} />
        </span>
        <div>
          <strong>{stats.archived}</strong>
          <small>Arquivados</small>
        </div>
      </S.Stat>
    </S.Stats>
  );
}

export function MemberManagement({
  initial,
  params: initialParams,
  filters,
  capabilities,
}: Props) {
  const [requestedList, setRequestedList] = useState<MemberListData | null>(null);
  const list = requestedList ?? initial;
  const [params, setParams] = useState(initialParams);
  const [searchInput, setSearchInput] = useState(initialParams.search);
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(
    Boolean(
      initialParams.roleId ||
      initialParams.memberType ||
      initialParams.archived ||
      initialParams.sort !== "name_asc",
    ),
  );
  const [pending, setPending] = useState(false);
  const [selection, setSelection] = useState<ReturnType<typeof prepareMemberDetails> | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [menuMember, setMenuMember] = useState<MemberListItem | null>(null);
  const [lifecycle, setLifecycle] = useState<MemberLifecycleInput | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestId = useRef(0);
  const lifecycleFormId = useId();

  useEffect(
    () => () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
      requestId.current += 1;
    },
    [],
  );

  function writeUrl(next: MemberListParams) {
    const query = new URLSearchParams();
    if (next.page > 1) query.set("page", String(next.page));
    if (next.pageSize !== 20) query.set("pageSize", String(next.pageSize));
    if (next.search.trim().length >= 3) query.set("search", next.search.trim());
    if (next.congregationId) query.set("congregation", next.congregationId);
    if (next.regionId) query.set("region", next.regionId);
    if (next.roleId) query.set("role", next.roleId);
    query.set("status", next.status);
    if (next.memberType) query.set("type", next.memberType);
    if (next.importBatchId) query.set("importBatch", next.importBatchId);
    if (next.archived) query.set("archived", "true");
    if (next.sort !== "name_asc") query.set("sort", next.sort);
    window.history.replaceState(
      null,
      "",
      query.size ? `/membros?${query}` : "/membros",
    );
  }

  function load(next: MemberListParams) {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const normalized = {
      ...next,
      search: next.search.trim().length >= 3 ? next.search.trim() : "",
    };
    const currentRequest = ++requestId.current;
    setParams(normalized);
    writeUrl(normalized);
    const response = listMembersAction(normalized);
    const rows = response.then((result) => result.rows).catch(() => null);
    setPending(true);
    setRequestedList({ rows, total: response.then((result) => result.total).catch(() => null) });
    void rows.then(() => {
      if (currentRequest === requestId.current) setPending(false);
    });
  }

  function changeFilter(
    field: keyof MemberListParams,
    value: string | boolean | number,
  ) {
    load({ ...params, search: searchInput, [field]: value, page: 1 });
  }

  function search(event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    setSearchInput(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const length = value.trim().length;
    if (length === 0) {
      load({ ...params, search: "", page: 1 });
      return;
    }
    if (length < 3) {
      if (params.search) load({ ...params, search: "", page: 1 });
      return;
    }
    searchTimer.current = setTimeout(
      () => load({ ...params, search: value, page: 1 }),
      400,
    );
  }

  function submitSearch(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (searchInput.trim().length >= 3 || searchInput.trim().length === 0) {
      load({ ...params, search: searchInput, page: 1 });
    }
  }

  function clearSearch() {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    setSearchInput("");
    load({ ...params, search: "", page: 1 });
  }

  function refresh() {
    load({ ...params, search: searchInput });
  }

  function beginLifecycle(
    member: MemberListItem,
    action: MemberLifecycleInput["action"],
  ) {
    setMenuMember(null);
    setLifecycle({
      memberId: member.id,
      action,
      eventDate: new Date().toISOString().slice(0, 10),
      expectedEndDate: "",
      reason: "",
      endRoles: true,
      reactivateRole: true,
    });
  }

  async function submitLifecycle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!lifecycle) return;

    const submittedAction = lifecycle.action;
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const input: MemberLifecycleInput = {
      ...lifecycle,
      eventDate: String(form.get("eventDate") ?? lifecycle.eventDate),
      expectedEndDate: String(form.get("expectedEndDate") ?? ""),
      reason: String(form.get("reason") ?? ""),
      targetCongregationId: String(form.get("targetCongregationId") ?? ""),
      destinationChurch: String(form.get("destinationChurch") ?? ""),
      endRoles: form.get("endRoles") === "on",
      reactivateRole: form.get("reactivateRole") === "on",
    };

    try {
      const response = await changeMemberLifecycleAction(input);
      setNotice({
        title: response.success
          ? submittedAction === "END_DISCIPLINE"
            ? "Disciplina encerrada"
            : "Movimentação concluída"
          : "Não foi possível concluir",
        description: response.message,
        variant: response.success ? "success" : "danger",
      });

      if (response.success) {
        setLifecycle(null);
        refresh();
      }
    } catch (error) {
      console.error("Erro ao movimentar membro:", error);
      setNotice({
        title: "Não foi possível concluir",
        description: "Ocorreu um erro inesperado. Tente novamente.",
        variant: "danger",
      });
    } finally {
      setBusy(false);
    }
  }

  const requiresReason = Boolean(
    lifecycle &&
    ["MOVE_CONGREGATION", "INACTIVATE", "DISCIPLINE"].includes(
      lifecycle.action,
    ),
  );
  const title = lifecycle
    ? {
        MOVE_CONGREGATION: "Mudar Congregação",
        INACTIVATE: "Inativar membro",
        REACTIVATE: "Reativar membro",
        TRANSFER: "Transferir para outra igreja",
        DISCIPLINE: "Registrar disciplina",
        END_DISCIPLINE: "Encerrar disciplina",
        DECEASED: "Registrar falecimento",
        ARCHIVE: "Arquivar cadastro",
        RESTORE: "Restaurar cadastro",
      }[lifecycle.action]
    : "Movimentação";
  const lifecycleInfo = lifecycle
    ? {
        MOVE_CONGREGATION:
          "O membro será vinculado à nova Congregação e a alteração ficará registrada no histórico.",
        INACTIVATE:
          "O cadastro permanecerá disponível para consulta, mas o membro ficará com situação inativa.",
        REACTIVATE:
          "O membro voltará à situação ativa sem perder as movimentações anteriores.",
        TRANSFER:
          "A transferência encerrará o vínculo ativo com esta igreja e poderá encerrar o Cargo atual.",
        DISCIPLINE:
          "O evento será tratado como informação sensível e poderá suspender o Cargo atual.",
        END_DISCIPLINE:
          "O membro voltará à situação ativa. O Cargo suspenso poderá ser reativado quando não houver outro Cargo ativo.",
        DECEASED:
          "O cadastro será preservado, o Cargo atual será encerrado e a data ficará no histórico.",
        ARCHIVE:
          "O cadastro sairá das listagens atuais, mas continuará preservado para auditoria.",
        RESTORE:
          "O cadastro arquivado voltará a aparecer nas listagens atuais.",
      }[lifecycle.action]
    : "";

  const editingSearch = searchInput.trim().length >= 3 && searchInput.trim() !== params.search;
  const hasActiveFilters = Boolean(
    searchInput.trim() ||
    params.regionId ||
    params.congregationId ||
    params.roleId ||
    params.status ||
    params.memberType ||
    params.importBatchId ||
    params.archived ||
    params.sort !== "name_asc",
  );

  function resetFilters() {
    if (searchTimer.current) {
      clearTimeout(searchTimer.current);
      searchTimer.current = null;
    }

    setSearchInput("");
    setAdvancedFiltersOpen(false);

    load({
      ...params,
      page: 1,
      search: "",
      regionId: "",
      congregationId: "",
      roleId: "",
      status: "ACTIVE",
      memberType: "",
      importBatchId: "",
      archived: false,
      sort: "name_asc",
    });
  }

  return (
    <>
      <S.Module>
        <S.Panel>
          <S.PanelHeader>
            <div>
              <h2>Relação de membros</h2>
              <p>
                Listagem de Membros
              </p>
            </div>
            <S.HeaderActions>
              {capabilities.exportSheet && (
                <S.HeaderActionButton type="button" title="Relatório" onClick={() => setReportOpen(true)}>
                  <FileChartColumn aria-hidden="true" />
                  <span>Relatório</span>
                </S.HeaderActionButton>
              )}
              {capabilities.import && (
                <S.HeaderActionLink
                  href="/membros/importar"
                  title="Cadastro em Lote"
                >
                  <FileSpreadsheet aria-hidden="true" />
                  <span>Cadastro em Lote</span>
                  <LinkPendingIndicator />
                </S.HeaderActionLink>
              )}
              {capabilities.create && (
                <S.HeaderActionLink href="/membros/novo" $primary>
                  <Plus aria-hidden="true" />
                  <span>Novo membro</span>
                  <LinkPendingIndicator />
                </S.HeaderActionLink>
              )}
            </S.HeaderActions>
          </S.PanelHeader>

          <S.Toolbar>
            <MemberSearchField label="Pesquisar membros" placeholder={capabilities.viewSensitiveIdentity ? "Nome, código ou CPF" : "Nome ou código"}
              value={searchInput} maxLength={80} pending={pending} onChange={search} onKeyDown={submitSearch} onClear={clearSearch} />
            <S.Select
              aria-label="Situação dos membros"
              value={params.status}
              onChange={(event) => changeFilter("status", event.target.value)}
            >
              <option value="">Todas as Situações</option>
              {memberStatusOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </S.Select>
            <MemberFilterSelect filters={filters} catalog="regions" placeholder="Todas as Regionais"
              aria-label="Regional" value={params.regionId} onChange={(event) => changeFilter("regionId", event.target.value)} />
            <MemberFilterSelect filters={filters} catalog="congregations" placeholder="Todas as Congregações"
              aria-label="Congregação" value={params.congregationId} onChange={(event) => changeFilter("congregationId", event.target.value)} />
            <S.AdvancedFiltersButton
              type="button"
              $open={advancedFiltersOpen}
              aria-expanded={advancedFiltersOpen}
              aria-controls="member-advanced-filters"
              onClick={() => setAdvancedFiltersOpen((open) => !open)}
            >
              <SlidersHorizontal aria-hidden="true" />
              Filtros avançados
            </S.AdvancedFiltersButton>

            <S.ResetFiltersButton
              type="button"
              title="Limpar filtros"
              aria-label="Limpar filtros da listagem de membros"
              disabled={!hasActiveFilters}
              onClick={resetFilters}
            >
              <RotateCcw aria-hidden="true" />
            </S.ResetFiltersButton>

            {advancedFiltersOpen && (
              <S.AdvancedFilters id="member-advanced-filters">
                <MemberFilterSelect filters={filters} catalog="roles" placeholder="Todos os Cargos"
                  aria-label="Cargo" value={params.roleId} onChange={(event) => changeFilter("roleId", event.target.value)} />
                <S.Select
                  value={params.memberType}
                  onChange={(event) =>
                    changeFilter("memberType", event.target.value)
                  }
                >
                  <option value="">Todos os tipos</option>
                  {memberTypeOptions.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </S.Select>
                <S.Select
                  value={params.archived ? "archived" : "current"}
                  onChange={(event) =>
                    load({ ...params, search: searchInput, page: 1, archived: event.target.value === "archived", status: event.target.value === "archived" ? "" : "ACTIVE" })
                  }
                >
                  <option value="current">Cadastros atuais</option>
                  <option value="archived">Arquivados</option>
                </S.Select>
                <S.Select
                  value={params.sort}
                  onChange={(event) => changeFilter("sort", event.target.value)}
                >
                  <option value="name_asc">Nome A–Z</option>
                  <option value="name_desc">Nome Z–A</option>
                  <option value="recent">Mais recentes</option>
                  <option value="oldest">Mais antigos</option>
                  <option value="code">Código</option>
                </S.Select>
              </S.AdvancedFilters>
            )}
          </S.Toolbar>

          {editingSearch ? (
            <ResultsSkeleton label="Carregando membros" columns={6} />
          ) : (
            <Suspense fallback={<ResultsSkeleton label="Carregando membros" columns={6} />}>
              <MemberRows rows={list.rows} capabilities={capabilities}
                onDetails={(member) => setSelection(prepareMemberDetails(member.id))} onMenu={setMenuMember} />
            </Suspense>
          )}

          <S.Pagination>
            <span>
              Página {params.page}
              <Suspense fallback=" · Calculando total…"><MemberTotal total={list.total} pageSize={params.pageSize} /></Suspense>
            </span>
            <div>
              <S.Select
                value={params.pageSize}
                onChange={(event) =>
                  changeFilter("pageSize", Number(event.target.value))
                }
              >
                <option value={20}>20 por página</option>
                <option value={50}>50 por página</option>
                <option value={100}>100 por página</option>
              </S.Select>
              <Button
                size="sm"
                variant="secondary"
                disabled={params.page <= 1 || pending || editingSearch}
                onClick={() => load({ ...params, search: searchInput, page: params.page - 1 })}
              >
                <ArrowLeft size={14} /> Anterior
              </Button>
              <Suspense fallback={<Button size="sm" variant="secondary" disabled>Próxima <ArrowRight size={14} /></Button>}>
                <NextPage rows={list.rows} disabled={editingSearch} onNext={() => load({ ...params, search: searchInput, page: params.page + 1 })} />
              </Suspense>
            </div>
          </S.Pagination>
        </S.Panel>
      </S.Module>

      {reportOpen && <MemberReportModal params={params} capabilities={capabilities} onClose={() => setReportOpen(false)} />}

      {selection && (
        <Suspense fallback={<ModalLoading title="Preparando ficha do membro" description="Carregando as opções da ficha." />}>
          <DetailsWithFilters
            key={selection.memberId}
            selection={selection}
            capabilities={capabilities}
            filters={filters}
            onClose={() => setSelection(null)}
            onChanged={() => void refresh()}
          />
        </Suspense>
      )}

      {menuMember && (
        <Modal
          open
          title={`Ações de ${menuMember.fullName}`}
          description="Movimentações preservam o histórico do membro."
          icon={<MoreHorizontal />}
          onClose={() => setMenuMember(null)}
        >
          <S.Menu>
            {menuMember.archived ? (
              capabilities.restore && (
                <S.MenuButton
                  onClick={() => beginLifecycle(menuMember, "RESTORE")}
                >
                  <ArchiveRestore /> Restaurar cadastro
                </S.MenuButton>
              )
            ) : (
              <>
                {menuMember.memberStatus === "ACTIVE" &&
                  capabilities.transfer && (
                    <S.MenuButton
                      onClick={() =>
                        beginLifecycle(menuMember, "MOVE_CONGREGATION")
                      }
                    >
                      <Building2 /> Mudar Congregação
                    </S.MenuButton>
                  )}
                {menuMember.memberStatus === "ACTIVE" &&
                  capabilities.changeStatus && (
                    <S.MenuButton
                      onClick={() => beginLifecycle(menuMember, "INACTIVATE")}
                    >
                      <UserRoundX /> Inativar
                    </S.MenuButton>
                  )}
                {menuMember.memberStatus === "INACTIVE" &&
                  capabilities.changeStatus && (
                    <S.MenuButton
                      onClick={() => beginLifecycle(menuMember, "REACTIVATE")}
                    >
                      <UserCheck /> Reativar
                    </S.MenuButton>
                  )}
                {menuMember.memberStatus === "ACTIVE" &&
                  capabilities.transfer && (
                    <S.MenuButton
                      onClick={() => beginLifecycle(menuMember, "TRANSFER")}
                    >
                      <Church /> Transferir para outra igreja
                    </S.MenuButton>
                  )}
                {menuMember.memberStatus === "ACTIVE" &&
                  capabilities.changeStatus &&
                  capabilities.viewSensitiveHistory && (
                    <S.MenuButton
                      onClick={() => beginLifecycle(menuMember, "DISCIPLINE")}
                    >
                      <ShieldAlert /> Registrar disciplina
                    </S.MenuButton>
                  )}
                {menuMember.memberStatus === "DISCIPLINED" &&
                  capabilities.changeStatus &&
                  capabilities.viewSensitiveHistory && (
                    <S.MenuButton
                      onClick={() =>
                        beginLifecycle(menuMember, "END_DISCIPLINE")
                      }
                    >
                      <ShieldCheck /> Encerrar disciplina
                    </S.MenuButton>
                  )}
                {menuMember.memberStatus === "ACTIVE" &&
                  capabilities.changeStatus && (
                    <S.MenuButton
                      onClick={() => beginLifecycle(menuMember, "DECEASED")}
                    >
                      <UserRoundX /> Falecimento
                    </S.MenuButton>
                  )}
                {capabilities.archive && (
                  <S.MenuButton
                    onClick={() => beginLifecycle(menuMember, "ARCHIVE")}
                  >
                    <Archive /> Arquivar
                  </S.MenuButton>
                )}
              </>
            )}
          </S.Menu>
        </Modal>
      )}

      {lifecycle && (
        <Modal
          open
          title={title}
          description="A operação será registrada no histórico eclesiástico."
          icon={
            lifecycle.action === "END_DISCIPLINE" ? <ShieldCheck /> : <Church />
          }
          size="lg"
          onClose={() => setLifecycle(null)}
          busy={busy}
          footer={
            <S.ModalFooter>
              <span />
              <div>
                <Button
                  variant="outline"
                  onClick={() => setLifecycle(null)}
                  disabled={busy}
                >
                  Cancelar
                </Button>
                <Button type="submit" form={lifecycleFormId} loading={busy}>
                  {busy
                    ? "Salvando..."
                    : lifecycle.action === "END_DISCIPLINE"
                      ? "Encerrar disciplina"
                      : "Confirmar movimentação"}
                </Button>
              </div>
            </S.ModalFooter>
          }
        >
          <S.ActionForm id={lifecycleFormId} onSubmit={submitLifecycle}>
            <S.FormIntro>{lifecycleInfo}</S.FormIntro>
            <S.FieldGrid>
              <S.Field>
                <span>Data do evento *</span>
                <DateField
                  name="eventDate"
                  label="Data do evento" hideLabel
                  required
                  value={lifecycle.eventDate}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(value) =>
                    setLifecycle((current) =>
                      current
                        ? { ...current, eventDate: value }
                        : current,
                    )
                  }
                />
              </S.Field>
              {lifecycle.action === "DISCIPLINE" && (
                <S.Field>
                  <span>Previsão de encerramento</span>
                  <DateField
                    name="expectedEndDate"
                    label="Previsão de encerramento" hideLabel
                    min={lifecycle.eventDate}
                    value={lifecycle.expectedEndDate ?? ""}
                    onChange={(value) =>
                      setLifecycle((current) =>
                        current
                          ? { ...current, expectedEndDate: value }
                          : current,
                      )
                    }
                  />
                </S.Field>
              )}
              {lifecycle.action === "MOVE_CONGREGATION" && (
                <S.Field>
                  <span>Nova Congregação *</span>
                  <MemberFilterSelect filters={filters} catalog="congregations" placeholder="Selecione"
                    name="targetCongregationId" aria-label="Nova Congregação" required defaultValue="" />
                </S.Field>
              )}
              {lifecycle.action === "TRANSFER" && (
                <S.Field>
                  <span>Igreja de destino *</span>
                  <S.Control
                    name="destinationChurch"
                    required
                    placeholder="Nome da igreja de destino"
                  />
                </S.Field>
              )}
              {!["ARCHIVE", "RESTORE"].includes(lifecycle.action) && (
                <S.Field $span={2}>
                  <span>
                    {lifecycle.action === "END_DISCIPLINE"
                      ? "Observação"
                      : "Motivo ou observação"}
                    {requiresReason ? " *" : ""}
                  </span>
                  <S.Textarea
                    name="reason"
                    required={requiresReason}
                    placeholder={
                      lifecycle.action === "END_DISCIPLINE"
                        ? "Observação opcional sobre o encerramento"
                        : "Descreva o motivo desta movimentação"
                    }
                  />
                </S.Field>
              )}
              {["TRANSFER", "DISCIPLINE"].includes(lifecycle.action) && (
                <S.CheckField $span={2}>
                  <Checkbox
                    id="endRoles"
                    name="endRoles"
                    defaultChecked
                    label={
                      lifecycle.action === "DISCIPLINE"
                        ? "Suspender Cargo atual"
                        : "Encerrar Cargo atual"
                    }
                  />
                </S.CheckField>
              )}
              {lifecycle.action === "END_DISCIPLINE" && (
                <S.CheckField $span={2}>
                  <Checkbox
                    id="reactivateRole"
                    name="reactivateRole"
                    defaultChecked
                    label="Reativar o Cargo suspenso"
                  />
                </S.CheckField>
              )}
            </S.FieldGrid>
          </S.ActionForm>
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

function MemberTotal({ total, pageSize }: { total: MemberListData["total"]; pageSize: number }) {
  const count = use(total);
  return count === null ? " · Total indisponível" : ` de ${Math.max(1, Math.ceil(count / pageSize))} · ${count} registro(s)`;
}

function NextPage({ rows, disabled, onNext }: { rows: MemberListData["rows"]; disabled: boolean; onNext: () => void }) {
  const result = use(rows);
  return <Button size="sm" variant="secondary" disabled={disabled || !result?.hasNextPage} onClick={onNext}>
    Próxima <ArrowRight size={14} />
  </Button>;
}

function MemberRows({ rows, capabilities, onDetails, onMenu }: {
  rows: MemberListData["rows"]; capabilities: MemberCapabilities;
  onDetails: (member: MemberListItem) => void; onMenu: (member: MemberListItem) => void;
}) {
  const result = use(rows);
  if (!result) return <S.Empty role="alert">Não foi possível carregar a listagem de membros.</S.Empty>;
  return result.items.length === 0 ? (
    <S.Empty>
      <div>
        <UsersRound size={30} />
        <h3>Nenhum membro encontrado</h3>
        <p>Ajuste os filtros ou cadastre um novo membro.</p>
      </div>
    </S.Empty>
  ) : (
    <>
      <S.TableWrap>
        <S.Table>
          <thead>
            <tr>
              <th>Membro</th>
              <th>Congregação</th>
              <th>Cargo</th>
              <th>WhatsApp</th>
              <th>Situação</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {result.items.map((member) => (
              <tr key={member.id}>
                <td>
                  <MemberIdentity name={member.fullName} code={member.memberCode} />
                </td>
                <td>
                  {member.congregationName}
                  <br />
                  <small>{member.regionName}</small>
                </td>
                <td>{member.role || "—"}</td>
                <td>{member.whatsapp || "Não informado"}</td>
                <td>
                  <S.Status $status={member.memberStatus}>
                    {member.archived
                      ? "Arquivado"
                      : memberStatusLabels[member.memberStatus]}
                  </S.Status>
                </td>
                <td>
                  <S.Actions>
                    <S.IconButton
                      title="Ver ficha"
                      onClick={() => onDetails(member)}
                    >
                      <Eye />
                    </S.IconButton>
                    {capabilities.update && !member.archived && (
                      <Link
                        href={`/membros/${member.id}/editar`}
                        aria-label={`Editar ${member.fullName}`}
                      >
                        <S.IconButton as="span" title="Editar">
                          <Pencil />
                          <LinkPendingIndicator />
                        </S.IconButton>
                      </Link>
                    )}
                    <S.IconButton
                      title="Outras ações"
                      onClick={() => onMenu(member)}
                    >
                      <MoreHorizontal />
                    </S.IconButton>
                  </S.Actions>
                </td>
              </tr>
            ))}
          </tbody>
        </S.Table>
      </S.TableWrap>
      <S.MobileList>
        {result.items.map((member) => (
          <S.MobileCard key={member.id}>
            <MemberIdentity name={member.fullName} code={member.memberCode} />
            <S.MobileMeta>
              <div>
                <span>Congregação</span>
                <strong>{member.congregationName}</strong>
              </div>
              <div>
                <span>Cargo</span>
                <strong>{member.role || "—"}</strong>
              </div>
              <div>
                <span>WhatsApp</span>
                <strong>{member.whatsapp || "Não informado"}</strong>
              </div>
            </S.MobileMeta>
            <S.Actions>
              <S.IconButton aria-label="Ver ficha" onClick={() => onDetails(member)}>
                <Eye />
              </S.IconButton>
              {capabilities.update && !member.archived && (
                <Link
                  href={`/membros/${member.id}/editar`}
                  aria-label={`Editar ${member.fullName}`}
                >
                  <S.IconButton as="span" title="Editar">
                    <Pencil />
                    <LinkPendingIndicator />
                  </S.IconButton>
                </Link>
              )}
              <S.IconButton onClick={() => onMenu(member)}>
                <MoreHorizontal />
              </S.IconButton>
            </S.Actions>
          </S.MobileCard>
        ))}
      </S.MobileList>
    </>
  );
}
