"use client";

import { useEffect, useRef, useState, useTransition } from "react";
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
  Pencil,
  Plus,
  RotateCcw,
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
import { EVENT_STATUSES, EVENT_TYPES, eventLabel } from "../constants/events";
import {
  changeEventDeletionStateAction,
  changeEventLifecycleAction,
  permanentlyDeleteEventAction,
} from "../actions/event.actions";
import * as S from "./events.styles";

type Props = { data: EventListData; canManage: boolean; canPublish: boolean };
type LifecycleOption = { action: string; label: string; danger?: boolean };
type Confirmation =
  | { kind: "trash"; event: EventSummary }
  | { kind: "permanent"; event: EventSummary }
  | { kind: "lifecycle"; event: EventSummary; option: LifecycleOption };

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value));
}

function tone(status: string): "success" | "warning" | "danger" | "neutral" {
  if (["REGISTRATION_OPEN", "IN_PROGRESS"].includes(status)) return "success";
  if (["DRAFT", "PUBLISHED", "REGISTRATION_CLOSED"].includes(status)) return "warning";
  if (status === "CANCELLED") return "danger";
  return "neutral";
}

function lifecycleOptions(status: string): LifecycleOption[] {
  const byStatus: Record<string, LifecycleOption[]> = {
    DRAFT: [{ action: "PUBLISH", label: "Publicar evento" }],
    PUBLISHED: [{ action: "OPEN_REGISTRATION", label: "Abrir inscrições" }, { action: "START", label: "Iniciar evento" }],
    REGISTRATION_OPEN: [{ action: "CLOSE_REGISTRATION", label: "Encerrar inscrições" }, { action: "START", label: "Iniciar evento" }],
    REGISTRATION_CLOSED: [{ action: "REOPEN_REGISTRATION", label: "Reabrir inscrições" }, { action: "START", label: "Iniciar evento" }],
    IN_PROGRESS: [{ action: "FINISH", label: "Finalizar evento" }],
  };
  const options = byStatus[status] ?? [];
  return ["FINISHED", "CANCELLED"].includes(status) ? options : [...options, { action: "CANCEL", label: "Cancelar evento", danger: true }];
}

