"use client";

import { useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  CalendarCheck,
  CalendarDays,
  CirclePlay,
  EllipsisVertical,
  ExternalLink,
  Eye,
  LoaderCircle,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  SearchX,
  SendToBack,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Toast, ToastViewport } from "@/components/ui/toast";
import type { EventListData, EventSummary } from "../types/event.types";
import { EVENT_REGISTRATION_STATUSES, EVENT_STATUSES, EVENT_TYPES, eventLabel } from "../constants/events";
import {
  changeEventDeletionStateAction,
  changeEventLifecycleAction,
  permanentlyDeleteEventAction,
} from "../actions/event.actions";
import { positionAnchoredMenu } from "../utils/menu-position";
import * as S from "./events.styles";

type Props = { data: EventListData; canManage: boolean; canPublish: boolean };
type LifecycleOption = { action: string; label: string; danger?: boolean };
type CatalogMenuState = {
  id: string;
  anchorLeft: number;
  anchorRight: number;
  anchorTop: number;
  anchorBottom: number;
  left?: number;
  top?: number;
};
type Confirmation =
  | { kind: "trash"; event: EventSummary }
  | { kind: "permanent"; event: EventSummary }
  | { kind: "lifecycle"; event: EventSummary; option: LifecycleOption };

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value));
}

function tone(status: string): "success" | "warning" | "danger" | "neutral" {
  if (status === "IN_PROGRESS") return "success";
  if (["DRAFT", "PUBLISHED"].includes(status)) return "warning";
  if (status === "CANCELLED") return "danger";
  return "neutral";
}

function lifecycleOptions(event: EventSummary): LifecycleOption[] {
  if (["FINISHED", "CANCELLED"].includes(event.status)) return [];
  const options: LifecycleOption[] = [];
  if (event.status === "DRAFT") options.push({ action: "PUBLISH", label: "Publicar evento" });
  if (["PUBLISHED", "IN_PROGRESS"].includes(event.status)) options.push(event.registrationStatus === "OPEN"
    ? { action: "CLOSE_REGISTRATION", label: "Encerrar inscrições" }
    : { action: event.registrationsOpenedAt ? "REOPEN_REGISTRATION" : "OPEN_REGISTRATION", label: "Abrir inscrições" });
  if (event.status === "PUBLISHED") options.push({ action: "START", label: "Iniciar evento" });
  if (event.status === "IN_PROGRESS" && event.registrationStatus === "CLOSED") options.push({ action: "FINISH", label: "Finalizar evento" });
  if (event.registrationStatus === "CLOSED") options.push({ action: "CANCEL", label: "Cancelar evento", danger: true });
  return options;
}

