"use client";

import { type FormEvent, type ReactNode, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BadgeDollarSign,
  BedDouble,
  Bus,
  CalendarCheck,
  CreditCard,
  Download,
  EllipsisVertical,
  Eye,
  FileText,
  FileUp,
  Gift,
  LoaderCircle,
  Plus,
  QrCode as QrCodeIcon,
  ReceiptText,
  Search,
  Shirt,
  Ticket,
  Trash2,
  UploadCloud,
  UserRound,
  Users,
  UtensilsCrossed,
  WalletCards,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { Toast, ToastViewport } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { PERMISSIONS } from "@/modules/auth/constants/permissions";
import { formatBrazilCurrencyInput, formatBrazilPhone, parseBrazilCurrencyInput } from "@/utils/input-masks";
import {
  archiveEventConfigurationAction,
  cancelEventGroupAction,
  cancelRegistrationAction,
  createEventGroupAction,
  createRegistrationAction,
  deleteEventDocumentAction,
  deletePaymentAction,
  finalizeEventDocumentAction,
  getEventDocumentUrlAction,
  getPaymentReceiptUrlAction,
  prepareEventDocumentAction,
  preparePaymentReceiptAction,
  recordPaymentAction,
  reissueQrAction,
  saveEventItemAction,
  saveEventQuotaAction,
  searchEventMembersAction,
} from "../actions/event.actions";
import {
  EVENT_DOCUMENT_ACCEPT,
  EVENT_STATUSES,
  EVENT_TYPES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  REGISTRATION_STATUSES,
  eventLabel,
} from "../constants/events";
import type { ActionResult, EventItemRow, EventMemberReference, EventWorkspaceData, RegistrationRow } from "../types/event.types";
import * as S from "./events.styles";
import { QrCode } from "./qr-code";

type ModalKind = "registration" | "group" | "item" | "quota" | "document" | null;
type RegistrationModal = { kind: "details" | "payment"; registration: RegistrationRow } | null;
type Confirmation =
  | { kind: "group"; id: string; label: string }
  | { kind: "item"; id: string; label: string }
  | { kind: "quota"; id: string; label: string }
  | { kind: "document"; id: string; label: string }
  | { kind: "registration"; registration: RegistrationRow }
  | { kind: "payment"; id: string; label: string };

function money(value: number) { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value); }
function formatDate(value: string) { return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value)); }
function statusTone(status: string): "success" | "warning" | "danger" | "neutral" { if (["CONFIRMED", "PAID", "CHECKED_IN", "ACTIVE"].includes(status)) return "success"; if (["PENDING", "PARTIAL"].includes(status)) return "warning"; if (["CANCELLED", "FAILED", "EXPIRED"].includes(status)) return "danger"; return "neutral"; }
function percentage(current: number, target: number) { return target > 0 ? Math.round((current / target) * 100) : 0; }

const itemIcons: Record<string, typeof Ticket> = {
  REGISTRATION: Ticket, SHIRT: Shirt, FOOD: UtensilsCrossed, LODGING: BedDouble,
  TRANSPORT: Bus, KIT: Gift, DONATION: Gift, OTHER: Ticket,
};

function Section({ title, action, children }: { title: string; description?: string; action?: ReactNode; children: ReactNode }) {
  return <S.Section><S.Toolbar><div><h2>{title}</h2></div><div>{action}</div></S.Toolbar>{children}</S.Section>;
}

function Empty({ title, text, icon = <Users /> }: { title: string; text: string; icon?: ReactNode }) {
  return <S.Empty><div>{icon}<h3>{title}</h3><p>{text}</p></div></S.Empty>;
}

