"use client";
import { FinanceDateField } from "./finance-date-field";
import { useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { listFinanceDeliveriesAction } from "../actions/finance-delivery.actions";
import type {
  DeliveryProjection,
  DeliveryRow,
  DeliveryOptions,
} from "../types/finance-administrative.types";
import { deliverySourceLabel, deliveryTimeliness } from "../utils/finance-administrative";
import { isMonth } from "../utils/finance-period";
import { financeLocation } from "../utils/finance-navigation";
import { useFinanceReportPdf } from "../hooks/use-finance-report-pdf";
import { useFinanceDesktop } from "../hooks/use-finance-desktop";
import { FinanceSkeleton } from "./finance-skeleton";
import { FinanceEmpty } from "./finance-empty";
import { FinanceListResults } from "./finance-list-results";
import { Eye, FileText, History, Monitor, Pencil, Plus } from "lucide-react";
import { FinanceDeliveryForm } from "./finance-delivery-form";
const date = (v: string) => v.split("-").reverse().join("/");
function transferLink(transfer: NonNullable<DeliveryRow["transfer"]>) {
  return <Link className="finance-secondary-link" href={financeLocation("/financeiro/lancamentos",
    transfer.unit, transfer.date.slice(0, 7), { detalhe: transfer.id })} aria-label="Ver lançamento" title="Ver lançamento"><Eye size={16} aria-hidden="true" /> Ver</Link>;
}
function deliveryActionLabel(row: DeliveryRow) {
  if (row.source === "MANUAL") return "Corrigir";
  return row.transfer ? "Registrar data manual" : "Registrar entrega";
}
const labels = {
  ALL: "Todas",
  DELIVERED: "Entregues",
  PENDING: "Não entregues",
};
type FinanceDeliveriesProps = {
  initial: DeliveryProjection;
};
export function FinanceDeliveries(props: FinanceDeliveriesProps) {
  const desktop = useFinanceDesktop();
  if (!desktop)
    return (
      <section className="card stack finance-delivery-desktop-notice">
        <Monitor size={30} aria-hidden="true" />
        <h1>Entrega de relatórios</h1>
        <p className="muted">
          Acesse pelo computador para acompanhar as entregas.
        </p>
      </section>
    );
  return <FinanceDeliveriesContent {...props} />;
}
function FinanceDeliveriesContent({
  initial,
}: FinanceDeliveriesProps) {
  const [data, setData] = useState(initial),
    [month, setMonth] = useState(initial.month),
    [filter, setFilter] = useState<DeliveryOptions["filter"]>("ALL"),
    [search, setSearch] = useState(""),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [editing, setEditing] = useState<DeliveryRow | null>(null),
    [history, setHistory] = useState<DeliveryRow | null>(null);
  const request = useRef(0);
  const pdf = useFinanceReportPdf(
    { type: "DELIVERIES", month, includeInactive: false, filter, search },
    `entrega-relatorios-${month}-${filter.toLowerCase()}.pdf`,
  );
  async function load(m = month) {
    pdf.invalidate();
    const id = ++request.current;
    if (!isMonth(m)) {
      setLoading(false);
      setError("Selecione um mês válido.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const r = await listFinanceDeliveriesAction({
        month: m,
        includeInactive: false,
      });
      if (id !== request.current) return;
      if (!r.ok) {
        setError(r.message);
        return;
      }
      setData(r.data);
    } catch {
      if (id === request.current)
        setError("Não foi possível carregar as entregas. Tente novamente.");
    } finally {
      if (id === request.current) setLoading(false);
    }
  }
  const ready =
    !loading &&
    !pdf.isPending &&
    !error &&
    data.month === month &&
    !data.includeInactive;
  const matching = data.rows.filter((r) =>
    r.name
      .toLocaleLowerCase("pt-BR")
      .includes(search.trim().toLocaleLowerCase("pt-BR")),
  );
  const delivered = matching.filter((r) => r.deliveryDate).length;
  const counts = {
    ALL: matching.length,
    DELIVERED: delivered,
    PENDING: matching.length - delivered,
  };
  const rows = matching.filter(
    (r) =>
      filter === "ALL" ||
      (filter === "DELIVERED" ? !!r.deliveryDate : !r.deliveryDate),
  );
  return (
    <div className="stack finance-deliveries finance-desktop-only">
      <header className="row spread">
        <div>
          <h1>Entrega de relatórios</h1>
          <p className="muted">
            Congregações ativas autorizadas, exceto a catedral.
          </p>
        </div>
      </header>
      <section className="card stack">
        <div className="finance-informative-period">
          <FinanceDateField label="Mês de referência"
            withCalendar monthOnly required={false}
            min="2000-01"
            max="2099-12"
            value={month}
            onChange={iso => {
              setMonth(iso);
              void load(iso);
            }}
          />
          <label>
            Buscar congregação
            <input
              type="search"
              maxLength={100}
              value={search}
              onChange={(e) => {
                pdf.invalidate();
                setSearch(e.target.value);
              }}
              placeholder="Nome da congregação"
            />
          </label>
        </div>
        <div
          className="tabs finance-delivery-tabs"
          aria-label="Situação da entrega"
        >
          {(Object.keys(labels) as DeliveryOptions["filter"][]).map((f) => (
            <button
              key={f}
              aria-pressed={filter === f}
              onClick={() => {
                pdf.invalidate();
                setFilter(f);
              }}
            >
              {labels[f]}
              {ready ? ` (${counts[f]})` : ""}
            </button>
          ))}
        </div>
      </section>
      {error && (
        <div role="alert" className="notice">
          {error}{" "}
          <Button variant="outline" onClick={() => void load()}>
            Tentar novamente
          </Button>
        </div>
      )}
      <section className="card stack">
        <div className="row spread">
          <h2>{labels[filter]}</h2>
          <Button
            disabled={!ready || pdf.busy}
            onClick={() => void pdf.generate()}
            loading={pdf.busy}
          >
            <FileText size={16} aria-hidden="true" /> Gerar PDF
          </Button>
        </div>
        <FinanceListResults busy={loading || pdf.isPending}>
          {loading || pdf.isPending ? <FinanceSkeleton table label="Carregando entregas" /> : !ready ? null : rows.length ? (
            <div className="table-scroll">
              <table className="finance-delivery-table">
                <thead>
                  <tr>
                    <th>Congregação</th>
                    <th>Situação</th>
                    <th>Origem</th>
                    <th>Data da entrega</th>
                    <th>Prazo</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td data-label="Congregação">
                        {row.name}
                        {row.status !== "ACTIVE" && (
                          <small className="muted"> · Inativa</small>
                        )}
                      </td>
                      <td data-label="Situação">
                        <span
                          className={`badge finance-delivery-badge ${row.deliveryDate ? "is-delivered" : "is-pending"}`}
                        >
                          {row.deliveryDate ? "Entregue" : "Não entregue"}
                        </span>
                      </td>
                      <td data-label="Origem">
                        <span className="finance-delivery-origin">{deliverySourceLabel(row.source)}
                        {row.source === "TRANSFER" && row.transfer && transferLink(row.transfer)}</span>
                      </td>
                      <td data-label="Data da entrega">
                        {row.deliveryDate ? date(row.deliveryDate) : "—"}
                      </td>
                      <td data-label="Prazo">
                        <span
                          className={`badge finance-delivery-badge ${deliveryTimeliness(row.deliveryDate, data.dueDate, data.today).includes("atraso") ? "is-late" : row.deliveryDate ? "is-delivered" : "is-pending"}`}
                        >
                          {deliveryTimeliness(
                            row.deliveryDate,
                            data.dueDate,
                            data.today,
                          )}
                        </span>
                      </td>
                      <td data-label="Ações">
                        <div className="row finance-delivery-actions">
                          <Button variant="outline" size="sm" className="finance-icon-button"
                            title={deliveryActionLabel(row)} aria-label={deliveryActionLabel(row)}
                            onClick={() => setEditing(row)}>
                            {row.source === "MANUAL" ? <Pencil size={16} /> : <Plus size={16} />}
                          </Button>
                          {(row.history.length > 0 || row.transferHistory.length > 0) && (
                            <Button
                              variant="outline"
                              className="finance-icon-button" size="sm" title="Histórico" aria-label="Histórico"
                              onClick={() => setHistory(row)}
                            >
                              <History size={16} aria-hidden="true" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <FinanceEmpty>
              <h3>
                {search.trim()
                  ? "Nenhuma congregação encontrada."
                  : filter === "DELIVERED"
                    ? "Nenhum relatório entregue neste período."
                    : filter === "PENDING"
                      ? "Nenhuma entrega pendente."
                      : "Nenhuma congregação ativa para listar."}
              </h3>
              <p className="muted">
                {search.trim()
                  ? "Tente outro nome ou limpe a busca."
                  : filter === "DELIVERED"
                    ? "As entregas registradas aparecerão aqui."
                    : filter === "PENDING"
                      ? "Consulte a aba Todas para acompanhar os registros do período."
                      : "Confira o mês selecionado e as congregações disponíveis no seu acesso."}
              </p>
            </FinanceEmpty>
          )}
        </FinanceListResults>
        <p className="muted">{ready ? `${rows.length} congregações na listagem.` : "\u00a0"}</p>
      </section>
      {pdf.error && (
        <p role="alert" className="notice">
          {pdf.error}
        </p>
      )}
      {pdf.pdf && (
        <section className="card row finance-delivery-actions">
          <span role="status">PDF pronto.</span>
          <a
            className="finance-report-link"
            target="_blank"
            rel="noopener noreferrer"
            href={pdf.pdf.url}
          >
            Abrir PDF
          </a>
          <a
            className="finance-report-link"
            href={pdf.pdf.url}
            download={pdf.pdf.name}
          >
            Baixar PDF
          </a>
        </section>
      )}
      {editing && (
        <FinanceDeliveryForm
          row={editing}
          month={month}
          today={data.today}
          onClose={(writeAttempted) => {
            setEditing(null);
            if (writeAttempted) void load();
          }}
          onSaved={async () => {
            setEditing(null);
            await load();
          }}
        />
      )}
      {history && (
        <Modal
          title="Histórico de entrega"
          onClose={() => setHistory(null)}
          className="finance-drawer finance-secondary-drawer"
        >
          <div className="stack">
            <h3>{history.name}</h3>
            {history.transferHistory.length > 0 && <h4>Repasses da Catedral</h4>}
            {history.transferHistory.map(event => (
              <div className="card stack" key={event.eventId}>
                <strong>{event.included ? "Repasse considerado" : "Repasse deixou de contar"}</strong>
                <span>Data do lançamento: {date(event.date)}</span>
                {transferLink(event)}
                <small className="muted">{event.actor} · {new Date(event.createdAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</small>
              </div>
            ))}
            {history.history.length > 0 && <h4>Registros manuais</h4>}
            {history.history.map((event) => (
              <div className="card stack" key={event.revision}>
                <strong>
                  {
                    {
                      RECEIVE: "Entrega registrada",
                      CORRECT: "Data corrigida",
                      UNDO: "Entrega desfeita",
                    }[event.action]
                  }
                </strong>
                <p>
                  {event.deliveryDate
                    ? `Entrega em ${date(event.deliveryDate)} · `
                    : ""}
                  Prazo: {date(event.dueDate)}
                </p>
                {event.reason && <p>{event.reason}</p>}
                <small className="muted">
                  {event.actor} ·{" "}
                  {new Date(event.createdAt).toLocaleString("pt-BR", {
                    timeZone: "America/Sao_Paulo",
                  })}
                </small>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
