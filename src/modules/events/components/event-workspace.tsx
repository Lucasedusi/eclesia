"use client";

import { Fragment, type FormEvent, type ReactNode, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BadgeDollarSign,
  BedDouble,
  Bus,
  CalendarCheck,
  Check,
  CreditCard,
  Copy,
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
  RotateCcw,
  Search,
  Shirt,
  SlidersHorizontal,
  Pencil,
  Ticket,
  Trash2,
  UploadCloud,
  UserRound,
  Users,
  UtensilsCrossed,
  WalletCards,
  X,
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
  approveRegistrationPaymentAction,
  approveCaravanPaymentAction,
  cancelEventGroupAction,
  cancelRegistrationAction,
  createEventGroupAction,
  createRegistrationAction,
  updateRegistrationAction,
  deleteEventDocumentAction,
  deleteEventExpenseAction,
  deletePaymentAction,
  finalizeEventDocumentAction,
  getEventDocumentUrlAction,
  getEventExpenseReceiptUrlAction,
  getPaymentReceiptUrlAction,
  prepareEventDocumentAction,
  prepareEventExpenseReceiptAction,
  preparePaymentReceiptAction,
  prepareCaravanParticipantListAction,
  recordCaravanPaymentAction,
  recordPaymentAction,
  reissueQrAction,
  saveEventItemAction,
  saveEventExpenseAction,
  saveEventQuotaAction,
  searchEventMembersAction,
} from "../actions/event.actions";
import {
  EVENT_DOCUMENT_ACCEPT,
  CHECKIN_METHODS,
  CHECKIN_STATUSES,
  EVENT_STATUSES,
  EVENT_REGISTRATION_STATUSES,
  EVENT_TYPES,
  GROUP_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  PAYMENT_TRANSACTION_STATUSES,
  REGISTRATION_STATUSES,
  eventBadgeTone,
  eventLabel,
} from "../constants/events";
import type { ActionResult, EventExpenseRow, EventItemRow, EventMemberReference, EventRegistrationFieldRow, EventWorkspaceData, GroupRow, PaymentRow, RegistrationRow } from "../types/event.types";
import { useEventWorkspaceRealtime } from "../hooks/use-event-workspace-realtime";
import { formatRegistrationFieldValue, visibleRegistrationFields } from "../utils/registration-fields";
import * as S from "./events.styles";
import { EventReportBuilder } from "./event-report-builder";
import { QrCode } from "./qr-code";
import { RegistrationChart } from "./registration-chart";

type ModalKind = "registration" | "group" | "item" | "quota" | "document" | null;
type RegistrationModal = { kind: "details" | "payment" | "edit"; registration: RegistrationRow } | null;
type CaravanModal = {kind:"details"|"payment"|"edit";group:GroupRow}|null;
type Confirmation =
  | { kind: "group"; id: string; label: string }
  | { kind: "item"; id: string; label: string }
  | { kind: "quota"; id: string; label: string }
  | { kind: "document"; id: string; label: string }
  | { kind: "expense"; id: string; label: string }
  | { kind: "registration"; registration: RegistrationRow }
  | { kind: "approvePayment"; registration: RegistrationRow }
  | { kind: "payment"; id: string; label: string };

function money(value: number) { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value); }
function formatDate(value: string) { return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value)); }
function formatRegistrationDate(value: string) {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "America/Sao_Paulo",
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "00";
  return `${part("day")}/${part("month")}/${part("year")} - ${part("hour")}h${part("minute")}`;
}
function percentage(current: number, target: number) { return target > 0 ? Math.round((current / target) * 100) : 0; }

const itemIcons: Record<string, typeof Ticket> = {
  REGISTRATION: Ticket, SHIRT: Shirt, FOOD: UtensilsCrossed, LODGING: BedDouble,
  TRANSPORT: Bus, KIT: Gift, DONATION: Gift, OTHER: Ticket,
};