function groupRegistrations(rows: RegistrationRow[], field: "regionName" | "congregationName") {
  const values = new Map<string, number>();
  for (const registration of rows) {
    if (["CANCELLED", "EXPIRED"].includes(registration.status)) continue;
    const label = registration[field] || (field === "regionName" ? "Sem regional" : "Sem congregação");
    values.set(label, (values.get(label) ?? 0) + 1);
  }
  return [...values.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((first, second) => second.value - first.value || first.label.localeCompare(second.label, "pt-BR"));
}

function RegistrationChart({ title, rows }: { title: string; rows: { label: string; value: number }[] }) {
  const highest = Math.max(1, ...rows.map((row) => row.value));
  return (
    <S.ChartCard>
      <header><span><Users /></span><h3>{title}</h3></header>
      {rows.length ? (
        <S.ChartRows>
          {rows.map((row) => (
            <div key={row.label}>
              <span><strong>{row.label}</strong><b>{row.value}</b></span>
              <i><em style={{ width: `${Math.max(5, (row.value / highest) * 100)}%` }} /></i>
            </div>
          ))}
        </S.ChartRows>
      ) : (
        <S.ChartEmpty>Nenhuma inscrição disponível para compor este gráfico.</S.ChartEmpty>
      )}
    </S.ChartCard>
  );
}

export function EventWorkspace({ initial }: { initial: EventWorkspaceData }) {
  const router = useRouter();
  const [active, setActive] = useState("overview");
  const [modal, setModal] = useState<ModalKind>(null);
  const [registrationModal, setRegistrationModal] = useState<RegistrationModal>(null);
  const [credential, setCredential] = useState<{ token: string; number: string } | null>(null);
  const [notice, setNotice] = useState<{ message: string; danger?: boolean } | null>(null);
  const [pending, startTransition] = useTransition();
  const [menu, setMenu] = useState<{ registrationId: string; left: number; top: number } | null>(null);
  const [registrationRegion, setRegistrationRegion] = useState("");
  const [registrationCongregation, setRegistrationCongregation] = useState("");
  const [registrationGender, setRegistrationGender] = useState("");
  const [registrationItem, setRegistrationItem] = useState("");
  const [registrationPaymentMethod, setRegistrationPaymentMethod] = useState("");
  const [registrationSearch, setRegistrationSearch] = useState("");
  const [registrationStatus, setRegistrationStatus] = useState("");
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [confirmationReason, setConfirmationReason] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const event = initial.event;
  const can = (permission: string) => initial.permissions.includes(permission);
  const received = initial.payments.filter((payment) => payment.status === "CONFIRMED").reduce((sum, payment) => sum + payment.amount, 0);

  const filteredRegistrationCongregations = useMemo(
    () => initial.references.congregations.filter((item) => !registrationRegion || item.regionId === registrationRegion),
    [initial.references.congregations, registrationRegion],
  );
  const filteredRegistrations = useMemo(
    () => initial.registrations.filter((registration) => {
      if (registrationSearch.trim() && !registration.participantName.toLocaleLowerCase("pt-BR").includes(registrationSearch.trim().toLocaleLowerCase("pt-BR"))) return false;
      if (registrationStatus && registration.status !== registrationStatus) return false;
      if (registrationRegion && registration.regionId !== registrationRegion) return false;
      if (registrationCongregation && registration.congregationId !== registrationCongregation) return false;
      if (registrationGender && registration.participantGender !== registrationGender) return false;
      if (registrationItem && !registration.itemIds.includes(registrationItem)) return false;
      if (registrationPaymentMethod && registration.preferredPaymentMethod !== registrationPaymentMethod) return false;
      return true;
    }),
    [initial.registrations, registrationCongregation, registrationGender, registrationItem, registrationPaymentMethod, registrationRegion, registrationSearch, registrationStatus],
  );
  const regionalChart = useMemo(() => groupRegistrations(initial.registrations, "regionName"), [initial.registrations]);
  const congregationChart = useMemo(() => groupRegistrations(initial.registrations, "congregationName"), [initial.registrations]);
  const hasRegistrationFilters = Boolean(registrationSearch || registrationStatus || registrationRegion || registrationCongregation || registrationGender || registrationItem || registrationPaymentMethod);

  useEffect(() => {
    const close = (event?: Event) => {
      if (event instanceof MouseEvent && menuRef.current?.contains(event.target as Node)) return;
      setMenu(null);
    };
    const closeWhenHidden = () => {
      if (document.visibilityState !== "visible") setMenu(null);
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("popstate", close);
    window.addEventListener("pagehide", close);
    window.addEventListener("pageshow", close);
    document.addEventListener("visibilitychange", closeWhenHidden);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("popstate", close);
      window.removeEventListener("pagehide", close);
      window.removeEventListener("pageshow", close);
      document.removeEventListener("visibilitychange", closeWhenHidden);
    };
  }, []);

  function execute(task: () => Promise<ActionResult>, closeModal = true, onSuccess?: () => void) {
    startTransition(async () => {
      const result = await task();
      setNotice({ message: result.message, danger: result.status === "error" });
      if (result.status === "success") {
        if (closeModal) { setModal(null); setRegistrationModal(null); }
        onSuccess?.();
        router.refresh();
      }
    });
  }

  function askConfirmation(next: Confirmation) {
    setMenu(null);
    setConfirmationReason("");
    setConfirmation(next);
  }

  function confirmWorkspaceAction() {
    if (!confirmation) return;
    const task = confirmation.kind === "group"
      ? () => cancelEventGroupAction(confirmation.id, event.id, confirmationReason)
      : confirmation.kind === "item"
        ? () => archiveEventConfigurationAction({ table: "event_items", id: confirmation.id, eventId: event.id })
        : confirmation.kind === "quota"
          ? () => archiveEventConfigurationAction({ table: "event_congregation_quotas", id: confirmation.id, eventId: event.id })
          : confirmation.kind === "document"
            ? () => deleteEventDocumentAction(event.id, confirmation.id)
            : confirmation.kind === "registration"
              ? () => cancelRegistrationAction({ registrationId: confirmation.registration.id, reason: confirmationReason }, event.id)
              : () => deletePaymentAction(event.id, confirmation.id);
    execute(task, false, () => {
      if (confirmation.kind === "payment") setRegistrationModal(null);
      setConfirmation(null);
      setConfirmationReason("");
    });
  }

  const tabs = [
    ["overview", "Visão geral"], ["registrations", "Inscrições"], ["groups", "Grupos/caravanas"],
    ["items", "Itens"], ["quotas", "Cotas"], ["checkin", "Check-in"], ["documents", "Documentos"], ["reports", "Relatórios"],
  ];

  return (
    <S.Module>
      <PageHeader
        title={event.name}
        subtitle={`${eventLabel(EVENT_TYPES, event.eventType)} · ${formatDate(event.startsAt)} · ${[event.location, event.city, event.state].filter(Boolean).join(" / ") || "Local a definir"}`}
        badge={eventLabel(EVENT_STATUSES, event.status)}
        action={<Link href="/eventos" className="app-button-secondary"><ArrowLeft size={15} />Voltar</Link>}
      />

      <S.StatStrip>
        <S.StatBox><span><Users /></span><div><strong>{event.occupied}</strong><small>Ocupação · quantidade de inscrições ativas</small></div></S.StatBox>
        <S.StatBox><span><BadgeDollarSign /></span><div><strong>{money(received)}</strong><small>Valor recebido em pagamentos confirmados</small></div></S.StatBox>
      </S.StatStrip>

      {notice ? <S.Notice $danger={notice.danger}>{notice.message}</S.Notice> : null}
      <S.Tabs>{tabs.map(([id, label]) => <button key={id} type="button" aria-current={active === id ? "page" : undefined} onClick={() => { setMenu(null); setActive(id); }}>{label}</button>)}</S.Tabs>

      {active === "overview" ? (
        <Section title="Distribuição das inscrições">
          <S.ChartsGrid>
            <RegistrationChart title="Inscrições por regional" rows={regionalChart} />
            <RegistrationChart title="Inscrições por congregação" rows={congregationChart} />
          </S.ChartsGrid>
        </Section>
      ) : null}

      {active === "registrations" ? (
        <Section title="Inscrições" action={can(PERMISSIONS.eventRegistrationsManage) ? <Button size="sm" onClick={() => setModal("registration")}><Plus size={15} />Nova inscrição</Button> : null}>
          <S.RegistrationFilters>
            <S.Field><span>Buscar por nome</span><S.FilterSearch><Search aria-hidden="true" /><input value={registrationSearch} onChange={(changeEvent) => setRegistrationSearch(changeEvent.target.value)} placeholder="Digite o nome" /></S.FilterSearch></S.Field>
            <S.Field><span>Situação da inscrição</span><select value={registrationStatus} onChange={(changeEvent) => setRegistrationStatus(changeEvent.target.value)}><option value="">Todas as situações</option>{REGISTRATION_STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></S.Field>
            <S.Field><span>Regional</span><select value={registrationRegion} onChange={(changeEvent) => { setRegistrationRegion(changeEvent.target.value); setRegistrationCongregation(""); }}><option value="">Todas as regionais</option>{initial.references.regions.map((region) => <option key={region.id} value={region.id}>{region.name}</option>)}</select></S.Field>
            <S.Field><span>Congregação</span><select value={registrationCongregation} onChange={(changeEvent) => setRegistrationCongregation(changeEvent.target.value)}><option value="">Todas as congregações</option>{filteredRegistrationCongregations.map((congregation) => <option key={congregation.id} value={congregation.id}>{congregation.name}</option>)}</select></S.Field>
            <S.Field><span>Sexo</span><select value={registrationGender} onChange={(changeEvent) => setRegistrationGender(changeEvent.target.value)}><option value="">Todos</option><option value="MALE">Masculino</option><option value="FEMALE">Feminino</option></select></S.Field>
            <S.Field><span>Item selecionado</span><select value={registrationItem} onChange={(changeEvent) => setRegistrationItem(changeEvent.target.value)}><option value="">Todos os itens</option>{initial.items.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></S.Field>
            <S.Field><span>Forma de pagamento</span><select value={registrationPaymentMethod} onChange={(changeEvent) => setRegistrationPaymentMethod(changeEvent.target.value)}><option value="">Todas as formas</option>{PAYMENT_METHODS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></S.Field>
            {hasRegistrationFilters ? <button type="button" className="app-button-secondary" onClick={() => { setRegistrationSearch(""); setRegistrationStatus(""); setRegistrationRegion(""); setRegistrationCongregation(""); setRegistrationGender(""); setRegistrationItem(""); setRegistrationPaymentMethod(""); }}>Limpar filtros</button> : <span />}
          </S.RegistrationFilters>
          <S.FilterResult>{filteredRegistrations.length} de {initial.registrations.length} inscrições</S.FilterResult>
          {filteredRegistrations.length ? <S.TableWrap><table><thead><tr><th>Participante</th><th>Telefone</th><th>Regional / congregação</th><th>Itens</th><th>Valor</th><th>Pagamento</th><th>Situação</th><th><span className="sr-only">Ações</span></th></tr></thead><tbody>
            {filteredRegistrations.map((registration) => <tr key={registration.id}>
              <td><strong>{registration.participantName}</strong><br /><small>{registration.registrationNumber} · {registration.memberId ? "Membro" : "Visitante"}</small></td>
              <td>{registration.participantPhone || "—"}</td>
              <td>{registration.regionName || "Sem regional"}<br /><small>{registration.congregationName || "Sem congregação"}</small></td>
              <td>{registration.itemNames.length ? registration.itemNames.join(", ") : "—"}</td>
              <td><strong>{money(registration.totalAmount)}</strong><br /><small>{money(registration.paidAmount)} recebido</small></td>
              <td><S.StatusDot $tone={statusTone(registration.paymentStatus)}>{eventLabel(PAYMENT_STATUSES, registration.paymentStatus)}</S.StatusDot></td>
              <td><S.StatusDot $tone={statusTone(registration.status)}>{eventLabel(REGISTRATION_STATUSES, registration.status)}</S.StatusDot></td>
              <td><S.ActionButton type="button" aria-label={`Ações de ${registration.participantName}`} aria-haspopup="menu" aria-expanded={menu?.registrationId === registration.id} onClick={(click) => { const rect = click.currentTarget.getBoundingClientRect(); setMenu((currentMenu) => currentMenu?.registrationId === registration.id ? null : { registrationId: registration.id, left: Math.max(8, rect.right - 210), top: Math.min(window.innerHeight - 220, rect.bottom + 4) }); }}><EllipsisVertical /></S.ActionButton></td>
            </tr>)}
          </tbody></table></S.TableWrap> : <Empty title={hasRegistrationFilters ? "Nenhuma inscrição encontrada" : "Nenhuma inscrição"} text={hasRegistrationFilters ? "Altere ou limpe os filtros para visualizar outros participantes." : "Crie a primeira inscrição ou compartilhe a página pública."} />}
        </Section>
      ) : null}

      {active === "groups" ? (
        <Section title="Grupos e caravanas" description="Fluxo preservado para a segunda etapa de remodelagem." action={can(PERMISSIONS.eventRegistrationsManage) && event.registrationMode !== "INDIVIDUAL" ? <Button size="sm" onClick={() => setModal("group")}><Plus size={15} />Novo grupo</Button> : null}>
          {initial.groups.length ? <S.TableWrap><table><thead><tr><th>Origem</th><th>Responsável</th><th>Participantes</th><th>Situação</th><th>Ações</th></tr></thead><tbody>{initial.groups.map((group) => <tr key={group.id}><td><strong>{group.originChurchName || "Grupo externo"}</strong><br />{group.originCity}/{group.originState}</td><td>{group.responsibleName}</td><td>{group.total}</td><td><S.StatusDot $tone={statusTone(group.status)}>{group.status}</S.StatusDot></td><td>{can(PERMISSIONS.eventRegistrationsManage) && group.status !== "CANCELLED" ? <button className="app-button-secondary" onClick={() => askConfirmation({ kind: "group", id: group.id, label: group.responsibleName })}>Cancelar grupo</button> : null}</td></tr>)}</tbody></table></S.TableWrap> : <Empty title="Nenhum grupo" text="Grupos geram uma inscrição individual para cada participante." />}
        </Section>
      ) : null}

      {active === "items" ? (
        <Section title="Itens" description="Itens que podem ser selecionados durante a inscrição." action={can(PERMISSIONS.eventsManage) ? <Button size="sm" onClick={() => setModal("item")}><Plus size={15} />Novo item</Button> : null}>
          {initial.items.length ? <S.TableWrap><table><thead><tr><th>Nome do item</th><th>Valor</th><th><span className="sr-only">Ações</span></th></tr></thead><tbody>{initial.items.map((item) => <tr key={item.id}><td><strong>{item.name}</strong></td><td>{money(item.price)}</td><td>{can(PERMISSIONS.eventsManage) ? <S.ActionButton type="button" aria-label={`Excluir ${item.name}`} onClick={() => askConfirmation({ kind: "item", id: item.id, label: item.name })}><Trash2 /></S.ActionButton> : null}</td></tr>)}</tbody></table></S.TableWrap> : <Empty title="Nenhum item" text="Adicione inscrição, camiseta, alimentação ou outro item." icon={<Ticket />} />}
        </Section>
      ) : null}

      {active === "quotas" ? (
        <Section title="Cotas de inscrição" description="Metas por congregação. Elas acompanham o desempenho e nunca bloqueiam inscrições." action={can(PERMISSIONS.eventsManage) ? <Button size="sm" onClick={() => setModal("quota")}><Plus size={15} />Nova meta</Button> : null}>
          {initial.quotas.length ? <S.TableWrap><table><thead><tr><th>Congregação</th><th>Meta</th><th>Inscrições atuais</th><th>Progresso</th><th>Situação</th><th><span className="sr-only">Ações</span></th></tr></thead><tbody>{initial.quotas.map((goal) => { const progress = percentage(goal.used, goal.quotaTotal); return <tr key={goal.id}><td><strong>{goal.label}</strong></td><td>{goal.quotaTotal}</td><td>{goal.used}</td><td><S.GoalProgress><span><i style={{ width: `${Math.min(progress, 100)}%` }} /></span><small>{progress}% atingido</small></S.GoalProgress></td><td><S.StatusDot $tone={progress >= 100 ? "success" : progress >= 60 ? "warning" : "neutral"}>{progress >= 100 ? "Meta atingida" : "Em andamento"}</S.StatusDot></td><td>{can(PERMISSIONS.eventsManage) ? <S.ActionButton type="button" aria-label={`Excluir meta de ${goal.label}`} onClick={() => askConfirmation({ kind: "quota", id: goal.id, label: goal.label })}><Trash2 /></S.ActionButton> : null}</td></tr>; })}</tbody></table></S.TableWrap> : <Empty title="Nenhuma meta definida" text="Adicione a quantidade de inscrições esperada para cada congregação." icon={<CalendarCheck />} />}
        </Section>
      ) : null}

      {active === "checkin" ? (
        <Section title="Check-in" description="Este fluxo permanece sem alterações até a próxima etapa de remodelagem." action={can(PERMISSIONS.eventCheckin) ? <Link href={`/eventos/${event.id}/check-in`} className="app-button-primary"><QrCodeIcon size={15} />Abrir operação</Link> : null}>
          {initial.checkins.length ? <S.TableWrap><table><thead><tr><th>Participante</th><th>Método</th><th>Data</th><th>Situação</th></tr></thead><tbody>{initial.checkins.map((checkin) => <tr key={checkin.id}><td><strong>{checkin.participantName}</strong><br /><small>{checkin.registrationNumber}</small></td><td>{checkin.method}</td><td>{checkin.checkedInAt ? formatDate(checkin.checkedInAt) : "—"}</td><td><S.StatusDot $tone={statusTone(checkin.status)}>{checkin.status}</S.StatusDot></td></tr>)}</tbody></table></S.TableWrap> : <Empty title="Nenhum check-in" text="A operação de presença ainda não foi iniciada." icon={<QrCodeIcon />} />}
        </Section>
      ) : null}

      {active === "documents" ? (
        <Section title="Documentos" description="Arquivos privados relacionados ao evento." action={can(PERMISSIONS.eventDocumentsManage) ? <Button size="sm" onClick={() => setModal("document")}><FileUp size={15} />Enviar documento</Button> : null}>
          {initial.documents.length ? <S.TableWrap><table><thead><tr><th>Nome do documento</th><th>Arquivo</th><th>Envio</th><th>Ações</th></tr></thead><tbody>{initial.documents.map((document) => <tr key={document.id}><td><strong>{document.title}</strong></td><td>{document.fileName}</td><td>{formatDate(document.uploadedAt)}</td><td><S.HeaderActions><button className="app-button-secondary" onClick={() => startTransition(async () => { const result = await getEventDocumentUrlAction(event.id, document.id); if (result.status === "success") window.open(result.data.url, "_blank", "noopener,noreferrer"); else setNotice({ message: result.message, danger: true }); })}><Download size={14} />Abrir</button>{can(PERMISSIONS.eventDocumentsManage) ? <button className="app-button-secondary" onClick={() => askConfirmation({ kind: "document", id: document.id, label: document.title })}><Trash2 size={14} />Excluir</button> : null}</S.HeaderActions></td></tr>)}</tbody></table></S.TableWrap> : <Empty title="Nenhum documento" text="Envie o primeiro arquivo deste evento." icon={<FileText />} />}
        </Section>
      ) : null}

      {active === "reports" ? (
        <S.BlankTab aria-label="Relatórios" />
      ) : null}

      {menu && typeof document !== "undefined" ? createPortal(<RegistrationMenu
        menuRef={menuRef}
        style={{ left: menu.left, top: menu.top }}
        registration={initial.registrations.find((item) => item.id === menu.registrationId)!}
        canManage={can(PERMISSIONS.eventRegistrationsManage)}
        canPay={can(PERMISSIONS.eventPaymentsManage)}
        onClose={() => setMenu(null)}
        onDetails={(registration) => setRegistrationModal({ kind: "details", registration })}
        onPayment={(registration) => setRegistrationModal({ kind: "payment", registration })}
        onQr={(registration) => execute(async () => { const result = await reissueQrAction(registration.id, event.id); if (result.status === "success") setCredential({ token: String(result.data.qrToken ?? ""), number: String(result.data.registrationNumber ?? registration.registrationNumber ?? "") }); return result; }, false)}
        onCancel={(registration) => askConfirmation({ kind: "registration", registration })}
      />, document.body) : null}

      {modal ? <ConfigurationModal kind={modal} data={initial} busy={pending} onClose={() => setModal(null)} execute={execute} /> : null}
      {registrationModal?.kind === "details" ? <RegistrationDetailsModal data={initial} registration={registrationModal.registration} busy={pending} canDeletePayment={can(PERMISSIONS.eventPaymentsManage)} onClose={() => setRegistrationModal(null)} onOpenReceipt={(paymentId) => startTransition(async () => { const result = await getPaymentReceiptUrlAction(event.id, paymentId); if (result.status === "success") window.open(result.data.url, "_blank", "noopener,noreferrer"); else setNotice({ message: result.message, danger: true }); })} onDeletePayment={(paymentId, label) => askConfirmation({ kind: "payment", id: paymentId, label })} /> : null}
      {registrationModal?.kind === "payment" ? <PaymentModal eventId={event.id} registration={registrationModal.registration} busy={pending} onClose={() => setRegistrationModal(null)} execute={execute} /> : null}
      {credential ? <Modal open title={`Credencial ${credential.number}`} icon={<QrCodeIcon />} onClose={() => setCredential(null)}><div style={{ display: "grid", placeItems: "center", gap: 14 }}><QrCode value={credential.token} /><code style={{ wordBreak: "break-all" }}>{credential.token}</code></div></Modal> : null}
      {confirmation ? <Modal open size="sm" title={confirmation.kind === "registration" ? "Cancelar inscrição" : confirmation.kind === "group" ? "Cancelar grupo" : confirmation.kind === "payment" ? "Excluir pagamento" : "Confirmar exclusão"} description={confirmation.kind === "payment" ? "O pagamento sairá do histórico e o saldo da inscrição será recalculado." : confirmation.kind === "registration" || confirmation.kind === "group" ? "O histórico será preservado. Informe o motivo para continuar." : "Esta operação removerá o registro selecionado."} icon={<Trash2 />} onClose={() => setConfirmation(null)} busy={pending} footer={<S.ModalFooter><Button variant="outline" onClick={() => setConfirmation(null)} disabled={pending}>Voltar</Button><Button variant="danger" onClick={confirmWorkspaceAction} loading={pending} disabled={(confirmation.kind === "registration" || confirmation.kind === "group") && confirmationReason.trim().length < 3}>{confirmation.kind === "registration" || confirmation.kind === "group" ? "Confirmar cancelamento" : "Confirmar exclusão"}</Button></S.ModalFooter>}>
        <S.DeleteWarning>Selecionado: <strong>{confirmation.kind === "registration" ? confirmation.registration.participantName : confirmation.label}</strong></S.DeleteWarning>
        {confirmation.kind === "registration" || confirmation.kind === "group" ? <S.Field style={{ marginTop: 14 }}><span>Motivo *</span><textarea data-autofocus value={confirmationReason} onChange={(change) => setConfirmationReason(change.target.value)} maxLength={1000} placeholder="Descreva o motivo" /></S.Field> : null}
      </Modal> : null}
      <ToastViewport>{notice ? <Toast title={notice.danger ? "Ação não concluída" : "Tudo certo"} description={notice.message} variant={notice.danger ? "danger" : "success"} onClose={() => setNotice(null)} /> : null}</ToastViewport>
    </S.Module>
  );
}

const RegistrationMenu = ({ registration, canManage, canPay, onClose, onDetails, onPayment, onQr, onCancel, menuRef, ...props }: {
  registration: RegistrationRow; canManage: boolean; canPay: boolean; onClose: () => void;
  onDetails: (registration: RegistrationRow) => void; onPayment: (registration: RegistrationRow) => void;
  onQr: (registration: RegistrationRow) => void; onCancel: (registration: RegistrationRow) => void;
  menuRef: React.RefObject<HTMLDivElement | null>;
} & React.HTMLAttributes<HTMLDivElement>) => <S.Menu {...props} ref={menuRef} role="menu">
  <button role="menuitem" onClick={() => { onDetails(registration); onClose(); }}><Eye />Ver detalhes</button>
  {canPay && registration.remainingAmount > 0 && !["CANCELLED", "EXPIRED"].includes(registration.status) ? <button role="menuitem" onClick={() => { onPayment(registration); onClose(); }}><CreditCard />Registrar pagamento</button> : null}
  {canManage && registration.status === "CONFIRMED" ? <button role="menuitem" onClick={() => { onQr(registration); onClose(); }}><QrCodeIcon />Reemitir QR Code</button> : null}
  {canManage && !["CANCELLED", "EXPIRED"].includes(registration.status) ? <button role="menuitem" onClick={() => { onCancel(registration); onClose(); }}><Trash2 />Cancelar inscrição</button> : null}
</S.Menu>;

function ConfigurationModal({ kind, data, busy, onClose, execute }: { kind: Exclude<ModalKind, null>; data: EventWorkspaceData; busy: boolean; onClose: () => void; execute: (task: () => Promise<ActionResult>, close?: boolean) => void }) {
  if (kind === "registration") return <RegistrationModalForm data={data} busy={busy} onClose={onClose} execute={execute} />;
  if (kind === "group") return <GroupModal data={data} busy={busy} onClose={onClose} execute={execute} />;
  if (kind === "item") return <ItemModal data={data} busy={busy} onClose={onClose} execute={execute} />;
  if (kind === "quota") return <QuotaModal data={data} busy={busy} onClose={onClose} execute={execute} />;
  return <DocumentModal data={data} busy={busy} onClose={onClose} execute={execute} />;
}

function RegistrationModalForm({ data, busy, onClose, execute }: { data: EventWorkspaceData; busy: boolean; onClose: () => void; execute: (task: () => Promise<ActionResult>) => void }) {
  const formId = "event-registration-form";
  const [kind, setKind] = useState<"MEMBER" | "VISITOR">("VISITOR");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<EventMemberReference[]>([]);
  const [selectedMember, setSelectedMember] = useState<EventMemberReference | null>(null);
  const [highlighted, setHighlighted] = useState(0);
  const [name, setName] = useState("");
  const [gender, setGender] = useState("");
  const [phone, setPhone] = useState("");
  const [regionId, setRegionId] = useState("");
  const [congregationId, setCongregationId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("PIX");
  const [selectedItems, setSelectedItems] = useState(() => new Set(data.items.filter((item) => item.required && item.active).map((item) => item.id)));

  useEffect(() => {
    let active = true;
    if (kind !== "MEMBER" || selectedMember || query.trim().length < 2) return;
    const timer = window.setTimeout(async () => {
      setSearching(true);
      const result = await searchEventMembersAction(query);
      if (!active) return;
      setSearching(false);
      setResults(result.status === "success" ? result.data : []);
      setHighlighted(0);
    }, 300);
    return () => { active = false; window.clearTimeout(timer); };
  }, [kind, query, selectedMember]);

  const congregations = data.references.congregations.filter((item) => !regionId || item.regionId === regionId);
  const total = data.items.filter((item) => selectedItems.has(item.id)).reduce((sum, item) => sum + item.price, 0);

  function choose(member: EventMemberReference) {
    setSelectedMember(member); setQuery(member.fullName); setName(member.fullName); setGender(member.gender ?? ""); setPhone(formatBrazilPhone(member.phone ?? "")); setRegionId(member.regionId ?? ""); setCongregationId(member.congregationId); setResults([]); setSearching(false);
  }

  function changeKind(next: "MEMBER" | "VISITOR") {
    setKind(next); setSelectedMember(null); setQuery(""); setName(""); setGender(""); setPhone(""); setRegionId(""); setCongregationId(""); setResults([]); setSearching(false);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    execute(() => createRegistrationAction({ eventId: data.event.id, participantKind: kind, memberId: selectedMember?.id ?? "", regionId, congregationId, participantName: name, participantGender: gender, participantPhone: phone, preferredPaymentMethod: paymentMethod, items: [...selectedItems].map((itemId) => ({ itemId, quantity: 1 })) }));
  }

  return <Modal open title="Nova inscrição" description="Um processo rápido para membros e visitantes." icon={<UserRound />} onClose={onClose} busy={busy} size="lg" footer={<S.ModalFooter><Button variant="outline" onClick={onClose} disabled={busy}>Cancelar</Button><Button type="submit" form={formId} loading={busy}>Criar inscrição</Button></S.ModalFooter>}>
    <S.ModalForm id={formId} onSubmit={submit}>
      <S.ChoiceTabs><button type="button" aria-pressed={kind === "MEMBER"} onClick={() => changeKind("MEMBER")}>Sou membro</button><button type="button" aria-pressed={kind === "VISITOR"} onClick={() => changeKind("VISITOR")}>Sou visitante</button></S.ChoiceTabs>
      <S.FieldGrid>
        {kind === "MEMBER" ? <S.Wide><S.Field><span>Nome do membro *</span><S.SearchBox aria-busy={searching}><input data-autofocus value={query} onChange={(event) => { const next=event.target.value; const readyToSearch=next.trim().length>=2; setSelectedMember(null); setQuery(next); setName(next); setSearching(false); if(!readyToSearch)setResults([]); }} onKeyDown={(event) => { if (!results.length) return; if (event.key === "ArrowDown") { event.preventDefault(); setHighlighted((current) => Math.min(current + 1, results.length - 1)); } if (event.key === "ArrowUp") { event.preventDefault(); setHighlighted((current) => Math.max(current - 1, 0)); } if (event.key === "Enter") { event.preventDefault(); choose(results[highlighted]); } if (event.key === "Escape") setResults([]); }} placeholder="Digite ao menos 2 caracteres" autoComplete="off" />{searching ? <LoaderCircle data-loading aria-label="Buscando membros" /> : <Search aria-hidden="true" />}{results.length ? <S.SearchResults role="listbox">{results.map((member, index) => <button type="button" role="option" aria-selected={index === highlighted} key={member.id} onMouseEnter={() => setHighlighted(index)} onClick={() => choose(member)}><strong>{member.fullName}</strong><small>{member.regionName || "Sem regional"} · {member.congregationName}</small></button>)}</S.SearchResults> : null}</S.SearchBox>{query.length === 1 ? <S.ErrorText>Digite mais um caractere para iniciar a busca.</S.ErrorText> : null}</S.Field></S.Wide> : <S.Wide><S.Field><span>Nome completo *</span><input data-autofocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome do participante" /></S.Field></S.Wide>}
        <S.Field><span>Sexo *</span><select value={gender} onChange={(event) => setGender(event.target.value)} disabled={kind === "MEMBER" && Boolean(selectedMember)}><option value="">Selecione</option><option value="MALE">Masculino</option><option value="FEMALE">Feminino</option></select></S.Field>
        <S.Field><span>Telefone *</span><input value={phone} onChange={(event) => setPhone(formatBrazilPhone(event.target.value))} placeholder="(00) 00000-0000" inputMode="tel" /></S.Field>
        <S.Field><span>Regional</span><select value={regionId} onChange={(event) => { setRegionId(event.target.value); setCongregationId(""); }} disabled={kind === "MEMBER" && Boolean(selectedMember)}><option value="">Sem regional</option>{data.references.regions.map((region) => <option key={region.id} value={region.id}>{region.name}</option>)}</select></S.Field>
        <S.Field><span>Congregação</span><select value={congregationId} onChange={(event) => setCongregationId(event.target.value)} disabled={kind === "MEMBER" && Boolean(selectedMember)}><option value="">Sem congregação</option>{congregations.map((congregation) => <option key={congregation.id} value={congregation.id}>{congregation.name}</option>)}</select></S.Field>
        <S.Wide><S.Field><span>Forma de pagamento</span><select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>{PAYMENT_METHODS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></S.Field></S.Wide>
      </S.FieldGrid>
      {data.items.filter((item) => item.active).length ? <div><strong style={{ color: "#344054", fontSize: 12 }}>Selecione os itens</strong><S.ItemCards>{data.items.filter((item) => item.active).map((item) => <SelectableItem key={item.id} item={item} selected={selectedItems.has(item.id)} onToggle={() => setSelectedItems((current) => { const next = new Set(current); if (next.has(item.id) && !item.required) next.delete(item.id); else next.add(item.id); return next; })} />)}</S.ItemCards></div> : null}
      <S.TotalBox><span>Total da inscrição</span><strong>{money(total)}</strong></S.TotalBox>
    </S.ModalForm>
  </Modal>;
}

function SelectableItem({ item, selected, onToggle }: { item: EventItemRow; selected: boolean; onToggle: () => void }) {
  const Icon = itemIcons[item.type] ?? Ticket;
  return <S.ItemCard $selected={selected}><input type="checkbox" checked={selected} onChange={onToggle} disabled={item.required} /><Icon /><strong>{item.name}</strong><small>{money(item.price)}{item.required ? " · obrigatório" : ""}</small></S.ItemCard>;
}

function GroupModal({ data, busy, onClose, execute }: { data: EventWorkspaceData; busy: boolean; onClose: () => void; execute: (task: () => Promise<ActionResult>) => void }) {
  const formId = "event-group-form";
  return <Modal open title="Novo grupo ou caravana" description="Fluxo atual preservado para a próxima etapa." icon={<Users />} onClose={onClose} busy={busy} size="lg" footer={<S.ModalFooter><Button variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit" form={formId} loading={busy}>Criar grupo</Button></S.ModalFooter>}><S.ModalForm id={formId} onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); const names = String(form.get("participantNames") ?? "").split("\n").map((name) => name.trim()).filter(Boolean); execute(() => createEventGroupAction({ eventId: data.event.id, originChurchName: form.get("originChurchName"), originFieldName: "", originCity: form.get("originCity"), originState: form.get("originState"), responsibleName: form.get("responsibleName"), responsiblePhone: form.get("responsiblePhone"), responsibleEmail: form.get("responsibleEmail"), pastorName: form.get("pastorName"), pastorPhone: "", notes: "", participants: names.map((participantName) => ({ participantName, participantType: "VISITOR", participantGender: "", participantDocument: "", participantPhone: "", participantEmail: "", congregationId: form.get("congregationId"), items: [] })) })); }}><S.FieldGrid><S.Field><span>Igreja/origem</span><input name="originChurchName" /></S.Field><S.Field><span>Cidade *</span><input name="originCity" /></S.Field><S.Field><span>UF *</span><input name="originState" maxLength={2} /></S.Field><S.Field><span>Responsável *</span><input name="responsibleName" /></S.Field><S.Field><span>Telefone</span><input name="responsiblePhone" inputMode="tel" placeholder="(00) 00000-0000" onChange={(change) => { change.currentTarget.value = formatBrazilPhone(change.currentTarget.value); }} /></S.Field><S.Field><span>E-mail</span><input name="responsibleEmail" type="email" /></S.Field><S.Field><span>Pastor</span><input name="pastorName" /></S.Field><S.Field><span>Congregação</span><select name="congregationId"><option value="">Sem vínculo</option>{data.references.congregations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></S.Field><S.Wide><S.Field><span>Participantes * (um nome por linha)</span><textarea name="participantNames" rows={7} /></S.Field></S.Wide></S.FieldGrid></S.ModalForm></Modal>;
}

function ItemModal({ data, busy, onClose, execute }: { data: EventWorkspaceData; busy: boolean; onClose: () => void; execute: (task: () => Promise<ActionResult>) => void }) {
  const formId = "event-item-form";
  const [price, setPrice] = useState(formatBrazilCurrencyInput("0"));
  return <Modal open title="Novo item" description="Cadastre o nome e o valor apresentado na inscrição." icon={<Ticket />} onClose={onClose} busy={busy} size="lg" footer={<S.ModalFooter><Button variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit" form={formId} loading={busy}>Salvar item</Button></S.ModalFooter>}><S.ModalForm id={formId} onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); execute(() => saveEventItemAction({ eventId: data.event.id, name: form.get("name"), description: "", itemType: form.get("itemType"), price: parseBrazilCurrencyInput(price), isRequired: form.has("isRequired"), isActive: true, allowQuantity: false, minQuantity: 1, maxQuantity: "", availableQuantity: "" })); }}><S.FieldGrid><S.Wide><S.Field><span>Nome do item *</span><input data-autofocus name="name" /></S.Field></S.Wide><S.Field><span>Tipo</span><select name="itemType"><option value="REGISTRATION">Inscrição</option><option value="SHIRT">Camiseta</option><option value="FOOD">Alimentação</option><option value="LODGING">Hospedagem</option><option value="TRANSPORT">Transporte</option><option value="KIT">Kit</option><option value="OTHER">Outro</option></select></S.Field><S.Field><span>Valor</span><input value={price} onChange={(change) => setPrice(formatBrazilCurrencyInput(change.target.value))} inputMode="numeric" /></S.Field><S.Wide><S.Check><input name="isRequired" type="checkbox" />Selecionar automaticamente como item obrigatório</S.Check></S.Wide></S.FieldGrid></S.ModalForm></Modal>;
}

function QuotaModal({ data, busy, onClose, execute }: { data: EventWorkspaceData; busy: boolean; onClose: () => void; execute: (task: () => Promise<ActionResult>) => void }) {
  const formId = "event-goal-form";
  const usedIds = new Set(data.quotas.map((quota) => quota.targetId));
  return <Modal open title="Nova cota" description="Defina a meta de inscrições de uma congregação." icon={<CalendarCheck />} onClose={onClose} busy={busy} size="lg" footer={<S.ModalFooter><Button variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit" form={formId} loading={busy}>Salvar meta</Button></S.ModalFooter>}><S.ModalForm id={formId} onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); execute(() => saveEventQuotaAction({ eventId: data.event.id, congregationId: form.get("congregationId"), quotaTotal: form.get("quotaTotal") })); }}><S.FieldGrid><S.Wide><S.Field><span>Congregação *</span><select data-autofocus name="congregationId"><option value="">Selecione</option>{data.references.congregations.filter((item) => !usedIds.has(item.id)).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></S.Field></S.Wide><S.Wide><S.Field><span>Quantidade de cotas *</span><input name="quotaTotal" type="number" min="1" /></S.Field></S.Wide></S.FieldGrid></S.ModalForm></Modal>;
}

function DocumentModal({ data, busy, onClose, execute }: { data: EventWorkspaceData; busy: boolean; onClose: () => void; execute: (task: () => Promise<ActionResult>) => void }) {
  const formId = "event-document-form";
  const [file, setFile] = useState<File | null>(null);
  return <Modal open title="Enviar documento" description="PDF, imagem, Word ou Excel com até 10 MB." icon={<FileUp />} onClose={onClose} busy={busy} size="lg" footer={<S.ModalFooter><Button variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit" form={formId} loading={busy}>Enviar arquivo</Button></S.ModalFooter>}><S.ModalForm id={formId} onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); if (!file) return; execute(async () => { const prepared = await prepareEventDocumentAction({ eventId: data.event.id, title: String(form.get("title")), fileName: file.name, mimeType: file.type, fileSize: file.size }); if (prepared.status === "error") return prepared; const upload = await createClient().storage.from("event-documents").uploadToSignedUrl(prepared.data.path, prepared.data.token, file, { contentType: file.type }); if (upload.error) return { status: "error", message: "Falha ao enviar o arquivo." }; return finalizeEventDocumentAction(data.event.id, prepared.data.id); }); }}><S.Field><span>Nome do documento *</span><input data-autofocus name="title" /></S.Field><S.DropField><input type="file" accept={EVENT_DOCUMENT_ACCEPT} onChange={(event) => setFile(event.target.files?.[0] ?? null)} /><UploadCloud /><strong>{file ? file.name : "Selecionar arquivo"}</strong><small>{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : "Clique para escolher o documento"}</small></S.DropField></S.ModalForm></Modal>;
}

function PaymentModal({ eventId, registration, busy, onClose, execute }: { eventId: string; registration: RegistrationRow; busy: boolean; onClose: () => void; execute: (task: () => Promise<ActionResult>) => void }) {
  const formId = "event-payment-form";
  const [file, setFile] = useState<File | null>(null);
  const [amount, setAmount] = useState(formatBrazilCurrencyInput(String(Math.round(registration.remainingAmount * 100))));
  return <Modal open title={`Pagamento — ${registration.participantName}`} description={`${registration.registrationNumber ?? "Inscrição"} · ${eventLabel(PAYMENT_METHODS, registration.preferredPaymentMethod ?? "PIX")}`} icon={<WalletCards />} onClose={onClose} busy={busy} size="lg" footer={<S.ModalFooter><Button variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit" form={formId} loading={busy}>Confirmar pagamento</Button></S.ModalFooter>}><S.ModalForm id={formId} onSubmit={(event) => { event.preventDefault(); execute(async () => { let receipt = { receiptPath: "", receiptFileName: "", receiptMimeType: "", receiptFileSize: 0 }; if (file) { const prepared = await preparePaymentReceiptAction(eventId, { name: file.name, type: file.type, size: file.size }); if (prepared.status === "error") return prepared; const upload = await createClient().storage.from("event-documents").uploadToSignedUrl(prepared.data.path, prepared.data.token, file, { contentType: file.type }); if (upload.error) return { status: "error", message: "Não foi possível enviar o comprovante." }; receipt = { receiptPath: prepared.data.path, receiptFileName: file.name, receiptMimeType: file.type, receiptFileSize: file.size }; } return recordPaymentAction({ eventId, registrationId: registration.id, amount: parseBrazilCurrencyInput(amount), ...receipt }); }); }}><S.FieldGrid><S.Field><span>Valor *</span><input data-autofocus value={amount} onChange={(change) => setAmount(formatBrazilCurrencyInput(change.target.value))} inputMode="numeric" /></S.Field><S.Field><span>Data do pagamento</span><input value={new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date())} readOnly /></S.Field><S.Wide><S.DropField><input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /><ReceiptText /><strong>{file ? file.name : "Comprovante do pagamento"}</strong><small>{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : "PDF ou imagem de até 10 MB"}</small></S.DropField></S.Wide></S.FieldGrid></S.ModalForm></Modal>;
}

function RegistrationDetailsModal({ data, registration, busy, canDeletePayment, onClose, onOpenReceipt, onDeletePayment }: { data: EventWorkspaceData; registration: RegistrationRow; busy: boolean; canDeletePayment: boolean; onClose: () => void; onOpenReceipt: (paymentId: string) => void; onDeletePayment: (paymentId: string, label: string) => void }) {
  const payments = data.payments.filter((payment) => payment.registrationId === registration.id);
  return <Modal open title={registration.participantName} description={`${registration.registrationNumber ?? "Inscrição"} · ${registration.memberId ? "Membro" : "Visitante"}`} icon={<UserRound />} onClose={onClose} busy={busy} size="lg" footer={<S.ModalFooter><Button variant="outline" onClick={onClose}>Fechar</Button></S.ModalFooter>}><S.OperationalList><div><dt>Telefone</dt><dd>{registration.participantPhone || "—"}</dd></div><div><dt>Sexo</dt><dd>{registration.participantGender === "MALE" ? "Masculino" : registration.participantGender === "FEMALE" ? "Feminino" : "—"}</dd></div><div><dt>Regional</dt><dd>{registration.regionName || "Sem vínculo"}</dd></div><div><dt>Congregação</dt><dd>{registration.congregationName || "Sem vínculo"}</dd></div><div><dt>Total</dt><dd>{money(registration.totalAmount)}</dd></div><div><dt>Saldo</dt><dd>{money(registration.remainingAmount)}</dd></div></S.OperationalList><div style={{ marginTop: 18 }}><strong style={{ color: "#344054", fontSize: 13 }}>Histórico de pagamentos</strong>{payments.length ? <S.TableWrap style={{ marginTop: 9 }}><table><thead><tr><th>Data</th><th>Valor</th><th>Método</th><th>Comprovante</th><th><span className="sr-only">Ações</span></th></tr></thead><tbody>{payments.map((payment) => <tr key={payment.id}><td>{payment.paidAt ? formatDate(payment.paidAt) : "—"}</td><td>{money(payment.amount)}</td><td>{eventLabel(PAYMENT_METHODS, payment.method)}</td><td>{payment.receiptStoragePath ? <button className="app-button-secondary" onClick={() => onOpenReceipt(payment.id)}><Eye size={14} />Abrir</button> : "Sem arquivo"}</td><td>{canDeletePayment ? <S.ActionButton type="button" aria-label={`Excluir pagamento ${payment.paymentNumber ?? payment.id}`} onClick={() => onDeletePayment(payment.id, `${payment.paymentNumber ?? "Pagamento"} · ${money(payment.amount)}`)}><Trash2 /></S.ActionButton> : null}</td></tr>)}</tbody></table></S.TableWrap> : <p style={{ color: "#667085", fontSize: 11 }}>Nenhum pagamento registrado.</p>}</div></Modal>;
}