export function EventCatalog({ data, canManage, canPublish }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const current = useSearchParams();
  const currentQuery = current.toString();
  const selectedStatus = current.get("status") || "OPEN";
  const [menu, setMenu] = useState<CatalogMenuState | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState<{ message: string; danger?: boolean } | null>(null);
  const [pending, startTransition] = useTransition();
  const [filterPending, startFilterTransition] = useTransition();
  const [searchValue, setSearchValue] = useState(current.get("search") ?? "");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (event?: Event) => {
      if (event instanceof MouseEvent && menuRef.current?.contains(event.target as Node)) return;
      setMenu(null);
    };
    const closeWhenHidden = () => { if (document.visibilityState !== "visible") setMenu(null); };
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("popstate", close);
    window.addEventListener("pagehide", close);
    window.addEventListener("pageshow", close);
    window.addEventListener("mousedown", close);
    document.addEventListener("visibilitychange", closeWhenHidden);
    return () => {
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("popstate", close);
      window.removeEventListener("pagehide", close);
      window.removeEventListener("pageshow", close);
      window.removeEventListener("mousedown", close);
      document.removeEventListener("visibilitychange", closeWhenHidden);
    };
  }, []);

  useLayoutEffect(() => {
    if (!menu || !menuRef.current) return;
    const menuRect = menuRef.current.getBoundingClientRect();
    const { left, top } = positionAnchoredMenu(
      { left: menu.anchorLeft, right: menu.anchorRight, top: menu.anchorTop, bottom: menu.anchorBottom },
      { width: menuRect.width, height: menuRect.height },
      { width: window.innerWidth, height: window.innerHeight },
    );
    if (menu.left === left && menu.top === top) return;
    setMenu((currentMenu) => currentMenu?.id === menu.id ? { ...currentMenu, left, top } : currentMenu);
  }, [menu]);

  useEffect(() => {
    const normalized = searchValue.trim();
    if (normalized.length > 0 && normalized.length < 3) return;
    if (normalized === (current.get("search") ?? "")) return;
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(currentQuery);
      if (normalized) params.set("search", normalized);
      else params.delete("search");
      params.delete("page");
      startFilterTransition(() => router.replace(`${pathname}?${params}`, { scroll: false }));
    }, 400);
    return () => window.clearTimeout(timer);
  }, [current, currentQuery, pathname, router, searchValue]);

  function updateFilter(name: "status" | "type", nextValue: string) {
    setMenu(null);
    const params = new URLSearchParams(currentQuery);
    if (nextValue) params.set(name, nextValue);
    else params.delete(name);
    params.delete("page");
    startFilterTransition(() => router.replace(`${pathname}?${params}`, { scroll: false }));
  }

  function filter(status: string) {
    updateFilter("status", status);
  }

  function resetFilters() {
    setMenu(null);
    setSearchValue("");
    const params = new URLSearchParams(currentQuery);
    params.delete("search");
    params.delete("status");
    params.delete("type");
    params.delete("page");
    const query = params.toString();
    startFilterTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  }

  function ask(next: Confirmation) {
    setMenu(null);
    setReason("");
    setConfirmation(next);
  }

  function openPublicPage(event: EventSummary) {
    setMenu(null);
    if (!event.slug) {
      setNotice({ message: "Defina o link amigável do evento antes de abrir a página pública.", danger: true });
      return;
    }
    if (event.visibility !== "PUBLIC") {
      setNotice({ message: "Altere a visibilidade do evento para Pública antes de abrir a página de inscrições.", danger: true });
      return;
    }
    if (!["PUBLISHED", "IN_PROGRESS", "FINISHED"].includes(event.status)) {
      setNotice({ message: event.status === "DRAFT" ? "Publique o evento antes de abrir a página pública." : "A página pública não fica disponível para eventos cancelados.", danger: true });
      return;
    }
    window.open(`/inscricoes/${event.publicCode}/${event.slug}`, "_blank", "noopener,noreferrer");
  }

  function restore(eventId: string) {
    setMenu(null);
    startTransition(async () => {
      const result = await changeEventDeletionStateAction(eventId, "RESTORE");
      setNotice({ message: result.message, danger: result.status === "error" });
      if (result.status === "success") router.refresh();
    });
  }

  function confirmAction() {
    if (!confirmation) return;
    startTransition(async () => {
      const result = confirmation.kind === "permanent"
        ? await permanentlyDeleteEventAction(confirmation.event.id)
        : confirmation.kind === "trash"
          ? await changeEventDeletionStateAction(confirmation.event.id, "DELETE")
          : await changeEventLifecycleAction({ eventId: confirmation.event.id, action: confirmation.option.action, reason });
      setNotice({ message: result.message, danger: result.status === "error" });
      if (result.status === "success") {
        setConfirmation(null);
        setReason("");
        router.refresh();
      }
    });
  }

  const selected = menu ? data.events.find((event) => event.id === menu.id) ?? null : null;
  const lifecycle = selected && canPublish ? lifecycleOptions(selected) : [];
  const modalTitle = confirmation?.kind === "permanent" ? "Excluir evento definitivamente" : confirmation?.kind === "trash" ? "Enviar evento para a lixeira" : confirmation?.option.label ?? "Confirmar ação";
  const modalDescription = confirmation?.kind === "permanent"
    ? "Esta ação apaga o evento, inscrições, pagamentos, itens, documentos e demais vínculos. Não será possível recuperar os dados."
    : confirmation?.kind === "trash"
      ? "O rascunho será movido para a lixeira e poderá ser restaurado antes da exclusão definitiva."
      : confirmation?.option.action === "CANCEL"
        ? "O evento será cancelado e o histórico permanecerá preservado. Informe o motivo para continuar."
        : "Confirme a alteração da situação do evento.";
  const requiresReason = confirmation?.kind === "lifecycle" && confirmation.option.action === "CANCEL";
  const destructive = confirmation?.kind === "permanent" || confirmation?.kind === "trash" || confirmation?.kind === "lifecycle" && confirmation.option.danger;
  const hasFilters = Boolean(searchValue || current.get("status") || current.get("type"));

  return (
    <S.Module>
      <PageHeader title="Eventos" subtitle="Planeje, publique e acompanhe inscrições, pagamentos e presença." action={canManage ? <Link href="/eventos/novo" className="app-button-primary"><Plus size={17} />Novo evento</Link> : undefined} />
      <S.Stats>
        <StatCard title="Próximos" value={String(data.stats.upcoming)} description="Agendados" icon={CalendarDays} />
        <StatCard title="Inscrições abertas" value={String(data.stats.open)} description="Recebendo participantes" icon={CalendarCheck} />
        <StatCard title="Em andamento" value={String(data.events.filter((event) => event.status === "IN_PROGRESS").length)} description="Operação ativa" icon={CirclePlay} />
        <StatCard title="Finalizados" value={String(data.stats.finished)} description="Histórico preservado" icon={CalendarCheck} />
      </S.Stats>
      <S.Filters>
        <S.Field><span>Pesquisar</span><S.FilterSearch aria-busy={filterPending}><Search aria-hidden="true" /><input name="search" value={searchValue} onChange={(event) => setSearchValue(event.target.value)} placeholder="Digite ao menos 3 caracteres" />{filterPending ? <LoaderCircle data-loading aria-label="Atualizando eventos" /> : null}</S.FilterSearch></S.Field>
        <S.Field><span>Situação</span><select name="status" value={selectedStatus} onChange={(event) => updateFilter("status", event.target.value)}><option value="OPEN">Inscrições abertas</option><option value="ALL">Todas</option>{EVENT_STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></S.Field>
        <S.Field><span>Tipo</span><select name="type" value={current.get("type") ?? ""} onChange={(event) => updateFilter("type", event.target.value)}><option value="">Todos</option>{EVENT_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></S.Field>
        <S.FilterActions><S.ResetFilterButton type="button" aria-label="Limpar filtros" title="Limpar filtros" disabled={!hasFilters} onClick={resetFilters}><RotateCcw /></S.ResetFilterButton></S.FilterActions>
      </S.Filters>
      <S.Tabs aria-label="Filtros rápidos">
        <button type="button" aria-current={selectedStatus === "ALL" ? "page" : undefined} onClick={() => filter("ALL")}>Todos</button>
        {["OPEN", "IN_PROGRESS", "FINISHED", "CANCELLED", "DELETED"].map((status) => <button key={status} type="button" aria-current={selectedStatus === status ? "page" : undefined} onClick={() => filter(status)}>{status === "DELETED" ? "Lixeira" : status === "OPEN" ? "Inscrições abertas" : eventLabel(EVENT_STATUSES, status)}</button>)}
      </S.Tabs>
      {data.events.length === 0 ? <S.Empty><div><SearchX /><h3>Nenhum evento encontrado</h3><p>Ajuste os filtros ou crie um novo rascunho para começar.</p></div></S.Empty> : (
        <S.TableWrap><table><thead><tr><th>Evento</th><th>Data e local</th><th>Inscrição</th><th>Ocupação</th><th>Situação</th><th><span className="sr-only">Ações</span></th></tr></thead><tbody>
          {data.events.map((event) => { const percent = event.capacity ? Math.min(100, Math.round((event.occupied / event.capacity) * 100)) : 0; return <tr key={event.id}>
            <td><S.EventName><span><CalendarDays size={18} /></span><div><strong>{event.name}</strong><small>{eventLabel(EVENT_TYPES, event.eventType)}</small></div></S.EventName></td>
            <td><strong>{formatDate(event.startsAt)}</strong><br /><small>{[event.location, event.city, event.state].filter(Boolean).join(" · ") || "Local a definir"}</small></td>
            <td><S.StatusDot $tone={event.registrationStatus === "OPEN" ? "success" : "neutral"}>{eventLabel(EVENT_REGISTRATION_STATUSES, event.registrationStatus)}</S.StatusDot></td>
            <td><S.Progress><span><i style={{ width: `${percent}%` }} /></span><small>{event.occupied}{event.capacity ? ` de ${event.capacity}` : " inscritos"}</small></S.Progress></td>
            <td><S.StatusDot $tone={tone(event.status)}>{eventLabel(EVENT_STATUSES, event.status)}</S.StatusDot></td>
            <td><S.ActionButton type="button" aria-label={`Ações de ${event.name}`} aria-haspopup="menu" aria-expanded={menu?.id === event.id} onClick={(click) => { const rect = click.currentTarget.getBoundingClientRect(); setMenu((opened) => opened?.id === event.id ? null : { id: event.id, anchorLeft: rect.left, anchorRight: rect.right, anchorTop: rect.top, anchorBottom: rect.bottom }); }}><EllipsisVertical /></S.ActionButton></td>
          </tr>; })}
        </tbody></table></S.TableWrap>
      )}
      {data.total > data.pageSize ? <S.HeaderActions aria-label="Paginação"><button className="app-button-secondary" disabled={data.page <= 1} onClick={() => { setMenu(null); const params = new URLSearchParams(currentQuery); params.set("page", String(data.page - 1)); router.push(`${pathname}?${params}`); }}>Anterior</button><span>Página {data.page} de {Math.ceil(data.total / data.pageSize)}</span><button className="app-button-secondary" disabled={data.page >= Math.ceil(data.total / data.pageSize)} onClick={() => { setMenu(null); const params = new URLSearchParams(currentQuery); params.set("page", String(data.page + 1)); router.push(`${pathname}?${params}`); }}>Próxima</button></S.HeaderActions> : null}
      {menu && selected && typeof document !== "undefined" ? createPortal(
        <S.Menu ref={menuRef} role="menu" style={{ left: menu.left ?? menu.anchorLeft, top: menu.top ?? menu.anchorBottom + 4, visibility: menu.left === undefined ? "hidden" : "visible" }}>
          {selected.deletedAt ? <><button role="menuitem" onClick={() => restore(selected.id)} disabled={pending}><RotateCcw />Restaurar da lixeira</button><button role="menuitem" data-danger onClick={() => ask({ kind: "permanent", event: selected })}><Trash2 />Excluir definitivamente</button></> : <>
            <button role="menuitem" onClick={() => openPublicPage(selected)}><ExternalLink />Abrir página pública de evento</button>
            <Link role="menuitem" href={`/eventos/${selected.id}`} onClick={() => setMenu(null)}><Eye />Abrir workspace</Link>
            {canManage ? <Link role="menuitem" href={`/eventos/${selected.id}/editar`} onClick={() => setMenu(null)}><Pencil />Editar evento</Link> : null}
            {lifecycle.map((option) => <button key={option.action} role="menuitem" data-danger={option.danger || undefined} onClick={() => ask({ kind: "lifecycle", event: selected, option })}>{option.action === "START" ? <CirclePlay /> : option.action === "CANCEL" ? <Trash2 /> : <CalendarCheck />}{option.label}</button>)}
            {canManage && selected.status === "DRAFT" ? <button role="menuitem" data-danger onClick={() => ask({ kind: "trash", event: selected })}><SendToBack />Enviar para a lixeira</button> : null}
          </>}
        </S.Menu>, document.body) : null}
      {confirmation ? <Modal className="event-modal" open size="sm" title={modalTitle} description={modalDescription} icon={destructive ? <Trash2 /> : <CalendarCheck />} onClose={() => setConfirmation(null)} busy={pending} footer={<><Button variant="outline" onClick={() => setConfirmation(null)} disabled={pending}>Voltar</Button><Button variant={destructive ? "danger" : "primary"} onClick={confirmAction} loading={pending} disabled={requiresReason && reason.trim().length < 3}>{confirmation.kind === "permanent" ? "Excluir definitivamente" : "Confirmar"}</Button></>}>
        <S.DeleteWarning>Evento selecionado: <strong>{confirmation.event.name}</strong></S.DeleteWarning>
        {requiresReason ? <S.Field style={{ marginTop: 14 }}><span>Motivo do cancelamento *</span><textarea data-autofocus value={reason} onChange={(change) => setReason(change.target.value)} maxLength={1000} placeholder="Descreva o motivo" /></S.Field> : null}
      </Modal> : null}
      <ToastViewport>{notice ? <Toast title={notice.danger ? "Ação não concluída" : "Tudo certo"} description={notice.message} variant={notice.danger ? "danger" : "success"} onClose={() => setNotice(null)} /> : null}</ToastViewport>
    </S.Module>
  );
}
