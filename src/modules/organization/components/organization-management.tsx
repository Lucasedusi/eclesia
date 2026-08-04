"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  Church,
  Eye,
  MapPin,
  Network,
  Paperclip,
  Pencil,
  Plus,
  Power,
  Search,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Toast, ToastViewport } from "@/components/ui/toast";
import {
  changeCongregationStatusAction,
  changePositionStatusAction,
  changeRegionStatusAction,
} from "../actions/organization.actions";
import type {
  CongregationItem,
  OrganizationActionState,
  OrganizationData,
  OrganizationStatus,
  OrganizationTab,
  PositionItem,
  RegionItem,
} from "../types/organization.types";
import { CongregationForm } from "./congregation-form";
import { CongregationDocumentsModal } from "./congregation-documents-modal";
import { DeleteConfirmationModal } from "./delete-confirmation-modal";
import {
  CongregationDetailsModal,
  RegionDetailsModal,
  type OrganizationDetailsTarget,
} from "./organization-details-modal";
import { PositionForm } from "./position-form";
import { RegionForm } from "./region-form";
import * as S from "./organization.styles";

type ToastState = { title: string; description?: string; variant: "success" | "danger" };
type DeleteTarget =
  | { kind: "region"; id: string; name: string; details: string }
  | { kind: "congregation"; id: string; name: string; details: string }
  | { kind: "position"; id: string; name: string; details: string };

const PAGE_SIZE = 20;

const descriptions: Record<OrganizationTab, { title: string; text: string; empty: string }> = {
  regions: {
    title: "Regionais",
    text: "Organize agrupamentos territoriais e acompanhe suas congregações vinculadas.",
    empty: "Nenhuma regional cadastrada ainda.",
  },
  congregations: {
    title: "Congregações",
    text: "Gerencie a Sede e as congregações, incluindo liderança, contato e endereço.",
    empty: "Nenhuma congregação cadastrada ainda.",
  },
  positions: {
    title: "Cargos",
    text: "Mantenha a nomenclatura dos cargos eclesiásticos usada no cadastro dos membros.",
    empty: "Nenhum cargo cadastrado ainda.",
  },
};

function normalize(value: string | null | undefined) {
  return (value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(value));
}

function Status({ value }: { value: OrganizationStatus }) {
  return <S.StatusBadge $status={value}>{value === "ACTIVE" ? "Ativo" : "Inativo"}</S.StatusBadge>;
}

function OrganizationStats({ data }: { data: OrganizationData }) {
  const stats = [
    { icon: Network, label: "Regionais ativas", value: data.stats.activeRegions, tone: "primary" as const },
    { icon: Church, label: "Congregações ativas", value: data.stats.activeCongregations, tone: "success" as const },
    { icon: Power, label: "Congregações inativas", value: data.stats.inactiveCongregations, tone: "neutral" as const },
    { icon: MapPin, label: "Sem regional", value: data.stats.congregationsWithoutRegion, tone: "warning" as const },
    { icon: BadgeCheck, label: "Cargos ativos", value: data.stats.activePositions, tone: "primary" as const },
  ];

  return (
    <S.Stats aria-label="Resumo da estrutura eclesiástica">
      {stats.map(({ icon: Icon, label, value, tone }) => (
        <S.Stat key={label} $tone={tone}>
          <span><Icon size={19} /></span>
          <div><strong>{value}</strong><small>{label}</small></div>
        </S.Stat>
      ))}
    </S.Stats>
  );
}

