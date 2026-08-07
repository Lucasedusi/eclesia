"use client";

import { ChangeEvent, FormEvent, KeyboardEvent, useEffect, useId, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Archive, ArchiveRestore, ArrowLeft, ArrowRight, Building2, Church, CircleUserRound, Eye, Loader2, MoreHorizontal, Pencil, Search, ShieldAlert, UserCheck, UserRoundX, UsersRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Modal } from "@/components/ui/modal";
import { Toast, ToastViewport } from "@/components/ui/toast";
import { changeMemberLifecycleAction, listMembersAction } from "../actions/member.actions";
import { memberStatusOptions, memberTypeOptions } from "../constants/member-form-options";
import type { MemberCapabilities, MemberFilters, MemberLifecycleInput, MemberListItem, MemberListParams, MemberListResult, MemberStats } from "../types/member.types";
import { memberStatusLabels, memberTypeLabels } from "../utils/member-formatters";
import { MemberDetailsModal } from "./member-details-modal";
import * as S from "./members.styles";

type Props = { initial: MemberListResult; params: MemberListParams; stats: MemberStats; filters: MemberFilters; capabilities: MemberCapabilities };
type Notice = { title: string; description: string; variant: "success" | "danger" | "warning" };
function initials(name: string) { return name.split(" ").slice(0, 2).map((part) => part[0]).join("").toUpperCase(); }