function Section({ title, description, action, children }: { title: string; description?: string; action?: ReactNode; children: ReactNode }) {
  return <S.Section><S.Toolbar><div style={{ display: "grid", gap: 3 }}><h2>{title}</h2>{description ? <p>{description}</p> : null}</div><div>{action}</div></S.Toolbar>{children}</S.Section>;
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

function groupCaravansByCity(rows: GroupRow[]) {
  const values = new Map<string, number>();
  for (const group of rows) {
    if (group.status !== "CONFIRMED") continue;
    const label = `${group.originCity}/${group.originState}`.toLocaleUpperCase("pt-BR");
    values.set(label, (values.get(label) ?? 0) + group.total);
  }
  return [...values.entries()].map(([label, value]) => ({ label, value })).sort((first, second) => second.value - first.value || first.label.localeCompare(second.label, "pt-BR"));
}

export function EventWorkspace({ initial }: { initial: EventWorkspaceData }) {
  const router = useRouter();
  const [active, setActive] = useState("overview");
  const [modal, setModal] = useState<ModalKind>(null);
  const [registrationModal, setRegistrationModal] = useState<RegistrationModal>(null);
  const [caravanModal,setCaravanModal]=useState<CaravanModal>(null);
  const [credential, setCredential] = useState<{ token: string; number: string } | null>(null);
  const [notice, setNotice] = useState<{ message: string; danger?: boolean } | null>(null);
  const [pending, startTransition] = useTransition();
  const [menu, setMenu] = useState<{ registrationId: string; left: number; top: number } | null>(null);
  const [expenseMenu, setExpenseMenu] = useState<{ expenseId: string; left: number; top: number } | null>(null);
  const [caravanMenu, setCaravanMenu] = useState<{ groupId: string; left: number; top: number } | null>(null);
  const [registrationRegion, setRegistrationRegion] = useState("");
  const [registrationCongregation, setRegistrationCongregation] = useState("");
  const [registrationGender, setRegistrationGender] = useState("");
  const [registrationItem, setRegistrationItem] = useState("");
  const [registrationPaymentMethod, setRegistrationPaymentMethod] = useState("");
  const [registrationSearch, setRegistrationSearch] = useState("");
  const [registrationSearchTerm, setRegistrationSearchTerm] = useState("");
  const [registrationSearchLoading, setRegistrationSearchLoading] = useState(false);
  const [registrationStatus, setRegistrationStatus] = useState("");
  const [expenseModal, setExpenseModal] = useState<EventExpenseRow | "new" | null>(null);
  const [expenseSearch, setExpenseSearch] = useState("");
  const [expenseFrom, setExpenseFrom] = useState("");
  const [expenseTo, setExpenseTo] = useState("");
  const [advancedFilters, setAdvancedFilters] = useState(false);
  const [caravanSearch,setCaravanSearch]=useState("");
  const [caravanCity,setCaravanCity]=useState("");
  const [caravanState,setCaravanState]=useState("");
  const [caravanStatus,setCaravanStatus]=useState("");
  const [caravanPayment,setCaravanPayment]=useState("");
  const [caravanPaymentMethod,setCaravanPaymentMethod]=useState("");
  const [caravanSource,setCaravanSource]=useState("");
  const [caravanList,setCaravanList]=useState("");
  const [caravanItem,setCaravanItem]=useState("");
  const [caravanFrom,setCaravanFrom]=useState("");
  const [caravanTo,setCaravanTo]=useState("");
  const [caravanAdvancedFilters,setCaravanAdvancedFilters]=useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [confirmationReason, setConfirmationReason] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const expenseMenuRef = useRef<HTMLDivElement>(null);
  const caravanMenuRef = useRef<HTMLDivElement>(null);
  const event = initial.event;
  useEventWorkspaceRealtime(event.id);
  const can = (permission: string) => initial.permissions.includes(permission);
  const received = initial.payments.filter((payment) => payment.status === "CONFIRMED").reduce((sum, payment) => sum + payment.amount, 0);
  const totalExpenses = initial.expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const filteredExpenses = useMemo(() => initial.expenses.filter((expense) => {
    if (expenseSearch && !expense.name.toLocaleLowerCase("pt-BR").includes(expenseSearch.toLocaleLowerCase("pt-BR"))) return false;
    if (expenseFrom && expense.expenseDate < expenseFrom) return false;
    if (expenseTo && expense.expenseDate > expenseTo) return false;
    return true;
  }), [expenseFrom, expenseSearch, expenseTo, initial.expenses]);

  const filteredRegistrationCongregations = useMemo(
    () => initial.references.congregations.filter((item) => !registrationRegion || item.regionId === registrationRegion),
    [initial.references.congregations, registrationRegion],
  );
  const filteredRegistrations = useMemo(
    () => initial.registrations.filter((registration) => {
      if (registrationSearchTerm && !registration.participantName.toLocaleLowerCase("pt-BR").includes(registrationSearchTerm.toLocaleLowerCase("pt-BR"))) return false;
      if (registrationStatus && registration.status !== registrationStatus) return false;
      if (registrationRegion && registration.regionId !== registrationRegion) return false;
      if (registrationCongregation && registration.congregationId !== registrationCongregation) return false;
      if (registrationGender && registration.participantGender !== registrationGender) return false;
      if (registrationItem && !registration.itemIds.includes(registrationItem)) return false;
      if (registrationPaymentMethod && registration.preferredPaymentMethod !== registrationPaymentMethod) return false;
      return true;
    }),
    [initial.registrations, registrationCongregation, registrationGender, registrationItem, registrationPaymentMethod, registrationRegion, registrationSearchTerm, registrationStatus],
  );
  const regionalChart = useMemo(() => groupRegistrations(initial.registrations, "regionName"), [initial.registrations]);
  const congregationChart = useMemo(() => groupRegistrations(initial.registrations, "congregationName"), [initial.registrations]);
  const caravanCityChart = useMemo(() => groupCaravansByCity(initial.groups), [initial.groups]);
  const hasRegistrationFilters = Boolean(registrationSearch || registrationStatus || registrationRegion || registrationCongregation || registrationGender || registrationItem || registrationPaymentMethod);
  const filteredCaravans=useMemo(()=>initial.groups.filter((group)=>{
    const haystack=`${group.groupNumber} ${group.originChurchName} ${group.originCity} ${group.responsibleName} ${group.pastorName}`.toLocaleLowerCase("pt-BR");
    if(caravanSearch&&!haystack.includes(caravanSearch.toLocaleLowerCase("pt-BR")))return false;
    if(caravanCity&&group.originCity!==caravanCity)return false;
    if(caravanState&&group.originState!==caravanState)return false;
    if(caravanStatus&&group.status!==caravanStatus)return false;
    if(caravanPayment&&group.paymentStatus!==caravanPayment)return false;
    if(caravanPaymentMethod&&!initial.payments.some((payment)=>payment.groupId===group.id&&payment.method===caravanPaymentMethod))return false;
    if(caravanSource&&group.source!==caravanSource)return false;
    if(caravanList==="WITH"&&!group.listDocumentId)return false;
    if(caravanList==="WITHOUT"&&group.listDocumentId)return false;
    if(caravanItem&&!group.items.some((item)=>item.itemId===caravanItem))return false;
    if(caravanFrom&&group.createdAt.slice(0,10)<caravanFrom)return false;
    if(caravanTo&&group.createdAt.slice(0,10)>caravanTo)return false;
    return true;
  }),[caravanCity,caravanFrom,caravanItem,caravanList,caravanPayment,caravanPaymentMethod,caravanSearch,caravanSource,caravanState,caravanStatus,caravanTo,initial.groups,initial.payments]);
  const hasCaravanFilters=Boolean(caravanSearch||caravanCity||caravanState||caravanStatus||caravanPayment||caravanPaymentMethod||caravanSource||caravanList||caravanItem||caravanFrom||caravanTo);

  useEffect(() => {
    const normalized = registrationSearch.trim();
    if (normalized.length < 2) return;
    const timer = window.setTimeout(() => {
      setRegistrationSearchTerm(normalized);
      setRegistrationSearchLoading(false);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [registrationSearch]);

  useEffect(() => {
    const close = (event?: Event) => {
      if (event instanceof MouseEvent && (menuRef.current?.contains(event.target as Node) || expenseMenuRef.current?.contains(event.target as Node) || caravanMenuRef.current?.contains(event.target as Node))) return;
      setMenu(null);
      setExpenseMenu(null);
      setCaravanMenu(null);
    };
    const closeWhenHidden = () => {
      if (document.visibilityState !== "visible") { setMenu(null); setExpenseMenu(null); setCaravanMenu(null); }
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
        if (closeModal) { setModal(null); setRegistrationModal(null); setCaravanModal(null); setExpenseModal(null); }
        onSuccess?.();
        router.refresh();
      }
    });
  }

  function askConfirmation(next: Confirmation) {
    setMenu(null);
    setExpenseMenu(null);
    setCaravanMenu(null);
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
            : confirmation.kind === "expense"
              ? () => deleteEventExpenseAction(event.id, confirmation.id)
            : confirmation.kind === "registration"
              ? () => cancelRegistrationAction({ registrationId: confirmation.registration.id, reason: confirmationReason }, event.id)
              : confirmation.kind === "approvePayment"
                ? () => approveRegistrationPaymentAction(event.id, confirmation.registration.id)
                : () => deletePaymentAction(event.id, confirmation.id);
    execute(task, false, () => {
      if (confirmation.kind === "payment" || confirmation.kind === "approvePayment") setRegistrationModal(null);
      setConfirmation(null);
      setConfirmationReason("");
    });
  }

  const tabs: [string, string][] = [
    ["overview", "Visão geral"], ["registrations", "Inscrições"],
    ...(event.registrationMode === "MIXED" && can(PERMISSIONS.eventGroupsView) ? [["groups", "Caravanas"] as [string, string]] : []),
    ["items", "Itens"], ["quotas", "Cotas"], ["checkin", "Check-in"], ["documents", "Documentos"],
    ...(can(PERMISSIONS.eventExpensesView) ? [["expenses", "Despesas"] as [string, string]] : []),
    ...(can(PERMISSIONS.eventReportsExport) ? [["reports", "Relatórios"] as [string, string]] : []),
  ];

  return (
    <S.Module>
      <PageHeader
        title={event.name}
        subtitle={`${eventLabel(EVENT_TYPES, event.eventType)} · ${formatDate(event.startsAt)} · ${[event.location, event.city, event.state].filter(Boolean).join(" / ") || "Local a definir"}`}
        badge={`${eventLabel(EVENT_STATUSES, event.status)} · ${eventLabel(EVENT_REGISTRATION_STATUSES, event.registrationStatus)}`}
        action={<S.HeaderActions>
          <Link href="/eventos" className="app-button-secondary"><ArrowLeft size={15} />Voltar</Link>
        </S.HeaderActions>}
      />

      <S.StatStrip>
        <S.StatBox><span><Users /></span><div><strong>{event.occupied}</strong><small>Ocupação · quantidade de inscrições ativas</small></div></S.StatBox>
        <S.StatBox><span><BadgeDollarSign /></span><div><strong>{money(received)}</strong><small>Valor recebido em pagamentos confirmados</small></div></S.StatBox>
        {can(PERMISSIONS.eventExpensesView) ? <S.StatBox $tone="danger"><span><ReceiptText /></span><div><strong>{money(totalExpenses)}</strong><small>Total de despesas reconhecidas</small></div></S.StatBox> : null}
      </S.StatStrip>

      <S.Tabs>{tabs.map(([id, label]) => <button key={id} type="button" aria-current={active === id ? "page" : undefined} onClick={() => { setMenu(null); setExpenseMenu(null); setCaravanMenu(null); setActive(id); }}>{label}</button>)}</S.Tabs>

      {active === "overview" ? (<>
        <Section title={event.registrationMode === "MIXED" ? "Distribuição das inscrições individuais" : "Distribuição das inscrições"}>
          <S.ChartsGrid>
            <RegistrationChart title="Inscrições por regional" rows={regionalChart} />
            <RegistrationChart title="Inscrições por congregação" rows={congregationChart} />
          </S.ChartsGrid>
        </Section>
        {event.registrationMode === "MIXED" ? <Section title="Distribuição das caravanas" description="Ranking dos participantes inscritos coletivamente por cidade de origem."><S.ChartsGrid><RegistrationChart title="Participantes por cidade" rows={caravanCityChart} /></S.ChartsGrid></Section> : null}
      </>) : null}

      {active === "registrations" ? (
        <Section title="Inscrições" description={event.registrationStatus === "OPEN" ? undefined : "As inscrições estão fechadas. Abra-as no cabeçalho para permitir novos cadastros."} action={can(PERMISSIONS.eventRegistrationsManage) && event.registrationStatus === "OPEN" ? <Button onClick={() => setModal("registration")}><Plus size={15} />Nova inscrição</Button> : null}>
          <S.PrimaryRegistrationFilters>
            <S.Field><span>Buscar por nome</span><S.FilterSearch aria-busy={registrationSearchLoading}><Search aria-hidden="true" /><input value={registrationSearch} onChange={(changeEvent) => { const next = changeEvent.target.value; setRegistrationSearch(next); setRegistrationSearchLoading(next.trim().length >= 2); if (next.trim().length < 2) setRegistrationSearchTerm(""); }} placeholder="Digite ao menos 2 caracteres" />{registrationSearchLoading ? <LoaderCircle data-loading aria-label="Buscando inscrições" /> : null}</S.FilterSearch></S.Field>
            <S.Field><span>Regional</span><select value={registrationRegion} onChange={(changeEvent) => { setRegistrationRegion(changeEvent.target.value); setRegistrationCongregation(""); }}><option value="">Todas as regionais</option>{initial.references.regions.map((region) => <option key={region.id} value={region.id}>{region.name}</option>)}</select></S.Field>
            <S.Field><span>Congregação</span><select value={registrationCongregation} onChange={(changeEvent) => setRegistrationCongregation(changeEvent.target.value)}><option value="">Todas as congregações</option>{filteredRegistrationCongregations.map((congregation) => <option key={congregation.id} value={congregation.id}>{congregation.name}</option>)}</select></S.Field>
            <S.FilterActions>
              <S.AdvancedFilterButton type="button" aria-expanded={advancedFilters} onClick={() => setAdvancedFilters((open) => !open)}><SlidersHorizontal />Filtros avançados</S.AdvancedFilterButton>
              <S.ResetFilterButton type="button" aria-label="Resetar filtros" title="Resetar filtros" disabled={!hasRegistrationFilters} onClick={() => { setRegistrationSearch(""); setRegistrationSearchTerm(""); setRegistrationSearchLoading(false); setRegistrationStatus(""); setRegistrationRegion(""); setRegistrationCongregation(""); setRegistrationGender(""); setRegistrationItem(""); setRegistrationPaymentMethod(""); }}><RotateCcw /></S.ResetFilterButton>
            </S.FilterActions>
          </S.PrimaryRegistrationFilters>
          <S.AdvancedRegistrationFilters data-open={advancedFilters} aria-hidden={!advancedFilters} inert={!advancedFilters}>
            <S.Field><span>Situação da inscrição</span><select value={registrationStatus} onChange={(changeEvent) => setRegistrationStatus(changeEvent.target.value)}><option value="">Todas as situações</option>{REGISTRATION_STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></S.Field>
            <S.Field><span>Sexo</span><select value={registrationGender} onChange={(changeEvent) => setRegistrationGender(changeEvent.target.value)}><option value="">Todos</option><option value="MALE">Masculino</option><option value="FEMALE">Feminino</option></select></S.Field>
            <S.Field><span>Item selecionado</span><select value={registrationItem} onChange={(changeEvent) => setRegistrationItem(changeEvent.target.value)}><option value="">Todos os itens</option>{initial.items.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></S.Field>
            <S.Field><span>Forma de pagamento</span><select value={registrationPaymentMethod} onChange={(changeEvent) => setRegistrationPaymentMethod(changeEvent.target.value)}><option value="">Todas as formas</option>{PAYMENT_METHODS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></S.Field>
          </S.AdvancedRegistrationFilters>
          <S.FilterResult>{filteredRegistrations.length} de {initial.registrations.length} inscrições</S.FilterResult>
          {filteredRegistrations.length ? <S.TableWrap><table><thead><tr><th>Participante</th><th>Telefone</th><th>Regional / congregação</th><th>Itens</th><th>Valor</th><th>Pagamento</th><th>Situação</th><th><span className="sr-only">Ações</span></th></tr></thead><tbody>
            {filteredRegistrations.map((registration) => <tr key={registration.id}>
              <td><strong>{registration.participantName}</strong><br /><small>{formatRegistrationDate(registration.registeredAt)}</small></td>
              <td>{registration.participantPhone || "—"}</td>
              <td>{registration.regionName || "Sem regional"}<br /><small>{registration.congregationName || "Sem congregação"}</small></td>
              <td>{registration.itemNames.length ? registration.itemNames.join(", ") : "—"}</td>
              <td><strong>{money(registration.totalAmount)}</strong><br /><small>{money(registration.paidAmount)} recebido</small></td>
              <td><S.StatusDot $tone={eventBadgeTone(registration.paymentStatus)}>{eventLabel(PAYMENT_STATUSES, registration.paymentStatus)}</S.StatusDot></td>
              <td><S.StatusDot $tone={eventBadgeTone(registration.status)}>{eventLabel(REGISTRATION_STATUSES, registration.status)}</S.StatusDot></td>
              <td><S.ActionButton type="button" aria-label={`Ações de ${registration.participantName}`} aria-haspopup="menu" aria-expanded={menu?.registrationId === registration.id} onClick={(click) => { const rect = click.currentTarget.getBoundingClientRect(); setMenu((currentMenu) => currentMenu?.registrationId === registration.id ? null : { registrationId: registration.id, left: Math.max(8, rect.right - 210), top: Math.min(window.innerHeight - 220, rect.bottom + 4) }); }}><EllipsisVertical /></S.ActionButton></td>
            </tr>)}
          </tbody></table></S.TableWrap> : <Empty title={hasRegistrationFilters ? "Nenhuma inscrição encontrada" : "Nenhuma inscrição"} text={hasRegistrationFilters ? "Altere ou limpe os filtros para visualizar outros participantes." : "Crie a primeira inscrição ou compartilhe a página pública."} />}
        </Section>
      ) : null}

      {active === "groups" ? (
        <Section title="Caravanas" description={event.registrationStatus === "OPEN" ? "Inscrições coletivas independentes, com quantidades, itens e pagamentos próprios." : "As inscrições estão fechadas. Abra-as para cadastrar novas caravanas."} action={can(PERMISSIONS.eventGroupsManage) && event.registrationStatus === "OPEN" ? <Button onClick={() => setModal("group")}><Plus size={15} />Nova caravana</Button> : null}>
          <S.PrimaryRegistrationFilters>
            <S.Field><span>Buscar</span><S.FilterSearch><Search /><input value={caravanSearch} onChange={(change) => setCaravanSearch(change.target.value)} placeholder="Igreja, responsável ou pastor" /></S.FilterSearch></S.Field>
            <S.Field><span>Cidade</span><select value={caravanCity} onChange={(change)=>setCaravanCity(change.target.value)}><option value="">Todas</option>{[...new Set(initial.groups.map((group)=>group.originCity))].sort((a,b)=>a.localeCompare(b,"pt-BR")).map((city)=><option key={city}>{city}</option>)}</select></S.Field>
            <S.Field><span>UF</span><select value={caravanState} onChange={(change) => setCaravanState(change.target.value)}><option value="">Todas</option>{[...new Set(initial.groups.map((group) => group.originState))].sort().map((state) => <option key={state}>{state}</option>)}</select></S.Field>
            <S.FilterActions>
              <S.AdvancedFilterButton type="button" aria-expanded={caravanAdvancedFilters} onClick={()=>setCaravanAdvancedFilters((open)=>!open)}><SlidersHorizontal />Filtros avançados</S.AdvancedFilterButton>
              <S.ResetFilterButton type="button" aria-label="Limpar filtros" title="Limpar filtros" disabled={!hasCaravanFilters} onClick={()=>{setCaravanSearch("");setCaravanCity("");setCaravanState("");setCaravanStatus("");setCaravanPayment("");setCaravanPaymentMethod("");setCaravanSource("");setCaravanList("");setCaravanItem("");setCaravanFrom("");setCaravanTo("");}}><RotateCcw /></S.ResetFilterButton>
            </S.FilterActions>
          </S.PrimaryRegistrationFilters>
          <S.AdvancedCaravanFilters data-open={caravanAdvancedFilters} aria-hidden={!caravanAdvancedFilters} inert={!caravanAdvancedFilters}>
            <S.Field><span>Situação</span><select value={caravanStatus} onChange={(change)=>setCaravanStatus(change.target.value)}><option value="">Todas</option>{GROUP_STATUSES.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></S.Field>
            <S.Field><span>Pagamento</span><select value={caravanPayment} onChange={(change) => setCaravanPayment(change.target.value)}><option value="">Todos</option>{PAYMENT_STATUSES.filter(([value]) => ["NOT_REQUIRED", "PENDING", "PARTIAL", "PAID", "REFUNDED"].includes(value)).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></S.Field>
            <S.Field><span>Forma de pagamento</span><select value={caravanPaymentMethod} onChange={(change)=>setCaravanPaymentMethod(change.target.value)}><option value="">Todas</option>{PAYMENT_METHODS.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></S.Field>
            <S.Field><span>Origem</span><select value={caravanSource} onChange={(change) => setCaravanSource(change.target.value)}><option value="">Todas</option><option value="INTERNAL">Interna</option><option value="PUBLIC">Pública</option></select></S.Field>
            <S.Field><span>Lista</span><select value={caravanList} onChange={(change) => setCaravanList(change.target.value)}><option value="">Com ou sem lista</option><option value="WITH">Com lista</option><option value="WITHOUT">Sem lista</option></select></S.Field>
            <S.Field><span>Item</span><select value={caravanItem} onChange={(change)=>setCaravanItem(change.target.value)}><option value="">Todos</option>{initial.items.map((item)=><option key={item.id} value={item.id}>{item.name}</option>)}</select></S.Field>
            <S.Field><span>Cadastro inicial</span><input type="date" value={caravanFrom} onChange={(change)=>setCaravanFrom(change.target.value)}/></S.Field>
            <S.Field><span>Cadastro final</span><input type="date" value={caravanTo} onChange={(change)=>setCaravanTo(change.target.value)}/></S.Field>
          </S.AdvancedCaravanFilters>
          <S.FilterResult>{filteredCaravans.length} de {initial.groups.length} caravanas</S.FilterResult>
          {filteredCaravans.length ? <S.TableWrap><table><thead><tr><th>Caravana / origem</th><th>Responsável</th><th>Participantes</th><th>Total / recebido</th><th>Pagamento</th><th>Situação</th><th><span className="sr-only">Ações</span></th></tr></thead><tbody>{filteredCaravans.map((group) => <tr key={group.id}>
            <td><strong>{`${group.originCity}/${group.originState}`.toLocaleUpperCase("pt-BR")}</strong><br /><small>{group.originChurchName}</small></td>
            <td>{group.responsibleName}<br /><small>{group.responsiblePhone}</small></td>
            <td><strong>{group.total}</strong><br /><small>{group.maleCount} masc. · {group.femaleCount} fem.</small></td>
            <td><strong>{money(group.totalAmount)}</strong><br /><small>{money(group.paidAmount)} recebido</small></td>
            <td><S.StatusDot $tone={eventBadgeTone(group.paymentStatus)}>{eventLabel(PAYMENT_STATUSES, group.paymentStatus)}</S.StatusDot></td>
            <td><S.StatusDot $tone={eventBadgeTone(group.status)}>{eventLabel(GROUP_STATUSES, group.status)}</S.StatusDot></td>
            <td><S.ActionButton type="button" aria-label={`Ações da caravana de ${group.originCity}`} aria-haspopup="menu" aria-expanded={caravanMenu?.groupId===group.id} onClick={(click)=>{const rect=click.currentTarget.getBoundingClientRect();setCaravanMenu((current)=>current?.groupId===group.id?null:{groupId:group.id,left:Math.max(8,rect.right-210),top:Math.min(window.innerHeight-270,rect.bottom+4)});}}><EllipsisVertical /></S.ActionButton></td>
          </tr>)}</tbody></table></S.TableWrap> : <Empty title={initial.groups.length ? "Nenhuma caravana encontrada" : "Nenhuma caravana"} text={initial.groups.length ? "Ajuste os filtros para visualizar outros registros." : "Cadastre a primeira inscrição coletiva deste evento."} />}
        </Section>
      ) : null}

      {active === "items" ? (
        <Section title="Itens" description="Itens que podem ser selecionados durante a inscrição." action={can(PERMISSIONS.eventsManage) ? <Button onClick={() => setModal("item")}><Plus size={15} />Novo item</Button> : null}>
          {initial.items.length ? <S.TableWrap><table><thead><tr><th>Nome do item</th><th>Valor</th><th>Ações</th></tr></thead><tbody>{initial.items.map((item) => <tr key={item.id}><td><strong>{item.name}</strong></td><td>{money(item.price)}</td><td>{can(PERMISSIONS.eventsManage) ? <S.ActionButton $danger type="button" aria-label={`Excluir ${item.name}`} onClick={() => askConfirmation({ kind: "item", id: item.id, label: item.name })}><Trash2 /></S.ActionButton> : null}</td></tr>)}</tbody></table></S.TableWrap> : <Empty title="Nenhum item" text="Adicione inscrição, camiseta, alimentação ou outro item." icon={<Ticket />} />}
        </Section>
      ) : null}

      {active === "quotas" ? (
        <Section title="Cotas de inscrição" description="Metas por congregação. Elas acompanham o desempenho e nunca bloqueiam inscrições." action={can(PERMISSIONS.eventsManage) ? <Button onClick={() => setModal("quota")}><Plus size={15} />Nova meta</Button> : null}>
          {initial.quotas.length ? <S.TableWrap><table><thead><tr><th>Congregação</th><th>Meta</th><th>Inscrições atuais</th><th>Progresso</th><th>Situação</th><th>Ações</th></tr></thead><tbody>{initial.quotas.map((goal) => { const progress = percentage(goal.used, goal.quotaTotal); return <tr key={goal.id}><td><strong>{goal.label}</strong></td><td>{goal.quotaTotal}</td><td>{goal.used}</td><td><S.GoalProgress><span><i style={{ width: `${Math.min(progress, 100)}%` }} /></span><small>{progress}% atingido</small></S.GoalProgress></td><td><S.StatusDot $tone={progress >= 100 ? "success" : progress >= 60 ? "warning" : "neutral"}>{progress >= 100 ? "Meta atingida" : "Em andamento"}</S.StatusDot></td><td>{can(PERMISSIONS.eventsManage) ? <S.ActionButton $danger type="button" aria-label={`Excluir meta de ${goal.label}`} onClick={() => askConfirmation({ kind: "quota", id: goal.id, label: goal.label })}><Trash2 /></S.ActionButton> : null}</td></tr>; })}</tbody></table></S.TableWrap> : <Empty title="Nenhuma meta definida" text="Adicione a quantidade de inscrições esperada para cada congregação." icon={<CalendarCheck />} />}
        </Section>
      ) : null}

      {active === "checkin" ? (
        <Section title="Check-in" description="Este fluxo permanece sem alterações até a próxima etapa de remodelagem." action={can(PERMISSIONS.eventCheckin) ? <Link href={`/eventos/${event.id}/check-in`} className="app-button-primary"><QrCodeIcon size={15} />Abrir operação</Link> : null}>
          {initial.checkins.length ? <S.TableWrap><table><thead><tr><th>Participante</th><th>Método</th><th>Data</th><th>Situação</th></tr></thead><tbody>{initial.checkins.map((checkin) => <tr key={checkin.id}><td><strong>{checkin.participantName}</strong><br /><small>{checkin.registrationNumber}</small></td><td>{eventLabel(CHECKIN_METHODS, checkin.method)}</td><td>{checkin.checkedInAt ? formatDate(checkin.checkedInAt) : "—"}</td><td><S.StatusDot $tone={eventBadgeTone(checkin.status)}>{eventLabel(CHECKIN_STATUSES, checkin.status)}</S.StatusDot></td></tr>)}</tbody></table></S.TableWrap> : <Empty title="Nenhum check-in" text="A operação de presença ainda não foi iniciada." icon={<QrCodeIcon />} />}
        </Section>
      ) : null}

      {active === "documents" ? (
        <Section title="Documentos" description="Arquivos privados relacionados ao evento." action={can(PERMISSIONS.eventDocumentsManage) ? <Button onClick={() => setModal("document")}><FileUp size={15} />Enviar documento</Button> : null}>
          {initial.documents.length ? <S.TableWrap><table><thead><tr><th>Nome do documento</th><th>Arquivo</th><th>Envio</th><th>Ações</th></tr></thead><tbody>{initial.documents.map((document) => <tr key={document.id}><td><strong>{document.title}</strong></td><td>{document.fileName}</td><td>{formatDate(document.uploadedAt)}</td><td><S.TableActions><S.TableAction type="button" onClick={() => startTransition(async () => { const result = await getEventDocumentUrlAction(event.id, document.id); if (result.status === "success") window.open(result.data.url, "_blank", "noopener,noreferrer"); else setNotice({ message: result.message, danger: true }); })}><Download size={14} />Abrir</S.TableAction>{can(PERMISSIONS.eventDocumentsManage) ? <S.TableAction $danger type="button" onClick={() => askConfirmation({ kind: "document", id: document.id, label: document.title })}><Trash2 size={14} />Excluir</S.TableAction> : null}</S.TableActions></td></tr>)}</tbody></table></S.TableWrap> : <Empty title="Nenhum documento" text="Envie o primeiro arquivo deste evento." icon={<FileText />} />}
        </Section>
      ) : null}

      {active === "expenses" ? (
        <Section title={`Despesas · ${money(totalExpenses)}`} action={can(PERMISSIONS.eventExpensesManage) ? <Button onClick={() => setExpenseModal("new")}><Plus size={15} />Nova despesa</Button> : null}>
          <S.PrimaryRegistrationFilters>
            <S.Field><span>Buscar despesa</span><S.FilterSearch><Search aria-hidden="true" /><input value={expenseSearch} onChange={(event) => setExpenseSearch(event.target.value)} placeholder="Nome da despesa" /></S.FilterSearch></S.Field>
            <S.Field><span>Data inicial</span><input type="date" value={expenseFrom} onChange={(event) => setExpenseFrom(event.target.value)} /></S.Field>
            <S.Field><span>Data final</span><input type="date" value={expenseTo} onChange={(event) => setExpenseTo(event.target.value)} /></S.Field>
            <S.FilterActions><S.ResetFilterButton type="button" aria-label="Limpar filtros de despesas" disabled={!expenseSearch && !expenseFrom && !expenseTo} onClick={() => { setExpenseSearch(""); setExpenseFrom(""); setExpenseTo(""); }}><RotateCcw /></S.ResetFilterButton></S.FilterActions>
          </S.PrimaryRegistrationFilters>
          <S.FilterResult>{filteredExpenses.length} de {initial.expenses.length} despesas</S.FilterResult>
          {filteredExpenses.length ? <S.TableWrap><table><thead><tr><th>Despesa</th><th>Data</th><th>Valor</th><th>Comprovante</th><th><span className="sr-only">Ações</span></th></tr></thead><tbody>{filteredExpenses.map((expense) => <tr key={expense.id}><td><strong>{expense.name}</strong></td><td>{new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(`${expense.expenseDate}T12:00:00Z`))}</td><td><strong>{money(expense.amount)}</strong></td><td>{expense.receiptStoragePath ? <S.StatusDot $tone="success">Anexado</S.StatusDot> : <S.StatusDot $tone="neutral">Sem comprovante</S.StatusDot>}</td><td><S.ActionButton type="button" aria-label={`Ações de ${expense.name}`} aria-haspopup="menu" aria-expanded={expenseMenu?.expenseId === expense.id} onClick={(click) => { const rect = click.currentTarget.getBoundingClientRect(); setExpenseMenu((current) => current?.expenseId === expense.id ? null : { expenseId: expense.id, left: Math.max(8, rect.right - 210), top: Math.min(window.innerHeight - 160, rect.bottom + 4) }); }}><EllipsisVertical /></S.ActionButton></td></tr>)}</tbody></table></S.TableWrap> : <Empty title={expenseSearch || expenseFrom || expenseTo ? "Nenhuma despesa encontrada" : "Nenhuma despesa"} text={expenseSearch || expenseFrom || expenseTo ? "Ajuste ou limpe os filtros para ver outros registros." : "Cadastre a primeira despesa relacionada a este evento."} icon={<ReceiptText />} />}
        </Section>
      ) : null}

      {active === "reports" ? (
        <EventReportBuilder data={initial} onNotice={(next) => setNotice(next)} />
      ) : null}

      {menu && typeof document !== "undefined" ? createPortal(<RegistrationMenu
        menuRef={menuRef}
        style={{ left: menu.left, top: menu.top }}
        registration={initial.registrations.find((item) => item.id === menu.registrationId)!}
        canManage={can(PERMISSIONS.eventRegistrationsManage)}
        canPay={can(PERMISSIONS.eventPaymentsManage)}
        onClose={() => setMenu(null)}
        onDetails={(registration) => setRegistrationModal({ kind: "details", registration })}
        onEdit={(registration) => setRegistrationModal({ kind: "edit", registration })}
        onPayment={(registration) => setRegistrationModal({ kind: "payment", registration })}
        onApprovePayment={(registration) => askConfirmation({ kind: "approvePayment", registration })}
        onQr={(registration) => execute(async () => { const result = await reissueQrAction(registration.id, event.id); if (result.status === "success") setCredential({ token: String(result.data.qrToken ?? ""), number: String(result.data.registrationNumber ?? registration.registrationNumber ?? "") }); return result; }, false)}
        onCancel={(registration) => askConfirmation({ kind: "registration", registration })}
      />, document.body) : null}

      {caravanMenu && typeof document !== "undefined" ? createPortal(<CaravanMenu
        menuRef={caravanMenuRef}
        style={{left:caravanMenu.left,top:caravanMenu.top}}
        group={initial.groups.find((item)=>item.id===caravanMenu.groupId)!}
        eventId={event.id}
        canManage={can(PERMISSIONS.eventGroupsManage)}
        canPay={can(PERMISSIONS.eventPaymentsManage)}
        onClose={()=>setCaravanMenu(null)}
        onDetails={(group)=>setCaravanModal({kind:"details",group})}
        onEdit={(group)=>setCaravanModal({kind:"edit",group})}
        onPayment={(group)=>setCaravanModal({kind:"payment",group})}
        onCancel={(group)=>askConfirmation({kind:"group",id:group.id,label:`${group.originChurchName} · ${group.originCity}/${group.originState}`})}
      />,document.body):null}

      {expenseMenu && typeof document !== "undefined" ? createPortal(<ExpenseMenu
        menuRef={expenseMenuRef}
        style={{ left: expenseMenu.left, top: expenseMenu.top }}
        expense={initial.expenses.find((item) => item.id === expenseMenu.expenseId)!}
        canManage={can(PERMISSIONS.eventExpensesManage)}
        onClose={() => setExpenseMenu(null)}
        onOpen={(expense) => startTransition(async () => { const result = await getEventExpenseReceiptUrlAction(event.id, expense.id); if (result.status === "success") window.open(result.data.url, "_blank", "noopener,noreferrer"); else setNotice({ message: result.message, danger: true }); })}
        onEdit={(expense) => setExpenseModal(expense)}
        onDelete={(expense) => askConfirmation({ kind: "expense", id: expense.id, label: expense.name })}
      />, document.body) : null}

      {modal ? <ConfigurationModal kind={modal} data={initial} busy={pending} onClose={() => setModal(null)} execute={execute} /> : null}
      {registrationModal?.kind === "details" ? <RegistrationDetailsModal data={initial} registration={registrationModal.registration} busy={pending} canDeletePayment={can(PERMISSIONS.eventPaymentsManage)} onClose={() => setRegistrationModal(null)} onOpenReceipt={(paymentId) => startTransition(async () => { const result = await getPaymentReceiptUrlAction(event.id, paymentId); if (result.status === "success") window.open(result.data.url, "_blank", "noopener,noreferrer"); else setNotice({ message: result.message, danger: true }); })} onDeletePayment={(paymentId, label) => askConfirmation({ kind: "payment", id: paymentId, label })} /> : null}
      {registrationModal?.kind === "payment" ? <PaymentModal eventId={event.id} registration={registrationModal.registration} busy={pending} onClose={() => setRegistrationModal(null)} execute={execute} /> : null}
      {registrationModal?.kind === "edit" ? <EditRegistrationModal data={initial} registration={registrationModal.registration} busy={pending} onClose={() => setRegistrationModal(null)} execute={execute} /> : null}
      {caravanModal?.kind === "details" ? <CaravanDetailsModal data={initial} group={caravanModal.group} busy={pending} canApprove={can(PERMISSIONS.eventPaymentsApprove)} onClose={() => setCaravanModal(null)} execute={execute} /> : null}
      {caravanModal?.kind === "payment" ? <CaravanPaymentModal data={initial} group={caravanModal.group} busy={pending} onClose={() => setCaravanModal(null)} execute={execute} /> : null}
      {caravanModal?.kind === "edit" ? <GroupModal data={initial} group={caravanModal.group} busy={pending} onClose={() => setCaravanModal(null)} execute={execute} /> : null}
      {expenseModal ? <ExpenseModal data={initial} expense={expenseModal === "new" ? null : expenseModal} busy={pending} onClose={() => setExpenseModal(null)} execute={execute} /> : null}
      {credential ? <Modal open title={`Credencial ${credential.number}`} icon={<QrCodeIcon />} onClose={() => setCredential(null)}><div style={{ display: "grid", placeItems: "center", gap: 14 }}><QrCode value={credential.token} /><code style={{ wordBreak: "break-all" }}>{credential.token}</code></div></Modal> : null}
      {confirmation ? <Modal open size="sm" title={confirmation.kind === "registration" ? "Cancelar inscrição" : confirmation.kind === "group" ? "Excluir caravana" : confirmation.kind === "approvePayment" ? "Aprovar pagamento" : confirmation.kind === "payment" ? "Excluir pagamento" : "Confirmar exclusão"} description={confirmation.kind === "approvePayment" ? "O pagamento pendente será confirmado manualmente e ficará registrado no histórico." : confirmation.kind === "payment" ? "Esta ação removerá o pagamento selecionado." : confirmation.kind === "registration" || confirmation.kind === "group" ? "O histórico será preservado. Informe o motivo para continuar." : "Esta operação removerá o registro selecionado."} icon={confirmation.kind === "approvePayment" ? <BadgeDollarSign /> : <Trash2 />} onClose={() => setConfirmation(null)} busy={pending} footer={<S.ModalFooter><Button variant="outline" onClick={() => setConfirmation(null)} disabled={pending}>Voltar</Button><Button variant={confirmation.kind === "approvePayment" ? "primary" : "danger"} onClick={confirmWorkspaceAction} loading={pending} disabled={(confirmation.kind === "registration" || confirmation.kind === "group") && confirmationReason.trim().length < 3}>{confirmation.kind === "approvePayment" ? "Aprovar pagamento" : confirmation.kind === "registration" ? "Confirmar cancelamento" : "Confirmar exclusão"}</Button></S.ModalFooter>}>
        {confirmation.kind === "approvePayment" ? <S.ApprovalNotice>Inscrição: <strong>{confirmation.registration.participantName}</strong></S.ApprovalNotice> : <S.DeleteWarning>Selecionado: <strong>{confirmation.kind === "registration" ? confirmation.registration.participantName : confirmation.label}</strong></S.DeleteWarning>}
        {confirmation.kind === "registration" || confirmation.kind === "group" ? <S.Field style={{ marginTop: 14 }}><span>Motivo *</span><textarea data-autofocus value={confirmationReason} onChange={(change) => setConfirmationReason(change.target.value)} maxLength={1000} placeholder="Descreva o motivo" /></S.Field> : null}
      </Modal> : null}
      <ToastViewport>{notice ? <Toast title={notice.danger ? "Ação não concluída" : "Tudo certo"} description={notice.message} variant={notice.danger ? "danger" : "success"} onClose={() => setNotice(null)} /> : null}</ToastViewport>
    </S.Module>
  );
}

const RegistrationMenu = ({ registration, canManage, canPay, onClose, onDetails, onEdit, onPayment, onApprovePayment, onQr, onCancel, menuRef, ...props }: {
  registration: RegistrationRow; canManage: boolean; canPay: boolean; onClose: () => void;
  onDetails: (registration: RegistrationRow) => void; onPayment: (registration: RegistrationRow) => void;
  onEdit: (registration: RegistrationRow) => void;
  onApprovePayment: (registration: RegistrationRow) => void;
  onQr: (registration: RegistrationRow) => void; onCancel: (registration: RegistrationRow) => void;
  menuRef: React.RefObject<HTMLDivElement | null>;
} & React.HTMLAttributes<HTMLDivElement>) => <S.Menu {...props} ref={menuRef} role="menu">
  <button role="menuitem" onClick={() => { onDetails(registration); onClose(); }}><Eye />Ver detalhes</button>
  {canManage && registration.status !== "CANCELLED" ? <button role="menuitem" onClick={() => { onEdit(registration); onClose(); }}><Pencil />Editar inscrição</button> : null}
  {canPay && registration.remainingAmount > 0 && !["CANCELLED", "EXPIRED"].includes(registration.status) ? <button role="menuitem" onClick={() => { onApprovePayment(registration); onClose(); }}><BadgeDollarSign />Aprovar pagamento</button> : null}
  {canPay && registration.remainingAmount > 0 && !["CANCELLED", "EXPIRED"].includes(registration.status) ? <button role="menuitem" onClick={() => { onPayment(registration); onClose(); }}><CreditCard />Registrar pagamento</button> : null}
  {canManage && registration.status === "CONFIRMED" ? <button role="menuitem" onClick={() => { onQr(registration); onClose(); }}><QrCodeIcon />Reemitir QR Code</button> : null}
  {canManage && !["CANCELLED", "EXPIRED"].includes(registration.status) ? <button role="menuitem" data-danger onClick={() => { onCancel(registration); onClose(); }}><Trash2 />Cancelar inscrição</button> : null}
</S.Menu>;

const CaravanMenu = ({group,eventId,canManage,canPay,onClose,onDetails,onEdit,onPayment,onCancel,menuRef,...props}:{
  group:GroupRow;eventId:string;canManage:boolean;canPay:boolean;onClose:()=>void;
  onDetails:(group:GroupRow)=>void;onEdit:(group:GroupRow)=>void;onPayment:(group:GroupRow)=>void;onCancel:(group:GroupRow)=>void;
  menuRef:React.RefObject<HTMLDivElement|null>;
}&React.HTMLAttributes<HTMLDivElement>)=><S.Menu {...props} ref={menuRef} role="menu">
  <button role="menuitem" onClick={()=>{onDetails(group);onClose();}}><Eye/>Ver detalhes</button>
  {canManage&&group.status==="CONFIRMED"?<button role="menuitem" onClick={()=>{onEdit(group);onClose();}}><Pencil/>Editar caravana</button>:null}
  {canPay&&group.remainingAmount>0&&group.status==="CONFIRMED"?<button role="menuitem" onClick={()=>{onPayment(group);onClose();}}><CreditCard/>Registrar pagamento</button>:null}
  <a role="menuitem" href={`/api/events/${eventId}/caravans/${group.id}/receipt`} target="_blank" rel="noreferrer" onClick={onClose}><Download/>Comprovante de inscrição</a>
  {canManage&&group.status==="CONFIRMED"?<button role="menuitem" data-danger onClick={()=>{onCancel(group);onClose();}}><Trash2/>Excluir caravana</button>:null}
</S.Menu>;

const ExpenseMenu = ({ expense, canManage, onClose, onOpen, onEdit, onDelete, menuRef, ...props }: {
  expense: EventExpenseRow;
  canManage: boolean;
  onClose: () => void;
  onOpen: (expense: EventExpenseRow) => void;
  onEdit: (expense: EventExpenseRow) => void;
  onDelete: (expense: EventExpenseRow) => void;
  menuRef: React.RefObject<HTMLDivElement | null>;
} & React.HTMLAttributes<HTMLDivElement>) => <S.Menu {...props} ref={menuRef} role="menu">
  {expense.receiptStoragePath ? <button role="menuitem" onClick={() => { onOpen(expense); onClose(); }}><Eye />Visualizar comprovante</button> : null}
  {canManage ? <button role="menuitem" onClick={() => { onEdit(expense); onClose(); }}><Pencil />Editar despesa</button> : null}
  {canManage ? <button role="menuitem" data-danger onClick={() => { onDelete(expense); onClose(); }}><Trash2 />Excluir despesa</button> : null}
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
  const [kind, setKind] = useState<"MEMBER" | "VISITOR">("MEMBER");
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
  const [roleId, setRoleId] = useState("");
  const [standardValues, setStandardValues] = useState<Record<string, string>>({ participantEmail: "", participantDocument: "", participantBirthDate: "", participantCity: "", participantState: "", responsibleName: "", responsiblePhone: "" });
  const [customValues, setCustomValues] = useState<Record<string, unknown>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
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
  const selectedItemRows = data.items.filter((item) => selectedItems.has(item.id));
  const total = selectedItemRows.reduce((sum, item) => sum + item.price, 0);
  const orderedFields = useMemo(() => visibleRegistrationFields(data.registrationFields), [data.registrationFields]);

  function renderRegistrationField(field: EventRegistrationFieldRow) {
    const isRequired = field.visibility === "REQUIRED";
    const label = `${field.label}${isRequired ? " *" : ""}`;
    if (field.kind === "CUSTOM") return <DynamicCustomField field={field} values={customValues} onChange={setCustomValues} />;
    if (field.key === "participant_name") return kind === "MEMBER" ? (
      <S.Wide><S.Field><span>{label}</span><S.SearchBox aria-busy={searching}>
        <input data-autofocus required={isRequired} aria-invalid={submitAttempted && !selectedMember} value={query} onChange={(event) => { const next = event.target.value; const readyToSearch = next.trim().length >= 2; setSelectedMember(null); setQuery(next); setName(next); setRoleId(""); setSearching(false); if (!readyToSearch) setResults([]); }} onKeyDown={(event) => { if (!results.length) return; if (event.key === "ArrowDown") { event.preventDefault(); setHighlighted((current) => Math.min(current + 1, results.length - 1)); } if (event.key === "ArrowUp") { event.preventDefault(); setHighlighted((current) => Math.max(current - 1, 0)); } if (event.key === "Enter") { event.preventDefault(); choose(results[highlighted]); } if (event.key === "Escape") setResults([]); }} placeholder="Digite ao menos 2 caracteres" autoComplete="off" />
        {query.trim().length === 1 ? <S.SearchHint><strong>Mais 1 caractere</strong></S.SearchHint> : null}
        {searching ? <LoaderCircle data-loading aria-label="Buscando membros" /> : <Search aria-hidden="true" />}
        {results.length ? <S.SearchResults role="listbox">{results.map((member, index) => <button type="button" role="option" aria-selected={index === highlighted} key={member.id} onMouseEnter={() => setHighlighted(index)} onClick={() => choose(member)}><strong>{member.fullName}</strong><small>{member.regionName || "Sem regional"} · {member.congregationName}{member.roleName ? ` · ${member.roleName}` : ""}</small></button>)}</S.SearchResults> : null}
      </S.SearchBox></S.Field></S.Wide>
    ) : <S.Wide><S.Field><span>{label}</span><input data-autofocus required={isRequired} minLength={3} value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome do participante" /></S.Field></S.Wide>;
    if (field.key === "participant_gender") return <S.Field><span>{label}</span><select required={isRequired} value={gender} onChange={(event) => setGender(event.target.value)} disabled={kind === "MEMBER" && Boolean(selectedMember) && Boolean(gender)}><option value="">Selecione</option><option value="MALE">Masculino</option><option value="FEMALE">Feminino</option></select></S.Field>;
    if (field.key === "participant_phone") return <S.Field><span>{label}</span><input required={isRequired} minLength={isRequired ? 8 : undefined} value={phone} onChange={(event) => setPhone(formatBrazilPhone(event.target.value))} placeholder="(00) 00000-0000" inputMode="tel" /></S.Field>;
    if (field.key === "participant_email") return <S.Field><span>{label}</span><input type="email" required={isRequired} value={standardValues.participantEmail} onChange={(event) => setStandardValues((current) => ({ ...current, participantEmail: event.target.value }))} /></S.Field>;
    if (field.key === "participant_document") return <S.Field><span>{label}</span><input required={isRequired} value={standardValues.participantDocument} onChange={(event) => setStandardValues((current) => ({ ...current, participantDocument: event.target.value }))} /></S.Field>;
    if (field.key === "participant_birth_date") return <S.Field><span>{label}</span><input type="date" required={isRequired} value={standardValues.participantBirthDate} onChange={(event) => setStandardValues((current) => ({ ...current, participantBirthDate: event.target.value }))} /></S.Field>;
    if (field.key === "region_id") return <S.Field><span>{label}</span><select required={isRequired} value={regionId} onChange={(event) => { setRegionId(event.target.value); setCongregationId(""); }} disabled={kind === "MEMBER" && Boolean(selectedMember)}><option value="">Sem regional</option>{data.references.regions.map((region) => <option key={region.id} value={region.id}>{region.name}</option>)}</select></S.Field>;
    if (field.key === "congregation_id") return <S.Field><span>{label}</span><select required={isRequired} value={congregationId} onChange={(event) => setCongregationId(event.target.value)} disabled={kind === "MEMBER" && Boolean(selectedMember)}><option value="">Sem congregação</option>{congregations.map((congregation) => <option key={congregation.id} value={congregation.id}>{congregation.name}</option>)}</select></S.Field>;
    if (field.key === "participant_role_id") return <S.Field><span>{label}</span><select required={isRequired} value={roleId} onChange={(event) => setRoleId(event.target.value)}><option value="">Sem cargo informado</option>{data.references.roles.map((role) => <option key={role.id} value={role.id}>{gender === "FEMALE" ? role.femaleName ?? role.name : role.name}</option>)}</select></S.Field>;
    if (field.key === "participant_city") return <S.Field><span>{label}</span><input required={isRequired} value={standardValues.participantCity} onChange={(event) => setStandardValues((current) => ({ ...current, participantCity: event.target.value }))} /></S.Field>;
    if (field.key === "participant_state") return <S.Field><span>{label}</span><input maxLength={2} required={isRequired} value={standardValues.participantState} onChange={(event) => setStandardValues((current) => ({ ...current, participantState: event.target.value.toUpperCase() }))} /></S.Field>;
    if (field.key === "responsible_name") return <S.Field><span>{label}</span><input required={isRequired} value={standardValues.responsibleName} onChange={(event) => setStandardValues((current) => ({ ...current, responsibleName: event.target.value }))} /></S.Field>;
    if (field.key === "responsible_phone") return <S.Field><span>{label}</span><input required={isRequired} value={standardValues.responsiblePhone} onChange={(event) => setStandardValues((current) => ({ ...current, responsiblePhone: formatBrazilPhone(event.target.value) }))} /></S.Field>;
    if (field.key === "preferred_payment_method" && data.event.requiresPayment) return <S.Field><span>{field.label}</span><select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>{PAYMENT_METHODS.map(([value, optionLabel]) => <option key={value} value={value}>{optionLabel}</option>)}</select></S.Field>;
    if (field.key === "items" && data.items.some((item) => item.active)) return <S.Wide><div><strong style={{ color: "#344054", fontSize: 12 }}>{field.label}</strong><S.ItemCards>{data.items.filter((item) => item.active).map((item) => <SelectableItem key={item.id} item={item} selected={selectedItems.has(item.id)} onToggle={() => setSelectedItems((current) => { const next = new Set(current); if (next.has(item.id) && !item.required) next.delete(item.id); else next.add(item.id); return next; })} />)}</S.ItemCards></div></S.Wide>;
    return null;
  }

  function choose(member: EventMemberReference) {
    setSelectedMember(member);
    setQuery(member.fullName);
    setName(member.fullName);
    setGender(member.gender ?? "");
    setPhone(formatBrazilPhone(member.phone ?? ""));
    setRegionId(member.regionId ?? "");
    setCongregationId(member.congregationId);
    setRoleId(member.roleId ?? "");
    setResults([]);
    setSearching(false);
  }

  function changeKind(next: "MEMBER" | "VISITOR") {
    setKind(next);
    setSelectedMember(null);
    setQuery("");
    setName("");
    setGender("");
    setPhone("");
    setRegionId("");
    setCongregationId("");
    setRoleId("");
    setResults([]);
    setSearching(false);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitAttempted(true);
    if (kind === "MEMBER" && !selectedMember) return;
    execute(() => createRegistrationAction({ eventId: data.event.id, participantKind: kind, memberId: selectedMember?.id ?? "", regionId, congregationId, participantName: name, participantGender: gender, participantPhone: phone, participantEmail: standardValues.participantEmail, participantDocument: standardValues.participantDocument, participantBirthDate: standardValues.participantBirthDate, participantCity: standardValues.participantCity, participantState: standardValues.participantState, responsibleName: standardValues.responsibleName, responsiblePhone: standardValues.responsiblePhone, participantRoleId: roleId, preferredPaymentMethod: data.event.requiresPayment ? paymentMethod : "NOT_APPLICABLE", items: [...selectedItems].map((itemId) => ({ itemId, quantity: 1 })), customFields: customValues }));
  }

  return (
    <Modal open title="Nova inscrição" description="Um processo rápido para membros e visitantes." icon={<UserRound />} onClose={onClose} busy={busy} size="lg" footer={<S.ModalFooter><Button variant="outline" onClick={onClose} disabled={busy}>Cancelar</Button><Button type="submit" form={formId} loading={busy}>Criar inscrição</Button></S.ModalFooter>}>
      <S.ModalForm id={formId} onSubmit={submit} data-submit-attempted={submitAttempted}>
        <S.ChoiceTabs><button type="button" aria-pressed={kind === "MEMBER"} onClick={() => changeKind("MEMBER")}>Sou membro</button><button type="button" aria-pressed={kind === "VISITOR"} onClick={() => changeKind("VISITOR")}>Sou visitante</button></S.ChoiceTabs>
        <S.FieldGrid>
          {orderedFields.map((field) => <Fragment key={field.id || field.key}>{renderRegistrationField(field)}</Fragment>)}
        </S.FieldGrid>
        <S.ModalSummary>
          <header><span>Resumo da inscrição</span><strong>{money(total)}</strong></header>
          {selectedItemRows.length ? <ul>{selectedItemRows.map((item) => <li key={item.id}><span>{item.name}</span><strong>{money(item.price)}</strong></li>)}</ul> : <p>Nenhum item selecionado.</p>}
        </S.ModalSummary>
      </S.ModalForm>
    </Modal>
  );
}

function DynamicCustomField({ field, values, onChange }: { field: EventRegistrationFieldRow; values: Record<string, unknown>; onChange: (next: Record<string, unknown>) => void }) {
  const set = (key: string, value: unknown) => onChange({ ...values, [key]: value });
  const required = field.visibility === "REQUIRED";
  const label = `${field.label}${required ? " *" : ""}`;
  if (field.type === "LONG_TEXT") return <S.Wide><S.Field><span>{label}</span><textarea required={required} maxLength={3000} value={String(values[field.key] ?? "")} onChange={(event) => set(field.key, event.target.value)} />{field.helpText ? <small>{field.helpText}</small> : null}</S.Field></S.Wide>;
  if (field.type === "SINGLE_SELECT") return <S.Field><span>{label}</span><select required={required} value={String(values[field.key] ?? "")} onChange={(event) => set(field.key, event.target.value)}><option value="">Selecione</option>{field.options.map((option) => <option key={option} value={option}>{option}</option>)}</select>{field.helpText ? <small>{field.helpText}</small> : null}</S.Field>;
  if (field.type === "BOOLEAN") return <S.Check><input type="checkbox" required={required} checked={Boolean(values[field.key])} onChange={(event) => set(field.key, event.target.checked)} />{field.label}</S.Check>;
  return <S.Field><span>{label}</span><input type={field.type === "DATE" ? "date" : field.type === "NUMBER" ? "number" : "text"} maxLength={field.type === "SHORT_TEXT" ? 300 : undefined} required={required} value={String(values[field.key] ?? "")} onChange={(event) => set(field.key, field.type === "NUMBER" && event.target.value ? Number(event.target.value) : event.target.value)} />{field.helpText ? <small>{field.helpText}</small> : null}</S.Field>;
}

function EditRegistrationModal({ data, registration, busy, onClose, execute }: { data: EventWorkspaceData; registration: RegistrationRow; busy: boolean; onClose: () => void; execute: (task: () => Promise<ActionResult>) => void }) {
  const formId = `edit-registration-${registration.id}`;
  const [values, setValues] = useState({
    participantName: registration.participantName, participantGender: registration.participantGender ?? "", participantPhone: registration.participantPhone ?? "",
    participantEmail: registration.participantEmail ?? "", participantDocument: registration.participantDocument ?? "", participantBirthDate: registration.participantBirthDate ?? "",
    participantCity: registration.participantCity ?? "", participantState: registration.participantState ?? "", responsibleName: registration.responsibleName ?? "",
    responsiblePhone: registration.responsiblePhone ?? "", regionId: registration.regionId ?? "", congregationId: registration.congregationId ?? "",
    participantRoleId: registration.participantRoleId ?? "", preferredPaymentMethod: registration.preferredPaymentMethod ?? (data.event.requiresPayment ? "PIX" : "NOT_APPLICABLE"),
  });
  const [customValues, setCustomValues] = useState<Record<string, unknown>>(registration.customFieldValues);
  const [quantities, setQuantities] = useState<Record<string, number>>(() => ({ ...registration.itemQuantities }));
  const orderedFields = useMemo(() => visibleRegistrationFields(data.registrationFields), [data.registrationFields]);
  const congregations = data.references.congregations.filter((item) => !values.regionId || item.regionId === values.regionId);
  const selectedItems = data.items.filter((item) => (quantities[item.id] ?? 0) > 0);
  const historicalAnswers = data.registrationFields.filter((field) => field.kind === "CUSTOM" && (!field.active || field.visibility === "HIDDEN") && registration.customFieldValues[field.key] !== undefined).map((field) => ({
    key: field.key,
    label: field.label,
    value: typeof registration.customFieldValues[field.key] === "boolean" ? (registration.customFieldValues[field.key] ? "Sim" : "Não") : String(registration.customFieldValues[field.key] ?? "—"),
  }));
  const total = selectedItems.reduce((sum, item) => sum + item.price * (quantities[item.id] ?? 0), 0);
  const set = (key: keyof typeof values, value: string) => setValues((current) => ({ ...current, [key]: value }));
  function renderRegistrationField(field: EventRegistrationFieldRow) {
    const isRequired = field.visibility === "REQUIRED";
    const label = `${field.label}${isRequired ? " *" : ""}`;
    if (field.kind === "CUSTOM") return <DynamicCustomField field={field} values={customValues} onChange={setCustomValues} />;
    if (field.key === "participant_name") return <S.Wide><S.Field><span>{label}</span><input required={isRequired} minLength={3} value={values.participantName} onChange={(event) => set("participantName", event.target.value)} /></S.Field></S.Wide>;
    if (field.key === "participant_gender") return <S.Field><span>{label}</span><select required={isRequired} value={values.participantGender} onChange={(event) => set("participantGender", event.target.value)}><option value="">Selecione</option><option value="MALE">Masculino</option><option value="FEMALE">Feminino</option></select></S.Field>;
    if (field.key === "participant_phone") return <S.Field><span>{label}</span><input required={isRequired} value={values.participantPhone} onChange={(event) => set("participantPhone", formatBrazilPhone(event.target.value))} /></S.Field>;
    if (field.key === "participant_email") return <S.Field><span>{label}</span><input type="email" required={isRequired} value={values.participantEmail} onChange={(event) => set("participantEmail", event.target.value)} /></S.Field>;
    if (field.key === "participant_document") return <S.Field><span>{label}</span><input required={isRequired} value={values.participantDocument} onChange={(event) => set("participantDocument", event.target.value)} /></S.Field>;
    if (field.key === "participant_birth_date") return <S.Field><span>{label}</span><input type="date" required={isRequired} value={values.participantBirthDate} onChange={(event) => set("participantBirthDate", event.target.value)} /></S.Field>;
    if (field.key === "region_id") return <S.Field><span>{label}</span><select required={isRequired} value={values.regionId} onChange={(event) => setValues((current) => ({ ...current, regionId: event.target.value, congregationId: "" }))}><option value="">Sem regional</option>{data.references.regions.map((region) => <option key={region.id} value={region.id}>{region.name}</option>)}</select></S.Field>;
    if (field.key === "congregation_id") return <S.Field><span>{label}</span><select required={isRequired} value={values.congregationId} onChange={(event) => set("congregationId", event.target.value)}><option value="">Sem congregação</option>{congregations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></S.Field>;
    if (field.key === "participant_role_id") return <S.Field><span>{label}</span><select required={isRequired} value={values.participantRoleId} onChange={(event) => set("participantRoleId", event.target.value)}><option value="">Sem cargo</option>{data.references.roles.map((role) => <option key={role.id} value={role.id}>{values.participantGender === "FEMALE" ? role.femaleName ?? role.name : role.name}</option>)}</select></S.Field>;
    if (field.key === "participant_city") return <S.Field><span>{label}</span><input required={isRequired} value={values.participantCity} onChange={(event) => set("participantCity", event.target.value)} /></S.Field>;
    if (field.key === "participant_state") return <S.Field><span>{label}</span><input maxLength={2} required={isRequired} value={values.participantState} onChange={(event) => set("participantState", event.target.value.toUpperCase())} /></S.Field>;
    if (field.key === "responsible_name") return <S.Field><span>{label}</span><input required={isRequired} value={values.responsibleName} onChange={(event) => set("responsibleName", event.target.value)} /></S.Field>;
    if (field.key === "responsible_phone") return <S.Field><span>{label}</span><input required={isRequired} value={values.responsiblePhone} onChange={(event) => set("responsiblePhone", formatBrazilPhone(event.target.value))} /></S.Field>;
    if (field.key === "preferred_payment_method" && data.event.requiresPayment) return <S.Field><span>{field.label}</span><select value={values.preferredPaymentMethod} onChange={(event) => set("preferredPaymentMethod", event.target.value)}>{PAYMENT_METHODS.map(([key, optionLabel]) => <option key={key} value={key}>{optionLabel}</option>)}</select></S.Field>;
    if (field.key === "items" && data.items.some((item) => item.active)) return <S.Wide><div><strong style={{ color: "#344054", fontSize: 12 }}>{field.label}</strong><S.ItemCards>{data.items.filter((item) => item.active).map((item) => { const quantity = quantities[item.id] ?? 0; const checked = quantity > 0; return <S.ItemCard key={item.id} $selected={checked}><input type="checkbox" checked={checked} disabled={registration.status === "CHECKED_IN" || item.required} onChange={(event) => setQuantities((current) => ({ ...current, [item.id]: event.target.checked ? Math.max(item.minQuantity, 1) : 0 }))} /><Ticket /><strong>{item.name}</strong><small>{money(item.price)}{item.required ? " · obrigatório" : ""}</small>{checked && item.allowQuantity ? <input aria-label={`Quantidade de ${item.name}`} type="number" min={Math.max(item.minQuantity, 1)} max={item.maxQuantity ?? item.availableQuantity ?? undefined} value={quantity} disabled={registration.status === "CHECKED_IN"} onChange={(event) => setQuantities((current) => ({ ...current, [item.id]: Number(event.target.value) }))} /> : null}</S.ItemCard>; })}</S.ItemCards>{registration.status === "CHECKED_IN" ? <S.FilterResult>Os itens não podem ser alterados após o check-in.</S.FilterResult> : null}</div></S.Wide>;
    return null;
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const editableCustomFields = Object.fromEntries(data.registrationFields
      .filter((field) => field.kind === "CUSTOM" && field.active && field.visibility !== "HIDDEN" && customValues[field.key] !== undefined)
      .map((field) => [field.key, customValues[field.key]]));
    execute(() => updateRegistrationAction({
      eventId: data.event.id, registrationId: registration.id, expectedUpdatedAt: registration.updatedAt, ...values,
      items: selectedItems.map((item) => ({ itemId: item.id, quantity: quantities[item.id] })), customFields: editableCustomFields,
    }));
  }
  return <Modal open title={`Editar inscrição — ${registration.participantName}`} description={`${registration.registrationNumber ?? "Inscrição"} · vínculo, origem, data, pagamentos e QR permanecem inalterados.`} icon={<Pencil />} onClose={onClose} busy={busy} size="lg" footer={<S.ModalFooter><Button variant="outline" onClick={onClose} disabled={busy}>Cancelar</Button><Button type="submit" form={formId} loading={busy}>Salvar alterações</Button></S.ModalFooter>}>
    <S.ModalForm id={formId} onSubmit={submit}>
      {registration.memberId ? <S.InfoBox><UserRound /><div><strong>Snapshot do membro</strong><p>As alterações feitas aqui valem apenas para esta inscrição e não modificam o cadastro do membro.</p></div></S.InfoBox> : null}
      <S.FieldGrid>
        {orderedFields.map((field) => <Fragment key={field.id || field.key}>{renderRegistrationField(field)}</Fragment>)}
      </S.FieldGrid>
      {historicalAnswers.length ? <S.PaymentHistory><strong>Respostas históricas (somente leitura)</strong><S.OperationalList>{historicalAnswers.map((answer) => <div key={answer.key}><dt>{answer.label}</dt><dd>{answer.value}</dd></div>)}</S.OperationalList></S.PaymentHistory> : null}
      <S.ModalSummary><header><span>Novo total da inscrição</span><strong>{money(total)}</strong></header><p>Já recebido: {money(registration.paidAmount)}</p></S.ModalSummary>
    </S.ModalForm>
  </Modal>;
}

function ExpenseModal({ data, expense, busy, onClose, execute }: { data: EventWorkspaceData; expense: EventExpenseRow | null; busy: boolean; onClose: () => void; execute: (task: () => Promise<ActionResult>) => void }) {
  const formId = `event-expense-${expense?.id ?? "new"}`;
  const [file, setFile] = useState<File | null>(null);
  const [amount, setAmount] = useState(formatBrazilCurrencyInput(String(Math.round((expense?.amount ?? 0) * 100))));
  return <Modal open title={expense ? "Editar despesa" : "Nova despesa"} description="Registre uma despesa reconhecida pelo evento. O comprovante é opcional." icon={<ReceiptText />} onClose={onClose} busy={busy} size="lg" footer={<S.ModalFooter><Button variant="outline" onClick={onClose} disabled={busy}>Cancelar</Button><Button type="submit" form={formId} loading={busy}>Salvar despesa</Button></S.ModalFooter>}>
    <S.ModalForm id={formId} onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); execute(async () => {
      let receipt = { receiptPath: "", receiptFileName: "", receiptMimeType: "", receiptFileSize: 0 };
      if (file) {
        const prepared = await prepareEventExpenseReceiptAction(data.event.id, { name: file.name, type: file.type, size: file.size });
        if (prepared.status === "error") return prepared;
        const upload = await createClient().storage.from("event-documents").uploadToSignedUrl(prepared.data.path, prepared.data.token, file, { contentType: file.type });
        if (upload.error) return { status: "error", message: "Não foi possível enviar o comprovante." };
        receipt = { receiptPath: prepared.data.path, receiptFileName: file.name, receiptMimeType: file.type, receiptFileSize: file.size };
      }
      return saveEventExpenseAction({ id: expense?.id ?? "", eventId: data.event.id, name: form.get("name"), expenseDate: form.get("expenseDate"), amount: parseBrazilCurrencyInput(amount), expectedUpdatedAt: expense?.updatedAt ?? "", ...receipt });
    }); }}>
      <S.FieldGrid>
        <S.Wide><S.Field><span>Nome da despesa *</span><input data-autofocus name="name" required minLength={2} maxLength={150} defaultValue={expense?.name ?? ""} /></S.Field></S.Wide>
        <S.Field><span>Data *</span><input name="expenseDate" type="date" required defaultValue={expense?.expenseDate ?? new Date().toISOString().slice(0, 10)} /></S.Field>
        <S.Field><span>Valor *</span><input required value={amount} onChange={(event) => setAmount(formatBrazilCurrencyInput(event.target.value))} inputMode="numeric" /></S.Field>
        <S.Wide><S.DropField><input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /><UploadCloud /><strong>{file?.name ?? expense?.receiptFileName ?? "Selecionar comprovante"}</strong><small>{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : expense?.receiptFileName ? "Envie outro arquivo para substituir" : "PDF ou imagem de até 10 MB"}</small></S.DropField></S.Wide>
      </S.FieldGrid>
    </S.ModalForm>
  </Modal>;
}

function SelectableItem({ item, selected, onToggle }: { item: EventItemRow; selected: boolean; onToggle: () => void }) {
  const Icon = itemIcons[item.type] ?? Ticket;
  return <S.ItemCard $selected={selected}><input type="checkbox" checked={selected} onChange={onToggle} disabled={item.required} /><Icon /><strong>{item.name}</strong><small>{money(item.price)}{item.required ? " · obrigatório" : ""}</small></S.ItemCard>;
}

function GroupModal({data,group,busy,onClose,execute}:{data:EventWorkspaceData;group?:GroupRow;busy:boolean;onClose:()=>void;execute:(task:()=>Promise<ActionResult>)=>void}){
  const formId="event-caravan-form";const mainItemId=data.event.paymentSettings.caravanRegistrationItemId;
  const [total,setTotal]=useState(group?.total??1);const [male,setMale]=useState(group?.maleCount??0);const [female,setFemale]=useState(group?.femaleCount??1);const [file,setFile]=useState<File|null>(null);
  const [selected,setSelected]=useState(()=>new Set(group?.items.map((item)=>item.itemId)??data.items.filter((item)=>item.active&&(item.required||item.id===mainItemId)).map((item)=>item.id)));
  const [quantities,setQuantities]=useState<Record<string,number>>(()=>Object.fromEntries((group?.items??[]).map((item)=>[item.itemId,item.quantity])));
  const itemRows=data.items.filter((item)=>item.active&&selected.has(item.id)).map((item)=>({item,quantity:item.id===mainItemId?total:Math.max(1,quantities[item.id]??1)}));
  const totalAmount=itemRows.reduce((sum,row)=>sum+row.item.price*row.quantity,0);
  return <Modal open title={group?`Editar ${group.groupNumber}`:"Nova caravana"} description="A caravana é uma inscrição coletiva única; nenhum participante individual será criado." icon={<Users/>} onClose={onClose} busy={busy} size="lg" footer={<S.ModalFooter><Button variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit" form={formId} loading={busy} disabled={!mainItemId}>{group?"Salvar alterações":"Cadastrar caravana"}</Button></S.ModalFooter>}>
    <S.ModalForm id={formId} onSubmit={(submit)=>{submit.preventDefault();const form=new FormData(submit.currentTarget);execute(async()=>{
      const result=await createEventGroupAction({eventId:data.event.id,groupId:group?.id??"",expectedUpdatedAt:group?.updatedAt??"",originChurchName:form.get("originChurchName"),originFieldName:"",originCity:form.get("originCity"),originState:form.get("originState"),responsibleName:form.get("responsibleName"),responsiblePhone:form.get("responsiblePhone"),responsibleEmail:form.get("responsibleEmail"),pastorName:form.get("pastorName"),pastorPhone:form.get("pastorPhone"),totalRegistrations:total,maleCount:male,femaleCount:female,notes:form.get("notes"),items:itemRows.map((row)=>({itemId:row.item.id,quantity:row.quantity}))});
      if(result.status==="error"||!file)return result;const groupId=String(result.data.groupId);const prepared=await prepareCaravanParticipantListAction(data.event.id,groupId,{name:file.name,type:file.type,size:file.size});if(prepared.status==="error")return{status:"success",message:"Caravana salva. A lista não pôde ser anexada; abra a edição e tente novamente."};
      const upload=await createClient().storage.from("event-documents").uploadToSignedUrl(prepared.data.path,prepared.data.token,file,{contentType:file.type});if(upload.error)return{status:"success",message:"Caravana salva. A lista não pôde ser enviada; abra a edição e tente novamente."};
      const finalized=await finalizeEventDocumentAction(data.event.id,prepared.data.id);return finalized.status==="error"?{status:"success",message:"Caravana salva. O arquivo foi enviado, mas não pôde ser validado; tente novamente na edição."}:result;
    });}}>
      {!mainItemId?<S.Notice $danger>Edite o evento e selecione o item principal da caravana antes de cadastrar inscrições coletivas.</S.Notice>:null}<S.FieldGrid>
        <S.Field><span>Igreja/origem *</span><input data-autofocus name="originChurchName" required minLength={2} defaultValue={group?.originChurchName??""}/></S.Field><S.Field><span>Cidade *</span><input name="originCity" required minLength={2} defaultValue={group?.originCity??""}/></S.Field>
        <S.Field><span>UF *</span><input name="originState" required minLength={2} maxLength={2} defaultValue={group?.originState??""} onChange={(change)=>{change.currentTarget.value=change.currentTarget.value.toUpperCase();}}/></S.Field><S.Field><span>Responsável da caravana *</span><input name="responsibleName" required minLength={3} defaultValue={group?.responsibleName??""}/></S.Field>
        <S.Field><span>Telefone *</span><input name="responsiblePhone" required minLength={8} defaultValue={group?.responsiblePhone??""} inputMode="tel" onChange={(change)=>{change.currentTarget.value=formatBrazilPhone(change.currentTarget.value);}}/></S.Field><S.Field><span>E-mail</span><input name="responsibleEmail" type="email" defaultValue={group?.responsibleEmail??""}/></S.Field>
        <S.Field><span>Pastor(a) *</span><input name="pastorName" required minLength={2} defaultValue={group?.pastorName??""}/></S.Field><S.Field><span>Telefone do pastor(a)</span><input name="pastorPhone" defaultValue={group?.pastorPhone??""} inputMode="tel" onChange={(change)=>{change.currentTarget.value=formatBrazilPhone(change.currentTarget.value);}}/></S.Field>
        <S.Field><span>Quantidade total *</span><input type="number" min={1} required value={total} onChange={(change)=>setTotal(Number(change.target.value))}/></S.Field><S.Field><span>Masculino *</span><input type="number" min={0} required value={male} onChange={(change)=>setMale(Number(change.target.value))}/></S.Field><S.Field><span>Feminino *</span><input type="number" min={0} required value={female} onChange={(change)=>setFemale(Number(change.target.value))}/></S.Field><S.Field><span>Conferência</span><input readOnly value={total===male+female?"Totais conferem":`Faltam ${total-male-female} participantes`} aria-invalid={total!==male+female}/></S.Field>
        <S.Wide><div><strong style={{color:"#344054",fontSize:12}}>Itens e quantidades *</strong><S.ItemCards>{data.items.filter((item)=>item.active).map((item)=><S.ItemCard key={item.id} $selected={selected.has(item.id)}><input type="checkbox" checked={selected.has(item.id)} disabled={item.id===mainItemId||item.required} onChange={()=>setSelected((current)=>{const next=new Set(current);if(next.has(item.id))next.delete(item.id);else next.add(item.id);return next;})}/><Ticket/><strong>{item.name}</strong><small>{item.id===mainItemId?`${total} un. · item principal`:money(item.price)}</small>{selected.has(item.id)&&item.id!==mainItemId?<input aria-label={`Quantidade de ${item.name}`} type="number" min={1} value={quantities[item.id]??1} onChange={(change)=>setQuantities((current)=>({...current,[item.id]:Number(change.target.value)}))}/>:null}</S.ItemCard>)}</S.ItemCards></div></S.Wide>
        <S.Wide><S.PaymentHistory><strong>Resumo de itens · {money(totalAmount)}</strong><S.PaymentHistoryTable><table><thead><tr><th>Item</th><th>Quantidade</th><th>Unitário</th><th>Subtotal</th></tr></thead><tbody>{itemRows.map(({item,quantity})=><tr key={item.id}><td>{item.name}</td><td>{quantity}</td><td>{money(item.price)}</td><td>{money(item.price*quantity)}</td></tr>)}</tbody></table></S.PaymentHistoryTable></S.PaymentHistory></S.Wide>
        {data.event.paymentSettings.allowParticipantList?<S.Wide><S.DropField><input type="file" accept={EVENT_DOCUMENT_ACCEPT} onChange={(change)=>setFile(change.target.files?.[0]??null)}/><UploadCloud/><strong>{file?.name??group?.listFileName??"Lista de participantes (opcional)"}</strong><small>PDF, JPG, PNG, XLSX ou DOCX de até 10 MB</small></S.DropField></S.Wide>:null}
        <S.Wide><S.Field><span>Observações internas</span><textarea name="notes" maxLength={1000} defaultValue={group?.notes??""}/></S.Field></S.Wide>
      </S.FieldGrid>
    </S.ModalForm>
  </Modal>;
}

function CaravanPaymentModal({data,group,busy,onClose,execute}:{data:EventWorkspaceData;group:GroupRow;busy:boolean;onClose:()=>void;execute:(task:()=>Promise<ActionResult>)=>void}){
  const eventId=data.event.id;const settings=data.event.paymentSettings;const formId="event-caravan-payment-form";const [amount,setAmount]=useState(formatBrazilCurrencyInput(String(Math.round(group.remainingAmount*100))));const [file,setFile]=useState<File|null>(null);const [paymentMethod,setPaymentMethod]=useState("PIX");const [copied,setCopied]=useState(false);
  return <Modal open title={`Pagamento — ${group.groupNumber}`} description={`Total ${money(group.totalAmount)} · recebido ${money(group.paidAmount)} · saldo ${money(group.remainingAmount)}`} icon={<WalletCards/>} onClose={onClose} busy={busy} size="lg" footer={<S.ModalFooter><Button variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit" form={formId} loading={busy}>Registrar pagamento</Button></S.ModalFooter>}>
    <S.ModalForm id={formId} onSubmit={(submit)=>{submit.preventDefault();const form=new FormData(submit.currentTarget);execute(async()=>{let receipt={receiptPath:"",receiptFileName:"",receiptMimeType:"",receiptFileSize:0};if(file){const prepared=await preparePaymentReceiptAction(eventId,{name:file.name,type:file.type,size:file.size});if(prepared.status==="error")return prepared;const upload=await createClient().storage.from("event-documents").uploadToSignedUrl(prepared.data.path,prepared.data.token,file,{contentType:file.type});if(upload.error)return{status:"error",message:"Não foi possível enviar o comprovante."};receipt={receiptPath:prepared.data.path,receiptFileName:file.name,receiptMimeType:file.type,receiptFileSize:file.size};}return recordCaravanPaymentAction({eventId,groupId:group.id,amount:parseBrazilCurrencyInput(amount),paymentMethod:form.get("paymentMethod"),notes:form.get("notes"),...receipt});});}}>
      <S.FieldGrid><S.Field><span>Valor *</span><input required value={amount} onChange={(change)=>setAmount(formatBrazilCurrencyInput(change.target.value))} inputMode="numeric"/></S.Field><S.Field><span>Forma de pagamento *</span><select name="paymentMethod" required value={paymentMethod} onChange={(change)=>setPaymentMethod(change.target.value)}><option value="PIX">PIX</option><option value="CASH">Dinheiro</option><option value="BANK_TRANSFER">Transferência</option><option value="OTHER">Outro</option></select></S.Field>
      {paymentMethod==="PIX"&&settings.pixEnabled?<S.Wide><S.CaravanPixPanel><S.CaravanPixInfo><S.CaravanPixHeader><span><QrCodeIcon/></span><div><small>DADOS DE PAGAMENTO</small><strong>PIX do evento</strong></div></S.CaravanPixHeader><S.CaravanPixBody><p>Titular</p><b>{settings.pixHolderName||"Favorecido não informado"}</b><p>Chave PIX</p><S.PixKeyInput><input readOnly value={settings.pixKey} aria-label="Chave PIX do evento"/><button type="button" onClick={async()=>{await navigator.clipboard.writeText(settings.pixKey);setCopied(true);}} aria-label={copied?"Chave copiada":"Copiar chave PIX"} title={copied?"Chave copiada":"Copiar chave PIX"}>{copied?<Check/>:<Copy/>}</button></S.PixKeyInput><S.PixCopyFeedback role="status" aria-live="polite">{copied?"Chave copiada":""}</S.PixCopyFeedback></S.CaravanPixBody></S.CaravanPixInfo><S.CaravanPixQr>{settings.pixQrUrl?<Image unoptimized src={settings.pixQrUrl} width={160} height={160} alt="QR Code PIX do evento"/>:<><QrCodeIcon/><small>QR Code não cadastrado</small></>}</S.CaravanPixQr></S.CaravanPixPanel></S.Wide>:null}
      <S.Wide><S.DropField><input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={(change)=>setFile(change.target.files?.[0]??null)}/><ReceiptText/><strong>{file?.name??"Comprovante opcional"}</strong><small>O comprovante não é obrigatório · PDF ou imagem de até 10 MB</small></S.DropField></S.Wide><S.Wide><S.Field><span>Observação</span><textarea name="notes" maxLength={1000}/></S.Field></S.Wide></S.FieldGrid>
    </S.ModalForm>
  </Modal>;
}

function CaravanDetailsModal({data,group,busy,canApprove,onClose,execute}:{data:EventWorkspaceData;group:GroupRow;busy:boolean;canApprove:boolean;onClose:()=>void;execute:(task:()=>Promise<ActionResult>,close?:boolean)=>void}){
  const payments=data.payments.filter((payment)=>payment.groupId===group.id);const pendingPayments=payments.filter((payment)=>payment.status==="PENDING");const [review,setReview]=useState<{payment:PaymentRow;status:"CONFIRMED"|"FAILED"}|null>(null);const [reviewAmount,setReviewAmount]=useState("");const [reviewReason,setReviewReason]=useState("");
  const openReview=(payment:PaymentRow,status:"CONFIRMED"|"FAILED")=>{setReview({payment,status});setReviewAmount(formatBrazilCurrencyInput(String(Math.round(payment.amount*100))));setReviewReason("");};
  return <><Modal open title={`${group.groupNumber} · ${group.originChurchName}`} description={`${group.originCity}/${group.originState} · ${group.source==="PUBLIC"?"Inscrição pública":"Cadastro interno"}`} icon={<Bus/>} onClose={onClose} busy={busy} size="lg" footer={<S.ModalFooter><Button variant="outline" onClick={onClose}>Fechar</Button></S.ModalFooter>}>
    <S.OperationalList><div><dt>Responsável</dt><dd>{group.responsibleName}</dd></div><div><dt>Telefone</dt><dd>{group.responsiblePhone}</dd></div><div><dt>Pastor(a)</dt><dd>{group.pastorName}</dd></div><div><dt>Participantes</dt><dd>{group.total} · {group.maleCount} masc. · {group.femaleCount} fem.{group.unspecifiedCount?` · ${group.unspecifiedCount} não informados`:""}</dd></div><div><dt>Itens</dt><dd>{group.items.map((item)=>`${item.name} (${item.quantity} un.)`).join(", ")||"Nenhum"}</dd></div><div><dt>Total</dt><dd>{money(group.totalAmount)}</dd></div><div><dt>Recebido</dt><dd>{money(group.paidAmount)}</dd></div><div><dt>Saldo</dt><dd>{money(group.remainingAmount)}</dd></div><div><dt>Situação financeira</dt><dd>{eventLabel(PAYMENT_STATUSES,group.paymentStatus)}</dd></div><div><dt>Lista</dt><dd>{group.listFileName??"Não anexada"}{group.listDocumentId?<button type="button" className="app-button-secondary" onClick={()=>execute(async()=>{const result=await getEventDocumentUrlAction(data.event.id,group.listDocumentId!);if(result.status==="success")window.open(result.data.url,"_blank","noopener,noreferrer");return result;},false)}>Abrir</button>:null}</dd></div></S.OperationalList>
    <S.PaymentHistory><strong>Histórico de pagamentos</strong>{payments.length?<S.PaymentHistoryTable data-compact="true"><table><thead><tr><th>Data</th><th>Valor</th><th>Método</th><th>Situação</th><th>Comprovante</th><th><span className="sr-only">Ações</span></th></tr></thead><tbody>{payments.map((payment)=><tr key={payment.id}><td>{payment.paidAt?formatDate(payment.paidAt):"Aguardando"}</td><td>{money(payment.amount)}</td><td>{eventLabel(PAYMENT_METHODS,payment.method)}</td><td><S.StatusDot $tone={eventBadgeTone(payment.status)}>{eventLabel(PAYMENT_TRANSACTION_STATUSES,payment.status)}</S.StatusDot></td><td>{payment.receiptStoragePath?<S.ReceiptAction type="button" aria-label={`Abrir comprovante de ${payment.paymentNumber??"pagamento"}`} title="Abrir comprovante" onClick={()=>execute(async()=>{const result=await getPaymentReceiptUrlAction(data.event.id,payment.id);if(result.status==="success")window.open(result.data.url,"_blank","noopener,noreferrer");return result;},false)}><Eye/></S.ReceiptAction>:"—"}</td><td>{canApprove&&payment.status==="PENDING"?<S.TableActions><S.PaymentReviewAction type="button" aria-label="Aprovar pagamento" title="Aprovar pagamento" onClick={()=>openReview(payment,"CONFIRMED")}><Check/></S.PaymentReviewAction><S.PaymentReviewAction $danger type="button" aria-label="Rejeitar pagamento" title="Rejeitar pagamento" onClick={()=>openReview(payment,"FAILED")}><X/></S.PaymentReviewAction></S.TableActions>:null}</td></tr>)}</tbody></table></S.PaymentHistoryTable>:<p>Nenhum pagamento registrado.</p>}{pendingPayments.length?<S.Notice>{pendingPayments.length} comprovante(s) aguardando aprovação.</S.Notice>:null}</S.PaymentHistory>
  </Modal>{review?<Modal open size="sm" title={review.status==="CONFIRMED"?"Aprovar comprovante":"Rejeitar comprovante"} description={review.status==="CONFIRMED"?"Confira e, se necessário, corrija o valor antes de aprovar.":"Informe o motivo para manter a rastreabilidade."} icon={<BadgeDollarSign/>} onClose={()=>setReview(null)} busy={busy} footer={<S.ModalFooter><Button variant="outline" onClick={()=>setReview(null)}>Voltar</Button><Button variant={review.status==="CONFIRMED"?"primary":"danger"} loading={busy} disabled={review.status==="FAILED"&&reviewReason.trim().length<3} onClick={()=>execute(async()=>{const result=await approveCaravanPaymentAction(data.event.id,review.payment.id,review.status,reviewReason,review.status==="CONFIRMED"?parseBrazilCurrencyInput(reviewAmount):review.payment.amount);if(result.status==="success")setReview(null);return result;},false)}>{review.status==="CONFIRMED"?"Confirmar aprovação":"Confirmar rejeição"}</Button></S.ModalFooter>}><S.FieldGrid>{review.status==="CONFIRMED"?<S.Wide><S.Field><span>Valor aprovado *</span><input value={reviewAmount} onChange={(change)=>setReviewAmount(formatBrazilCurrencyInput(change.target.value))} inputMode="numeric"/></S.Field></S.Wide>:null}<S.Wide><S.Field><span>{review.status==="FAILED"?"Motivo *":"Observação"}</span><textarea value={reviewReason} onChange={(change)=>setReviewReason(change.target.value)} maxLength={1000}/></S.Field></S.Wide></S.FieldGrid></Modal>:null}</>;
}

function ItemModal({ data, busy, onClose, execute }: { data: EventWorkspaceData; busy: boolean; onClose: () => void; execute: (task: () => Promise<ActionResult>) => void }) {
  const formId = "event-item-form";
  const [price, setPrice] = useState(formatBrazilCurrencyInput("0"));
  return <Modal open title="Novo item" description="Cadastre o nome e o valor apresentado na inscrição." icon={<Ticket />} onClose={onClose} busy={busy} size="lg" footer={<S.ModalFooter><Button variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit" form={formId} loading={busy}>Salvar item</Button></S.ModalFooter>}><S.ModalForm id={formId} onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); execute(() => saveEventItemAction({ eventId: data.event.id, name: form.get("name"), description: "", itemType: form.get("itemType"), price: parseBrazilCurrencyInput(price), isRequired: form.has("isRequired"), isActive: true, allowQuantity: false, minQuantity: 1, maxQuantity: "", availableQuantity: "" })); }}><S.FieldGrid><S.Wide><S.Field><span>Nome do item *</span><input data-autofocus name="name" required minLength={2} /></S.Field></S.Wide><S.Field><span>Tipo</span><select name="itemType"><option value="REGISTRATION">Inscrição</option><option value="SHIRT">Camiseta</option><option value="FOOD">Alimentação</option><option value="LODGING">Hospedagem</option><option value="TRANSPORT">Transporte</option><option value="KIT">Kit</option><option value="OTHER">Outro</option></select></S.Field><S.Field><span>Valor</span><input value={price} onChange={(change) => setPrice(formatBrazilCurrencyInput(change.target.value))} inputMode="numeric" /></S.Field><S.Wide><S.Check><input name="isRequired" type="checkbox" />Selecionar automaticamente como item obrigatório</S.Check></S.Wide></S.FieldGrid></S.ModalForm></Modal>;
}

function QuotaModal({ data, busy, onClose, execute }: { data: EventWorkspaceData; busy: boolean; onClose: () => void; execute: (task: () => Promise<ActionResult>) => void }) {
  const formId = "event-goal-form";
  const usedIds = new Set(data.quotas.map((quota) => quota.targetId));
  return <Modal open title="Nova cota" description="Defina a meta de inscrições de uma congregação." icon={<CalendarCheck />} onClose={onClose} busy={busy} size="lg" footer={<S.ModalFooter><Button variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit" form={formId} loading={busy}>Salvar meta</Button></S.ModalFooter>}><S.ModalForm id={formId} onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); execute(() => saveEventQuotaAction({ eventId: data.event.id, congregationId: form.get("congregationId"), quotaTotal: form.get("quotaTotal") })); }}><S.FieldGrid><S.Wide><S.Field><span>Congregação *</span><select data-autofocus name="congregationId" required><option value="">Selecione</option>{data.references.congregations.filter((item) => !usedIds.has(item.id)).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></S.Field></S.Wide><S.Wide><S.Field><span>Quantidade de cotas *</span><input name="quotaTotal" type="number" min="1" required /></S.Field></S.Wide></S.FieldGrid></S.ModalForm></Modal>;
}

function DocumentModal({ data, busy, onClose, execute }: { data: EventWorkspaceData; busy: boolean; onClose: () => void; execute: (task: () => Promise<ActionResult>) => void }) {
  const formId = "event-document-form";
  const [file, setFile] = useState<File | null>(null);
  return <Modal open title="Enviar documento" description="PDF, imagem, Word ou Excel com até 10 MB." icon={<FileUp />} onClose={onClose} busy={busy} size="lg" footer={<S.ModalFooter><Button variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit" form={formId} loading={busy}>Enviar arquivo</Button></S.ModalFooter>}><S.ModalForm id={formId} onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); if (!file) return; execute(async () => { const prepared = await prepareEventDocumentAction({ eventId: data.event.id, title: String(form.get("title")), fileName: file.name, mimeType: file.type, fileSize: file.size }); if (prepared.status === "error") return prepared; const upload = await createClient().storage.from("event-documents").uploadToSignedUrl(prepared.data.path, prepared.data.token, file, { contentType: file.type }); if (upload.error) return { status: "error", message: "Falha ao enviar o arquivo." }; return finalizeEventDocumentAction(data.event.id, prepared.data.id); }); }}><S.Field><span>Nome do documento *</span><input data-autofocus name="title" required /></S.Field><S.DropField><input type="file" required accept={EVENT_DOCUMENT_ACCEPT} onChange={(event) => setFile(event.target.files?.[0] ?? null)} /><UploadCloud /><strong>{file ? file.name : "Selecionar arquivo"}</strong><small>{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : "Clique para escolher o documento"}</small></S.DropField></S.ModalForm></Modal>;
}

function PaymentModal({ eventId, registration, busy, onClose, execute }: { eventId: string; registration: RegistrationRow; busy: boolean; onClose: () => void; execute: (task: () => Promise<ActionResult>) => void }) {
  const formId = "event-payment-form";
  const [file, setFile] = useState<File | null>(null);
  const [amount, setAmount] = useState(formatBrazilCurrencyInput(String(Math.round(registration.remainingAmount * 100))));
  return <Modal open title={`Pagamento — ${registration.participantName}`} description={`${registration.registrationNumber ?? "Inscrição"} · ${eventLabel(PAYMENT_METHODS, registration.preferredPaymentMethod ?? "PIX")}`} icon={<WalletCards />} onClose={onClose} busy={busy} size="lg" footer={<S.ModalFooter><Button variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit" form={formId} loading={busy}>Confirmar pagamento</Button></S.ModalFooter>}><S.ModalForm id={formId} onSubmit={(event) => { event.preventDefault(); execute(async () => { let receipt = { receiptPath: "", receiptFileName: "", receiptMimeType: "", receiptFileSize: 0 }; if (file) { const prepared = await preparePaymentReceiptAction(eventId, { name: file.name, type: file.type, size: file.size }); if (prepared.status === "error") return prepared; const upload = await createClient().storage.from("event-documents").uploadToSignedUrl(prepared.data.path, prepared.data.token, file, { contentType: file.type }); if (upload.error) return { status: "error", message: "Não foi possível enviar o comprovante." }; receipt = { receiptPath: prepared.data.path, receiptFileName: file.name, receiptMimeType: file.type, receiptFileSize: file.size }; } return recordPaymentAction({ eventId, registrationId: registration.id, amount: parseBrazilCurrencyInput(amount), ...receipt }); }); }}><S.FieldGrid><S.Field><span>Valor *</span><input data-autofocus required value={amount} onChange={(change) => setAmount(formatBrazilCurrencyInput(change.target.value))} inputMode="numeric" /></S.Field><S.Field><span>Data do pagamento</span><input value={new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date())} readOnly /></S.Field><S.Wide><S.DropField><input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /><ReceiptText /><strong>{file ? file.name : "Comprovante do pagamento"}</strong><small>{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : "PDF ou imagem de até 10 MB"}</small></S.DropField></S.Wide></S.FieldGrid></S.ModalForm></Modal>;
}

function RegistrationDetailsModal({ data, registration, busy, canDeletePayment, onClose, onOpenReceipt, onDeletePayment }: { data: EventWorkspaceData; registration: RegistrationRow; busy: boolean; canDeletePayment: boolean; onClose: () => void; onOpenReceipt: (paymentId: string) => void; onDeletePayment: (paymentId: string, label: string) => void }) {
  const payments = data.payments.filter((payment) => payment.registrationId === registration.id);
  const customAnswers = Object.entries(registration.customFieldValues).map(([key, value]) => {
    const field = data.registrationFields.find((candidate) => candidate.key === key);
    return {
      key,
      label: field?.label ?? key.replaceAll("_", " "),
      value: formatRegistrationFieldValue(value, field?.type),
    };
  });
  const itemSummary = data.items.filter((item) => registration.itemQuantities[item.id]).map((item) => `${item.name} (${registration.itemQuantities[item.id]} un.)`).join(", ");
  return (
    <Modal open title={registration.participantName} description={`${registration.registrationNumber ?? "Inscrição"} · ${registration.memberId ? "Membro" : "Visitante"}`} icon={<UserRound />} onClose={onClose} busy={busy} size="lg" footer={<S.ModalFooter><Button variant="outline" onClick={onClose}>Fechar</Button></S.ModalFooter>}>
      <S.OperationalList>
        <div><dt>Telefone</dt><dd>{registration.participantPhone || "—"}</dd></div>
        <div><dt>Sexo</dt><dd>{registration.participantGender === "MALE" ? "Masculino" : registration.participantGender === "FEMALE" ? "Feminino" : "—"}</dd></div>
        <div><dt>Regional</dt><dd>{registration.regionName || "Sem vínculo"}</dd></div>
        <div><dt>Congregação</dt><dd>{registration.congregationName || "Sem vínculo"}</dd></div>
        <div><dt>Cargo</dt><dd>{registration.participantRoleName || "Não informado"}</dd></div>
        <div><dt>E-mail</dt><dd>{registration.participantEmail || "—"}</dd></div>
        <div><dt>Documento</dt><dd>{registration.participantDocument || "—"}</dd></div>
        <div><dt>Nascimento</dt><dd>{registration.participantBirthDate ? new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(`${registration.participantBirthDate}T12:00:00Z`)) : "—"}</dd></div>
        <div><dt>Cidade / UF</dt><dd>{[registration.participantCity, registration.participantState].filter(Boolean).join(" / ") || "—"}</dd></div>
        <div><dt>Responsável</dt><dd>{registration.responsibleName || "—"}</dd></div>
        <div><dt>Telefone do responsável</dt><dd>{registration.responsiblePhone || "—"}</dd></div>
        <div><dt>Itens</dt><dd>{itemSummary || "Nenhum item"}</dd></div>
        <div><dt>Total</dt><dd>{money(registration.totalAmount)}</dd></div>
        <div><dt>Valor restante</dt><dd>{money(registration.remainingAmount)}</dd></div>
        {customAnswers.map((answer) => <div key={answer.key}><dt>{answer.label}</dt><dd>{answer.value}</dd></div>)}
      </S.OperationalList>
      <S.PaymentHistory>
        <strong>Histórico de pagamentos</strong>
        {payments.length ? <S.PaymentHistoryTable><table><thead><tr><th>Data</th><th>Valor</th><th>Método</th><th>Comprovante</th><th>Ações</th></tr></thead><tbody>{payments.map((payment) => <tr key={payment.id}><td>{payment.paidAt ? formatDate(payment.paidAt) : "—"}</td><td>{money(payment.amount)}</td><td>{eventLabel(PAYMENT_METHODS, payment.method)}</td><td>{payment.receiptStoragePath ? <S.ReceiptAction type="button" aria-label={`Abrir comprovante de ${payment.paymentNumber ?? "pagamento"}`} title="Abrir comprovante" onClick={() => onOpenReceipt(payment.id)}><Eye /></S.ReceiptAction> : <span>—</span>}</td><td>{canDeletePayment ? <S.ActionButton $danger type="button" aria-label={`Excluir pagamento ${payment.paymentNumber ?? payment.id}`} onClick={() => onDeletePayment(payment.id, `${payment.paymentNumber ?? "Pagamento"} · ${money(payment.amount)}`)}><Trash2 /></S.ActionButton> : null}</td></tr>)}</tbody></table></S.PaymentHistoryTable> : <p>Nenhum pagamento registrado.</p>}
      </S.PaymentHistory>
    </Modal>
  );
}