export function OrganizationManagement({ data, activeTab }: { data: OrganizationData; activeTab: OrganizationTab }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [region, setRegion] = useState("ALL");
  const [congregationType, setCongregationType] = useState("ALL");
  const [sort, setSort] = useState("ORDER");
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [regionForm, setRegionForm] = useState<RegionItem | "new" | null>(null);
  const [congregationForm, setCongregationForm] = useState<CongregationItem | "new" | null>(null);
  const [congregationDocuments, setCongregationDocuments] = useState<CongregationItem | null>(null);
  const [regionDetails, setRegionDetails] = useState<OrganizationDetailsTarget | null>(null);
  const [congregationDetails, setCongregationDetails] = useState<OrganizationDetailsTarget | null>(null);
  const [positionForm, setPositionForm] = useState<PositionItem | "new" | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const notify = useCallback((state: OrganizationActionState) => {
    setToast({
      title: state.status === "success" ? "Alteração concluída" : "Não foi possível concluir",
      description: state.message,
      variant: state.status === "success" ? "success" : "danger",
    });
    if (state.status === "success") router.refresh();
  }, [router]);

  const formError = useCallback((message: string) => {
    setToast({ title: "Não foi possível concluir", description: message, variant: "danger" });
  }, []);

  const regionSuccess = useCallback((message: string) => {
    setRegionForm(null);
    notify({ status: "success", message });
  }, [notify]);

  const congregationSuccess = useCallback((message: string) => {
    setCongregationForm(null);
    notify({ status: "success", message });
  }, [notify]);

  const positionSuccess = useCallback((message: string) => {
    setPositionForm(null);
    notify({ status: "success", message });
  }, [notify]);

  const visibleItems = useMemo(() => {
    const needle = normalize(search);
    if (activeTab === "regions") {
      return [...data.regions]
        .filter((item) => status === "ALL" || item.status === status)
        .filter((item) => !needle || normalize(`${item.name} ${item.coordinatorName} ${item.description}`).includes(needle))
        .sort((a, b) => sort === "NAME" ? a.name.localeCompare(b.name, "pt-BR") : sort === "CREATED" ? b.createdAt.localeCompare(a.createdAt) : a.displayOrder - b.displayOrder || a.name.localeCompare(b.name, "pt-BR"));
    }
    if (activeTab === "congregations") {
      return [...data.congregations]
        .filter((item) => status === "ALL" || item.status === status)
        .filter((item) => region === "ALL" || (region === "NONE" ? !item.regionId : item.regionId === region))
        .filter((item) => congregationType === "ALL" || (congregationType === "HEADQUARTERS" ? item.isHeadquarters : !item.isHeadquarters))
        .filter((item) => !needle || normalize(`${item.name} ${item.code} ${item.pastorName} ${item.city} ${item.regionName}`).includes(needle))
        .sort((a, b) => sort === "NAME" ? a.name.localeCompare(b.name, "pt-BR") : sort === "REGION" ? (a.regionName ?? "zzz").localeCompare(b.regionName ?? "zzz", "pt-BR") : sort === "CREATED" ? b.createdAt.localeCompare(a.createdAt) : a.displayOrder - b.displayOrder || a.name.localeCompare(b.name, "pt-BR"));
    }
    return [...data.positions]
      .filter((item) => status === "ALL" || item.status === status)
      .filter((item) => !needle || normalize(`${item.name} ${item.femaleName} ${item.abbreviation} ${item.femaleAbbreviation}`).includes(needle))
      .sort((a, b) => sort === "NAME" ? a.name.localeCompare(b.name, "pt-BR") : sort === "CREATED" ? b.createdAt.localeCompare(a.createdAt) : a.displayOrder - b.displayOrder || a.name.localeCompare(b.name, "pt-BR"));
  }, [activeTab, congregationType, data, region, search, sort, status]);

  const totalPages = Math.max(1, Math.ceil(visibleItems.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedItems = visibleItems.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const canManage = activeTab === "regions" ? data.management.regions : activeTab === "congregations" ? data.management.congregations : data.management.positions;

  async function changeStatus(kind: DeleteTarget["kind"], id: string, current: OrganizationStatus) {
    setBusyId(id);
    const next = current === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    const action = kind === "region" ? changeRegionStatusAction : kind === "congregation" ? changeCongregationStatusAction : changePositionStatusAction;
    const state = await action({ id, status: next });
    setBusyId(null);
    notify(state);
  }

  function openCreate() {
    if (activeTab === "regions") setRegionForm("new");
    else if (activeTab === "congregations") setCongregationForm("new");
    else setPositionForm("new");
  }

  return (
    <S.Module>
      <OrganizationStats data={data} />
      <S.Panel>
        <S.PanelHeader>
          <div><h2>{descriptions[activeTab].title}</h2><p>{descriptions[activeTab].text}</p></div>
          {canManage ? <Button onClick={openCreate}><Plus size={15} /> Novo cadastro</Button> : null}
        </S.PanelHeader>
        <S.Toolbar>
          <S.Search><Search aria-hidden="true" /><S.Control aria-label={`Buscar em ${descriptions[activeTab].title}`} placeholder="Buscar por nome ou identificação..." value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></S.Search>
          <S.SelectControl aria-label="Filtrar por status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
            <option value="ALL">Todos os status</option><option value="ACTIVE">Ativos</option><option value="INACTIVE">Inativos</option>
          </S.SelectControl>
          {activeTab === "congregations" ? (
            <>
              <S.SelectControl aria-label="Filtrar por regional" value={region} onChange={(event) => { setRegion(event.target.value); setPage(1); }}>
                <option value="ALL">Todas as regionais</option><option value="NONE">Sem regional</option>{data.regions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </S.SelectControl>
              <S.SelectControl aria-label="Filtrar por tipo" value={congregationType} onChange={(event) => { setCongregationType(event.target.value); setPage(1); }}>
                <option value="ALL">Todos os tipos</option><option value="HEADQUARTERS">Somente Sede</option><option value="COMMON">Congregações</option>
              </S.SelectControl>
            </>
          ) : (
            <S.SelectControl aria-label="Ordenar resultados" value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }}>
              <option value="ORDER">Ordem de exibição</option><option value="NAME">Nome (A–Z)</option><option value="CREATED">Mais recentes</option>
            </S.SelectControl>
          )}
          {activeTab === "congregations" ? (
            <S.SelectControl aria-label="Ordenar resultados" value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }}>
              <option value="ORDER">Ordem de exibição</option><option value="NAME">Nome (A–Z)</option><option value="REGION">Regional</option><option value="CREATED">Mais recentes</option>
            </S.SelectControl>
          ) : <span aria-hidden="true" />}
        </S.Toolbar>

        {pagedItems.length === 0 ? (
          <S.Empty>
            <span>{activeTab === "regions" ? <Network /> : activeTab === "congregations" ? <Church /> : <BadgeCheck />}</span>
            <h3>{visibleItems.length === 0 && !search && status === "ALL" ? descriptions[activeTab].empty : "Nenhum resultado encontrado"}</h3>
            <p>{search || status !== "ALL" || region !== "ALL" || congregationType !== "ALL" ? "Ajuste os filtros ou tente uma busca diferente." : "Use o botão de novo cadastro para começar a organizar a estrutura da igreja."}</p>
            {canManage && !search ? <Button onClick={openCreate}><Plus size={15} /> Novo cadastro</Button> : null}
          </S.Empty>
        ) : (
          <>
            {activeTab === "regions" && <RegionTable items={pagedItems as RegionItem[]} canManage={canManage} busyId={busyId} onEdit={setRegionForm} onStatus={(item) => changeStatus("region", item.id, item.status)} onDelete={setDeleteTarget} onDetails={(item) => setRegionDetails({ id: item.id, name: item.name })} />}
            {activeTab === "congregations" && <CongregationTable items={pagedItems as CongregationItem[]} canManage={canManage} canViewDocuments={data.management.congregationDocumentsView} busyId={busyId} onEdit={setCongregationForm} onStatus={(item) => changeStatus("congregation", item.id, item.status)} onDelete={setDeleteTarget} onDocuments={setCongregationDocuments} onDetails={(item) => setCongregationDetails({ id: item.id, name: item.name })} />}
            {activeTab === "positions" && <PositionTable items={pagedItems as PositionItem[]} canManage={canManage} busyId={busyId} onEdit={setPositionForm} onStatus={(item) => changeStatus("position", item.id, item.status)} onDelete={setDeleteTarget} />}
            <S.Pagination>
              <span>{visibleItems.length} registro{visibleItems.length === 1 ? "" : "s"} · Página {safePage} de {totalPages}</span>
              <div><button type="button" aria-label="Página anterior" disabled={safePage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft /></button><button type="button" aria-label="Próxima página" disabled={safePage >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}><ChevronRight /></button></div>
            </S.Pagination>
          </>
        )}
      </S.Panel>

      {regionDetails ? <RegionDetailsModal target={regionDetails} canManage={data.management.regions} onClose={() => setRegionDetails(null)} onEdit={(item) => { setRegionDetails(null); setRegionForm(item); }} onOpenCongregation={(target) => { setRegionDetails(null); setCongregationDetails(target); }} /> : null}
      {congregationDetails ? <CongregationDetailsModal target={congregationDetails} canManage={data.management.congregations} canViewDocuments={data.management.congregationDocumentsView} onClose={() => setCongregationDetails(null)} onEdit={(item) => { setCongregationDetails(null); setCongregationForm(item); }} onOpenDocuments={(item) => { setCongregationDetails(null); setCongregationDocuments(item); }} /> : null}
      {regionForm ? <RegionForm region={regionForm === "new" ? null : regionForm} onClose={() => setRegionForm(null)} onSuccess={regionSuccess} onError={formError} /> : null}
      {congregationForm ? <CongregationForm congregation={congregationForm === "new" ? null : congregationForm} regions={data.activeRegionOptions} onClose={() => setCongregationForm(null)} onSuccess={congregationSuccess} onError={formError} /> : null}
      {congregationDocuments ? <CongregationDocumentsModal congregation={congregationDocuments} canManage={data.management.congregationDocumentsManage} onClose={() => setCongregationDocuments(null)} onResult={notify} /> : null}
      {positionForm ? <PositionForm position={positionForm === "new" ? null : positionForm} onClose={() => setPositionForm(null)} onSuccess={positionSuccess} onError={formError} /> : null}
      {deleteTarget ? <DeleteConfirmationModal kind={deleteTarget.kind} id={deleteTarget.id} name={deleteTarget.name} onClose={() => setDeleteTarget(null)} onResult={(state) => { if (state.status === "success") setDeleteTarget(null); notify(state); }} /> : null}
      {toast ? <ToastViewport><Toast title={toast.title} description={toast.description} variant={toast.variant} onClose={() => setToast(null)} /></ToastViewport> : null}
    </S.Module>
  );
}