export function EventCatalog({ data, canManage, canPublish }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const current = useSearchParams();
  const currentQuery = current.toString();
  const [menu, setMenu] = useState<{ id: string; left: number; top: number } | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState<{ message: string; danger?: boolean } | null>(null);
  const [pending, startTransition] = useTransition();
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

  function filter(status: string) {
    setMenu(null);
    const params = new URLSearchParams(currentQuery);
    if (status) params.set("status", status);
    else params.delete("status");
    params.delete("page");
    router.push(`${pathname}?${params}`);
  }

  function ask(next: Confirmation) {
    setMenu(null);
    setReason("");
    setConfirmation(next);
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
  const lifecycle = selected && canPublish ? lifecycleOptions(selected.status) : [];
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

  return (
    <S.Module>
      <PageHeader title="Eventos" subtitle="Planeje, publique e acompanhe inscrições, pagamentos e presença." action={canManage ? <Link href="/eventos/novo" className="app-button-primary"><Plus size={17} />Novo evento</Link> : undefined} />
      <S.Stats>
        <StatCard title="Próximos" value={String(data.stats.upcoming)} description="Agendados" icon={CalendarDays} />
        <StatCard title="Inscrições abertas" value={String(data.stats.open)} description="Recebendo participantes" icon={CalendarCheck} />
        <StatCard title="Em andamento" value={String(data.events.filter((event) => event.status === "IN_PROGRESS").length)} description="Operação ativa" icon={CirclePlay} />
        <StatCard title="Finalizados" value={String(data.stats.finished)} description="Histórico preservado" icon={CalendarCheck} />
      </S.Stats>
      <S.Filters action="/eventos">
        <S.Field><span>Pesquisar</span><input name="search" defaultValue={current.get("search") ?? ""} placeholder="Nome, cidade ou local" /></S.Field>
        <S.Field><span>Situação</span><select name="status" defaultValue={current.get("status") ?? ""}><option value="">Todas</option>{EVENT_STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></S.Field>
        <S.Field><span>Tipo</span><select name="type" defaultValue={current.get("type") ?? ""}><option value="">Todos</option>{EVENT_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></S.Field>
        <button className="app-button-secondary" type="submit">Filtrar</button>
      </S.Filters>
      <S.Tabs aria-label="Filtros rápidos">
        <button type="button" aria-current={!current.get("status") ? "page" : undefined} onClick={() => filter("")}>Todos</button>
        {["REGISTRATION_OPEN", "IN_PROGRESS", "FINISHED", "CANCELLED", "DELETED"].map((status) => <button key={status} type="button" aria-current={current.get("status") === status ? "page" : undefined} onClick={() => filter(status)}>{status === "DELETED" ? "Lixeira" : eventLabel(EVENT_STATUSES, status)}</button>)}
      </S.Tabs>
      {data.events.length === 0 ? <S.Empty><div><SearchX /><h3>Nenhum evento encontrado</h3><p>Ajuste os filtros ou crie um novo rascunho para começar.</p></div></S.Empty> : (
        <S.TableWrap><table><thead><tr><th>Evento</th><th>Data e local</th><th>Inscrição</th><th>Ocupação</th><th>Situação</th><th><span className="sr-only">Ações</span></th></tr></thead><tbody>
          {data.events.map((event) => { const percent = event.capacity ? Math.min(100, Math.round((event.occupied / event.capacity) * 100)) : 0; return <tr key={event.id}>
            <td><S.EventName><span><CalendarDays size={18} /></span><div><strong>{event.name}</strong><small>{eventLabel(EVENT_TYPES, event.eventType)}</small></div></S.EventName></td>
            <td><strong>{formatDate(event.startsAt)}</strong><br /><small>{[event.location, event.city, event.state].filter(Boolean).join(" · ") || "Local a definir"}</small></td>
            <td>{event.registrationEndsAt ? `Até ${formatDate(event.registrationEndsAt)}` : "Sem prazo definido"}</td>
            <td><S.Progress><span><i style={{ width: `${percent}%` }} /></span><small>{event.occupied}{event.capacity ? ` de ${event.capacity}` : " inscritos"}</small></S.Progress></td>
            <td><S.StatusDot $tone={tone(event.status)}>{eventLabel(EVENT_STATUSES, event.status)}</S.StatusDot></td>
            <td><S.ActionButton type="button" aria-label={`Ações de ${event.name}`} aria-haspopup="menu" aria-expanded={menu?.id === event.id} onClick={(click) => { const rect = click.currentTarget.getBoundingClientRect(); setMenu((opened) => opened?.id === event.id ? null : { id: event.id, left: Math.max(8, rect.right - 230), top: Math.max(8, Math.min(window.innerHeight - 320, rect.bottom + 4)) }); }}><EllipsisVertical /></S.ActionButton></td>
          </tr>; })}
        </tbody></table></S.TableWrap>
      )}
      {data.total > data.pageSize ? <S.HeaderActions aria-label="Paginação"><button className="app-button-secondary" disabled={data.page <= 1} onClick={() => { setMenu(null); const params = new URLSearchParams(currentQuery); params.set("page", String(data.page - 1)); router.push(`${pathname}?${params}`); }}>Anterior</button><span>Página {data.page} de {Math.ceil(data.total / data.pageSize)}</span><button className="app-button-secondary" disabled={data.page >= Math.ceil(data.total / data.pageSize)} onClick={() => { setMenu(null); const params = new URLSearchParams(currentQuery); params.set("page", String(data.page + 1)); router.push(`${pathname}?${params}`); }}>Próxima</button></S.HeaderActions> : null}
      {menu && selected && typeof document !== "undefined" ? createPortal(
        <S.Menu ref={menuRef} role="menu" style={{ left: menu.left, top: menu.top }}>
          {selected.deletedAt ? <><button role="menuitem" onClick={() => restore(selected.id)} disabled={pending}><RotateCcw />Restaurar da lixeira</button><button role="menuitem" data-danger onClick={() => ask({ kind: "permanent", event: selected })}><Trash2 />Excluir definitivamente</button></> : <>
            {selected.visibility === "PUBLIC" && selected.slug && !["DRAFT", "CANCELLED"].includes(selected.status) ? <a role="menuitem" href={`/inscricoes/${selected.publicCode}/${selected.slug}`} target="_blank" rel="noreferrer" onClick={() => setMenu(null)}><ExternalLink />Abrir página pública</a> : null}
            <Link role="menuitem" href={`/eventos/${selected.id}`} onClick={() => setMenu(null)}><Eye />Abrir workspace</Link>
            {canManage ? <Link role="menuitem" href={`/eventos/${selected.id}/editar`} onClick={() => setMenu(null)}><Pencil />Editar evento</Link> : null}
            {lifecycle.map((option) => <button key={option.action} role="menuitem" data-danger={option.danger || undefined} onClick={() => ask({ kind: "lifecycle", event: selected, option })}>{option.action === "START" ? <CirclePlay /> : option.action === "CANCEL" ? <Trash2 /> : <CalendarCheck />}{option.label}</button>)}
            {canManage && selected.status === "DRAFT" ? <button role="menuitem" data-danger onClick={() => ask({ kind: "trash", event: selected })}><SendToBack />Enviar para a lixeira</button> : null}
          </>}
        </S.Menu>, document.body) : null}
      {confirmation ? <Modal open size="sm" title={modalTitle} description={modalDescription} icon={destructive ? <Trash2 /> : <CalendarCheck />} onClose={() => setConfirmation(null)} busy={pending} footer={<><Button variant="outline" onClick={() => setConfirmation(null)} disabled={pending}>Voltar</Button><Button variant={destructive ? "danger" : "primary"} onClick={confirmAction} loading={pending} disabled={requiresReason && reason.trim().length < 3}>{confirmation.kind === "permanent" ? "Excluir definitivamente" : "Confirmar"}</Button></>}>
        <S.DeleteWarning>Evento selecionado: <strong>{confirmation.event.name}</strong></S.DeleteWarning>
        {requiresReason ? <S.Field style={{ marginTop: 14 }}><span>Motivo do cancelamento *</span><textarea data-autofocus value={reason} onChange={(change) => setReason(change.target.value)} maxLength={1000} placeholder="Descreva o motivo" /></S.Field> : null}
      </Modal> : null}
      <ToastViewport>{notice ? <Toast title={notice.danger ? "Ação não concluída" : "Tudo certo"} description={notice.message} variant={notice.danger ? "danger" : "success"} onClose={() => setNotice(null)} /> : null}</ToastViewport>
    </S.Module>
  );
}