export function MemberManagement({ initial, params: initialParams, stats, filters, capabilities }: Props) {
  const router = useRouter();
  const [result, setResult] = useState(initial);
  const [params, setParams] = useState(initialParams);
  const [searchInput, setSearchInput] = useState(initialParams.search);
  const [pending, startTransition] = useTransition();
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [menuMember, setMenuMember] = useState<MemberListItem | null>(null);
  const [lifecycle, setLifecycle] = useState<MemberLifecycleInput | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestId = useRef(0);
  const lifecycleFormId = useId();

  useEffect(() => () => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    requestId.current += 1;
  }, []);

  function writeUrl(next: MemberListParams) {
    const query = new URLSearchParams();
    if (next.page > 1) query.set("page", String(next.page));
    if (next.pageSize !== 20) query.set("pageSize", String(next.pageSize));
    if (next.search.trim().length >= 3) query.set("search", next.search.trim());
    if (next.congregationId) query.set("congregation", next.congregationId);
    if (next.regionId) query.set("region", next.regionId);
    if (next.roleId) query.set("role", next.roleId);
    if (next.status) query.set("status", next.status);
    if (next.memberType) query.set("type", next.memberType);
    if (next.archived) query.set("archived", "true");
    if (next.sort !== "name_asc") query.set("sort", next.sort);
    router.replace(query.size ? `/membros?${query}` : "/membros", { scroll: false });
  }

  function load(next: MemberListParams) {
    const normalized = { ...next, search: next.search.trim().length >= 3 ? next.search.trim() : "" };
    const currentRequest = ++requestId.current;
    setParams(normalized); writeUrl(normalized);
    startTransition(async () => {
      const response = await listMembersAction(normalized);
      if (currentRequest !== requestId.current) return;
      if (response.success) setResult(response.data);
      else setNotice({ title: "Listagem indisponível", description: response.message, variant: "danger" });
    });
  }

  function changeFilter(field: keyof MemberListParams, value: string | boolean | number) {
    load({ ...params, [field]: value, page: 1 });
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
    if (length < 3) return;
    searchTimer.current = setTimeout(() => load({ ...params, search: value, page: 1 }), 400);
  }

  function submitSearch(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (searchInput.trim().length >= 3 || searchInput.trim().length === 0) {
      load({ ...params, search: searchInput, page: 1 });
    }
  }

  async function refresh() {
    const response = await listMembersAction(params);
    if (response.success) setResult(response.data);
    router.refresh();
  }

  function beginLifecycle(member: MemberListItem, action: MemberLifecycleInput["action"]) {
    setMenuMember(null);
    setLifecycle({ memberId: member.id, action, eventDate: new Date().toISOString().slice(0, 10), reason: "", endRoles: true });
  }

  async function submitLifecycle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!lifecycle) return; setBusy(true);
    const form = new FormData(event.currentTarget);
    const input: MemberLifecycleInput = { ...lifecycle, eventDate: String(form.get("eventDate") ?? lifecycle.eventDate), reason: String(form.get("reason") ?? ""), targetCongregationId: String(form.get("targetCongregationId") ?? ""), destinationChurch: String(form.get("destinationChurch") ?? ""), endRoles: form.get("endRoles") === "on" };
    const response = await changeMemberLifecycleAction(input);
    setBusy(false);
    setNotice({ title: response.success ? "Movimentação concluída" : "Não foi possível concluir", description: response.message, variant: response.success ? "success" : "danger" });
    if (response.success) { setLifecycle(null); await refresh(); }
  }

  const requiresReason = lifecycle && ["MOVE_CONGREGATION", "INACTIVATE", "DISCIPLINE"].includes(lifecycle.action);
  const title = lifecycle ? ({ MOVE_CONGREGATION: "Mudar Congregação", INACTIVATE: "Inativar membro", REACTIVATE: "Reativar membro", TRANSFER: "Transferir para outra igreja", DISCIPLINE: "Registrar disciplina", DECEASED: "Registrar falecimento", ARCHIVE: "Arquivar cadastro", RESTORE: "Restaurar cadastro" }[lifecycle.action]) : "Movimentação";
  const lifecycleInfo = lifecycle ? ({
    MOVE_CONGREGATION: "O membro será vinculado à nova Congregação e a alteração ficará registrada no histórico.",
    INACTIVATE: "O cadastro permanecerá disponível para consulta, mas o membro ficará com situação inativa.",
    REACTIVATE: "O membro voltará à situação ativa sem perder as movimentações anteriores.",
    TRANSFER: "A transferência encerrará o vínculo ativo com esta igreja e poderá encerrar o Cargo atual.",
    DISCIPLINE: "O evento será tratado como informação sensível e poderá suspender o Cargo atual.",
    DECEASED: "O cadastro será preservado, o Cargo atual será encerrado e a data ficará no histórico.",
    ARCHIVE: "O cadastro sairá das listagens atuais, mas continuará preservado para auditoria.",
    RESTORE: "O cadastro arquivado voltará a aparecer nas listagens atuais.",
  }[lifecycle.action]) : "";
  const shortSearch = searchInput.trim().length > 0 && searchInput.trim().length < 3;

  return <>
    <S.Module>
      <S.Stats>
        <S.Stat><span><UsersRound size={19} /></span><div><strong>{stats.total}</strong><small>Total visível no escopo</small></div></S.Stat>
        <S.Stat $tone="success"><span><UserCheck size={19} /></span><div><strong>{stats.active}</strong><small>Ativos</small></div></S.Stat>
        <S.Stat $tone="warning"><span><UserRoundX size={19} /></span><div><strong>{stats.inactive}</strong><small>Inativos</small></div></S.Stat>
        <S.Stat><span><CircleUserRound size={19} /></span><div><strong>{stats.visitors}</strong><small>Visitantes</small></div></S.Stat>
        <S.Stat $tone="danger"><span><Archive size={19} /></span><div><strong>{stats.archived}</strong><small>Arquivados</small></div></S.Stat>
      </S.Stats>
      <S.Panel>
        <S.PanelHeader><div><h2>Relação de membros</h2><p>Paginação, pesquisa, filtros e ordenação executados diretamente no Supabase.</p></div><span>{result.total} registro(s)</span></S.PanelHeader>
        <S.Toolbar>
          <S.SearchField><S.Search><Search /><S.Control $withInlineStatus={shortSearch || (pending && searchInput.trim().length >= 3)} type="search" value={searchInput} onChange={search} onKeyDown={submitSearch} placeholder={capabilities.viewSensitiveIdentity ? "Nome, código ou CPF" : "Nome ou código"} />{shortSearch && <S.SearchInlineStatus role="status">Mínimo de 3 caracteres</S.SearchInlineStatus>}{pending && searchInput.trim().length >= 3 && <S.SearchInlineStatus role="status"><Loader2 /> Buscando...</S.SearchInlineStatus>}</S.Search></S.SearchField>
          <S.Select value={params.regionId} onChange={(event) => changeFilter("regionId", event.target.value)}><option value="">Todas as Regionais</option>{filters.regions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</S.Select>
          <S.Select value={params.congregationId} onChange={(event) => changeFilter("congregationId", event.target.value)}><option value="">Todas as Congregações</option>{filters.congregations.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</S.Select>
          <S.Select value={params.roleId} onChange={(event) => changeFilter("roleId", event.target.value)}><option value="">Todos os Cargos</option>{filters.roles.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</S.Select>
          <S.Select value={params.status} onChange={(event) => changeFilter("status", event.target.value)}><option value="">Todas as situações</option>{memberStatusOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</S.Select>
          <S.Select value={params.memberType} onChange={(event) => changeFilter("memberType", event.target.value)}><option value="">Todos os tipos</option>{memberTypeOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</S.Select>
          <S.Select value={params.archived ? "archived" : "current"} onChange={(event) => changeFilter("archived", event.target.value === "archived")}><option value="current">Cadastros atuais</option><option value="archived">Arquivados</option></S.Select>
          <S.Select value={params.sort} onChange={(event) => changeFilter("sort", event.target.value)}><option value="name_asc">Nome A–Z</option><option value="name_desc">Nome Z–A</option><option value="recent">Mais recentes</option><option value="oldest">Mais antigos</option><option value="code">Código</option></S.Select>
        </S.Toolbar>
        {pending ? <S.Loading><Loader2 /></S.Loading> : result.items.length === 0 ? <S.Empty><div><UsersRound size={30} /><h3>Nenhum membro encontrado</h3><p>Ajuste os filtros ou cadastre um novo membro.</p></div></S.Empty> : <>
          <S.TableWrap><S.Table><thead><tr><th>Membro</th><th>Congregação</th><th>Cargo</th><th>Tipo</th><th>Situação</th><th></th></tr></thead><tbody>{result.items.map((member) => <tr key={member.id}><td><S.Person><span>{initials(member.fullName)}</span><div><strong>{member.fullName}</strong><small>{member.memberCode || "Sem código"}</small></div></S.Person></td><td>{member.congregationName}<br /><small>{member.regionName}</small></td><td>{member.role || "—"}</td><td>{memberTypeLabels[member.memberType]}</td><td><S.Status $status={member.memberStatus}>{member.archived ? "Arquivado" : memberStatusLabels[member.memberStatus]}</S.Status></td><td><S.Actions><S.IconButton title="Ver ficha" onClick={() => setDetailsId(member.id)}><Eye /></S.IconButton>{capabilities.update && !member.archived && <Link href={`/membros/${member.id}/editar`}><S.IconButton as="span" title="Editar"><Pencil /></S.IconButton></Link>}<S.IconButton title="Outras ações" onClick={() => setMenuMember(member)}><MoreHorizontal /></S.IconButton></S.Actions></td></tr>)}</tbody></S.Table></S.TableWrap>
          <S.MobileList>{result.items.map((member) => <S.MobileCard key={member.id}><S.Person><span>{initials(member.fullName)}</span><div><strong>{member.fullName}</strong><small>{member.memberCode || "Sem código"}</small></div></S.Person><S.MobileMeta><div><span>Congregação</span><strong>{member.congregationName}</strong></div><div><span>Cargo</span><strong>{member.role || "—"}</strong></div></S.MobileMeta><S.Actions><S.IconButton onClick={() => setDetailsId(member.id)}><Eye /></S.IconButton>{capabilities.update && !member.archived && <Link href={`/membros/${member.id}/editar`}><S.IconButton as="span"><Pencil /></S.IconButton></Link>}<S.IconButton onClick={() => setMenuMember(member)}><MoreHorizontal /></S.IconButton></S.Actions></S.MobileCard>)}</S.MobileList>
        </>}
        <S.Pagination><span>Página {result.page} de {Math.max(1, result.pageCount)} · {result.total} registro(s)</span><div><S.Select value={params.pageSize} onChange={(event) => changeFilter("pageSize", Number(event.target.value))}><option value={20}>20 por página</option><option value={50}>50 por página</option><option value={100}>100 por página</option></S.Select><Button size="sm" variant="secondary" disabled={result.page <= 1 || pending} onClick={() => load({ ...params, page: params.page - 1 })}><ArrowLeft size={14} /> Anterior</Button><Button size="sm" variant="secondary" disabled={result.page >= result.pageCount || pending} onClick={() => load({ ...params, page: params.page + 1 })}>Próxima <ArrowRight size={14} /></Button></div></S.Pagination>
      </S.Panel>
    </S.Module>
    {detailsId && <MemberDetailsModal key={detailsId} memberId={detailsId} capabilities={capabilities} filters={filters} onClose={() => setDetailsId(null)} onChanged={() => void refresh()} />}
    {menuMember && <Modal open title={`Ações de ${menuMember.fullName}`} description="Movimentações preservam o histórico do membro." icon={<MoreHorizontal />} onClose={() => setMenuMember(null)}><S.Menu>{menuMember.archived ? capabilities.restore && <S.MenuButton onClick={() => beginLifecycle(menuMember, "RESTORE")}><ArchiveRestore /> Restaurar cadastro</S.MenuButton> : <>{capabilities.transfer && <S.MenuButton onClick={() => beginLifecycle(menuMember, "MOVE_CONGREGATION")}><Building2 /> Mudar Congregação</S.MenuButton>}{capabilities.changeStatus && menuMember.memberStatus !== "INACTIVE" && <S.MenuButton onClick={() => beginLifecycle(menuMember, "INACTIVATE")}><UserRoundX /> Inativar</S.MenuButton>}{capabilities.changeStatus && menuMember.memberStatus === "INACTIVE" && <S.MenuButton onClick={() => beginLifecycle(menuMember, "REACTIVATE")}><UserCheck /> Reativar</S.MenuButton>}{capabilities.transfer && <S.MenuButton onClick={() => beginLifecycle(menuMember, "TRANSFER")}><Church /> Transferir para outra igreja</S.MenuButton>}{capabilities.changeStatus && <S.MenuButton onClick={() => beginLifecycle(menuMember, "DISCIPLINE")}><ShieldAlert /> Disciplina</S.MenuButton>}{capabilities.changeStatus && <S.MenuButton onClick={() => beginLifecycle(menuMember, "DECEASED")}><UserRoundX /> Falecimento</S.MenuButton>}{capabilities.archive && <S.MenuButton onClick={() => beginLifecycle(menuMember, "ARCHIVE")}><Archive /> Arquivar</S.MenuButton>}</>}</S.Menu></Modal>}
    {lifecycle && <Modal open title={title} description="A operação será registrada no histórico eclesiástico." icon={<Church />} size="lg" onClose={() => setLifecycle(null)} busy={busy} footer={<S.ModalFooter><span /><div><Button variant="outline" onClick={() => setLifecycle(null)} disabled={busy}>Cancelar</Button><Button type="submit" form={lifecycleFormId} loading={busy}>{busy ? "Salvando..." : "Confirmar movimentação"}</Button></div></S.ModalFooter>}><S.ActionForm id={lifecycleFormId} onSubmit={submitLifecycle}><S.FormIntro>{lifecycleInfo}</S.FormIntro><S.FieldGrid><S.Field><span>Data do evento *</span><S.Control name="eventDate" type="date" required defaultValue={lifecycle.eventDate} max={new Date().toISOString().slice(0, 10)} /></S.Field>{lifecycle.action === "MOVE_CONGREGATION" && <S.Field><span>Nova Congregação *</span><S.Select name="targetCongregationId" required defaultValue=""><option value="">Selecione</option>{filters.congregations.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</S.Select></S.Field>}{lifecycle.action === "TRANSFER" && <S.Field><span>Igreja de destino *</span><S.Control name="destinationChurch" required placeholder="Nome da igreja de destino" /></S.Field>}{!["ARCHIVE", "RESTORE"].includes(lifecycle.action) && <S.Field $span={2}><span>Motivo ou observação{requiresReason ? " *" : ""}</span><S.Textarea name="reason" required={Boolean(requiresReason)} placeholder="Descreva o motivo desta movimentação" /></S.Field>}{["TRANSFER", "DISCIPLINE"].includes(lifecycle.action) && <S.CheckField $span={2}><Checkbox id="endRoles" name="endRoles" defaultChecked label={lifecycle.action === "DISCIPLINE" ? "Suspender Cargo atual" : "Encerrar Cargo atual"} /></S.CheckField>}</S.FieldGrid></S.ActionForm></Modal>}
    {notice && <ToastViewport><Toast title={notice.title} description={notice.description} variant={notice.variant} onClose={() => setNotice(null)} /></ToastViewport>}
  </>;
}