type CommonTableProps<T> = { items: T[]; canManage: boolean; busyId: string | null; onEdit: (item: T) => void; onStatus: (item: T) => void; onDelete: (target: DeleteTarget) => void; onDetails?: (item: T) => void };

function Actions({ item, canManage, busy, protectedItem = false, onDetails, onEdit, onStatus, onDelete, onDocuments }: { item: RegionItem | CongregationItem | PositionItem; kind?: DeleteTarget["kind"]; canManage: boolean; busy: boolean; protectedItem?: boolean; onDetails?: () => void; onEdit: () => void; onStatus: () => void; onDelete: () => void; onDocuments?: () => void }) {
  if (!canManage && !onDetails && !onDocuments) return null;
  return <S.RowActions>
    {onDetails ? <S.IconButton type="button" title="Ver detalhes" aria-label={`Ver detalhes de ${item.name}`} onClick={onDetails} disabled={busy}><Eye /></S.IconButton> : null}
    {onDocuments ? <S.IconButton type="button" title="Documentos" aria-label={`Gerenciar documentos de ${item.name}`} onClick={onDocuments} disabled={busy}><Paperclip /></S.IconButton> : null}
    {canManage ? <S.IconButton type="button" title="Editar" aria-label={`Editar ${item.name}`} onClick={onEdit} disabled={busy}><Pencil /></S.IconButton> : null}
    {canManage && !protectedItem ? <S.IconButton type="button" $warning title={item.status === "ACTIVE" ? "Inativar" : "Ativar"} aria-label={`${item.status === "ACTIVE" ? "Inativar" : "Ativar"} ${item.name}`} onClick={onStatus} disabled={busy}>{busy ? <S.InlineSpinner /> : <Power />}</S.IconButton> : null}
    {canManage && !protectedItem ? <S.IconButton type="button" $danger title="Arquivar" aria-label={`Arquivar ${item.name}`} onClick={onDelete} disabled={busy}><Trash2 /></S.IconButton> : null}
  </S.RowActions>;
}

function RegionTable({ items, canManage, busyId, onEdit, onStatus, onDelete, onDetails }: CommonTableProps<RegionItem> & { onDetails: (item: RegionItem) => void }) {
  return <><S.TableWrap><S.Table><thead><tr><th>Regional</th><th>Coordenação</th><th>Congregações</th><th>Ordem</th><th>Status</th><th>Atualização</th><th aria-label="Ações" /></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td><S.PrimaryCell><strong><Network size={14} />{item.name}</strong><small>{item.description || "Sem descrição"}</small></S.PrimaryCell></td><td>{item.coordinatorName || "Não informado"}<br /><small>{item.coordinatorPhone || ""}</small></td><td>{item.congregationCount} total · {item.activeCongregationCount} ativa{item.activeCongregationCount === 1 ? "" : "s"}</td><td>{item.displayOrder}</td><td><Status value={item.status} /></td><td>{formatDate(item.updatedAt)}</td><td><Actions item={item} kind="region" canManage={canManage} busy={busyId === item.id} onDetails={() => onDetails(item)} onEdit={() => onEdit(item)} onStatus={() => onStatus(item)} onDelete={() => onDelete({ kind: "region", id: item.id, name: item.name, details: "A regional só pode ser arquivada quando não houver congregações vinculadas." })} /></td></tr>)}</tbody></S.Table></S.TableWrap><MobileRows items={items} canManage={canManage} busyId={busyId} kind="region" onEdit={onEdit} onStatus={onStatus} onDelete={onDelete} onDetails={onDetails} /></>;
}

function CongregationTable({ items, canManage, canViewDocuments, busyId, onEdit, onStatus, onDelete, onDocuments, onDetails }: CommonTableProps<CongregationItem> & { canViewDocuments: boolean; onDocuments: (item: CongregationItem) => void; onDetails: (item: CongregationItem) => void }) {
  return <><S.TableWrap><S.Table><thead><tr><th>Congregação</th><th>Regional</th><th>Responsável</th><th>Localidade</th><th>Status</th><th>Atualização</th><th aria-label="Ações" /></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td><S.PrimaryCell><strong><Church size={14} />{item.name}{item.isHeadquarters && <S.HeadquartersBadge>Sede</S.HeadquartersBadge>}</strong><small>{item.code || item.email || "Sem código"}</small></S.PrimaryCell></td><td>{item.regionName || "Sem regional"}</td><td>{item.pastorName || "Não informado"}</td><td>{[item.city, item.state].filter(Boolean).join(" / ") || "Não informada"}</td><td><Status value={item.status} /></td><td>{formatDate(item.updatedAt)}</td><td><Actions item={item} kind="congregation" canManage={canManage} busy={busyId === item.id} protectedItem={item.isHeadquarters} onDetails={() => onDetails(item)} onEdit={() => onEdit(item)} onStatus={() => onStatus(item)} onDelete={() => onDelete({ kind: "congregation", id: item.id, name: item.name, details: "O arquivamento é bloqueado quando existem membros, usuários, documentos ou outros vínculos dependentes." })} onDocuments={canViewDocuments ? () => onDocuments(item) : undefined} /></td></tr>)}</tbody></S.Table></S.TableWrap><MobileRows items={items} canManage={canManage} canViewDocuments={canViewDocuments} busyId={busyId} kind="congregation" onEdit={onEdit} onStatus={onStatus} onDelete={onDelete} onDocuments={onDocuments} onDetails={onDetails} /></>;
}

function PositionTable({ items, canManage, busyId, onEdit, onStatus, onDelete }: CommonTableProps<PositionItem>) {
  return <><S.TableWrap><S.Table><thead><tr><th>Cargo</th><th>Forma feminina</th><th>Siglas</th><th>Ordem</th><th>Status</th><th>Atualização</th>{canManage && <th aria-label="Ações" />}</tr></thead><tbody>{items.map((item) => <tr key={item.id}><td><S.PrimaryCell><strong><ShieldCheck size={14} />{item.name}</strong><small>{item.description || "Sem descrição"}</small></S.PrimaryCell></td><td>{item.femaleName || "—"}</td><td>{[item.abbreviation, item.femaleAbbreviation].filter(Boolean).join(" / ") || "—"}</td><td>{item.displayOrder}</td><td><Status value={item.status} /></td><td>{formatDate(item.updatedAt)}</td>{canManage && <td><Actions item={item} kind="position" canManage busy={busyId === item.id} onEdit={() => onEdit(item)} onStatus={() => onStatus(item)} onDelete={() => onDelete({ kind: "position", id: item.id, name: item.name, details: "O cargo só pode ser arquivado quando não estiver atribuído a nenhum membro." })} /></td>}</tr>)}</tbody></S.Table></S.TableWrap><MobileRows items={items} canManage={canManage} busyId={busyId} kind="position" onEdit={onEdit} onStatus={onStatus} onDelete={onDelete} /></>;
}

function MobileRows<T extends RegionItem | CongregationItem | PositionItem>({ items, canManage, canViewDocuments = false, busyId, kind, onEdit, onStatus, onDelete, onDocuments, onDetails }: CommonTableProps<T> & { kind: DeleteTarget["kind"]; canViewDocuments?: boolean; onDocuments?: (item: CongregationItem) => void }) {
  return <S.MobileList>{items.map((item) => {
    const isRegion = kind === "region";
    const isCongregation = kind === "congregation";
    const regionItem = item as RegionItem;
    const congregation = item as CongregationItem;
    const position = item as PositionItem;
    const protectedItem = isCongregation && congregation.isHeadquarters;
    const showActions = canManage || isRegion || isCongregation;
    return <S.MobileCard key={item.id}><S.MobileCardTop><S.PrimaryCell><strong>{isRegion ? <Network size={14} /> : isCongregation ? <Church size={14} /> : <BadgeCheck size={14} />}{item.name}{protectedItem && <S.HeadquartersBadge>Sede</S.HeadquartersBadge>}</strong><small>{isRegion ? regionItem.description || "Sem descrição" : isCongregation ? congregation.code || congregation.email || "Sem código" : position.description || "Sem descrição"}</small></S.PrimaryCell><Status value={item.status} /></S.MobileCardTop><S.MobileMeta><div><dt>{isRegion ? "Coordenação" : isCongregation ? "Regional" : "Forma feminina"}</dt><dd>{isRegion ? regionItem.coordinatorName || "Não informada" : isCongregation ? congregation.regionName || "Sem regional" : position.femaleName || "—"}</dd></div><div><dt>{isRegion ? "Congregações" : isCongregation ? "Localidade" : "Ordem"}</dt><dd>{isRegion ? regionItem.congregationCount : isCongregation ? [congregation.city, congregation.state].filter(Boolean).join(" / ") || "Não informada" : position.displayOrder}</dd></div></S.MobileMeta>{showActions && <S.MobileActions><Actions item={item} kind={kind} canManage={canManage} busy={busyId === item.id} protectedItem={protectedItem} onDetails={onDetails ? () => onDetails(item) : undefined} onEdit={() => onEdit(item)} onStatus={() => onStatus(item)} onDelete={() => onDelete({ kind, id: item.id, name: item.name, details: isRegion ? "A regional só pode ser arquivada sem congregações vinculadas." : isCongregation ? "A Sede e congregações com dependências não podem ser arquivadas." : "Cargos atribuídos a membros não podem ser arquivados." } as DeleteTarget)} onDocuments={isCongregation && canViewDocuments && onDocuments ? () => onDocuments(congregation) : undefined} /></S.MobileActions>}</S.MobileCard>;
  })}</S.MobileList>;
}
