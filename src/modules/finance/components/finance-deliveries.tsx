"use client";
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
import { deliveryTimeliness } from "../utils/finance-administrative";
import { isMonth } from "../utils/finance-period";
import { financeLocation } from "../utils/finance-navigation";
import { useFinanceReportPdf } from "../hooks/use-finance-report-pdf";
import { FinanceDeliveryForm } from "./finance-delivery-form";
const date = (v: string) => v.split("-").reverse().join("/");
const labels = {
  ALL: "Todas",
  DELIVERED: "Entregues",
  PENDING: "Não entregues",
};
export function FinanceDeliveries({
  initial,
  unit,
  canConfigure,
}: {
  initial: DeliveryProjection;
  unit: string;
  canConfigure: boolean;
}) {
  const [data, setData] = useState(initial),
    [month, setMonth] = useState(initial.month),
    [inactive, setInactive] = useState(initial.includeInactive),
    [filter, setFilter] = useState<DeliveryOptions["filter"]>("ALL"),
    [search, setSearch] = useState(""),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [editing, setEditing] = useState<DeliveryRow | null>(null),
    [history, setHistory] = useState<DeliveryRow | null>(null);
  const request = useRef(0);
  const pdf = useFinanceReportPdf(
    { type: "DELIVERIES", month, includeInactive: inactive, filter, search },
    `entrega-relatorios-${month}-${filter.toLowerCase()}.pdf`,
  );
  async function load(m = month, inc = inactive) {
    pdf.invalidate();
    const id = ++request.current;
    if (!isMonth(m)) {
      setError("Selecione um mês válido.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const r = await listFinanceDeliveriesAction({
        month: m,
        includeInactive: inc,
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
    data.includeInactive === inactive;
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
    <div className="stack finance-deliveries">
      <header className="row spread">
        <div>
          <h1>Entrega de relatórios</h1>
          <p className="muted">
            Todas as congregações autorizadas, exceto a catedral.
          </p>
        </div>
        <Link
          className="finance-report-link"
          href={financeLocation("/financeiro/relatorios", unit, month)}
        >
          Voltar aos relatórios
        </Link>
      </header>
      <section className="card stack">
        <div className="finance-informative-period">
          <label>
            Mês de referência
            <input
              type="month"
              min="2000-01"
              max="2099-12"
              value={month}
              onChange={(e) => {
                setMonth(e.target.value);
                void load(e.target.value);
              }}
            />
          </label>
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
        <label className="row">
          <input
            type="checkbox"
            checked={inactive}
            onChange={(e) => {
              setInactive(e.target.checked);
              void load(month, e.target.checked);
            }}
          />
          Incluir congregações inativas
        </label>
        <div className="row spread">
          <p className="muted">
            {ready
              ? `Entrega até ${date(data.dueDate)}`
              : "Consultando período…"}
          </p>
          {canConfigure && (
            <Link
              className="finance-report-link"
              href={
                financeLocation("/financeiro/configuracoes", unit, month) +
                "&area=entregas"
              }
            >
              Configurar prazo
            </Link>
          )}
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
      {loading && <p role="status">Carregando entregas…</p>}
      {ready && (
        <section className="card stack">
          <div className="row spread">
            <h2>{labels[filter]}</h2>
            <Button
              disabled={pdf.busy}
              onClick={() => void pdf.generate()}
              loading={pdf.busy}
            >
              Gerar PDF
            </Button>
          </div>
          {rows.length ? (
            <div className="table-scroll">
              <table className="finance-mobile-card-table">
                <thead>
                  <tr>
                    <th>Congregação</th>
                    <th>Situação</th>
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
                        {row.deliveryDate ? "Entregue" : "Não entregue"}
                      </td>
                      <td data-label="Data da entrega">
                        {row.deliveryDate ? date(row.deliveryDate) : "—"}
                      </td>
                      <td
                        data-label="Prazo"
                        className={
                          deliveryTimeliness(
                            row.deliveryDate,
                            data.dueDate,
                            data.today,
                          ).includes("atraso")
                            ? "finance-delivery-late"
                            : ""
                        }
                      >
                        {deliveryTimeliness(
                          row.deliveryDate,
                          data.dueDate,
                          data.today,
                        )}
                      </td>
                      <td data-label="Ações">
                        <div className="row finance-delivery-actions">
                          <Button
                            variant="outline"
                            onClick={() => setEditing(row)}
                          >
                            {row.deliveryDate
                              ? "Corrigir"
                              : "Registrar entrega"}
                          </Button>
                          {row.history.length > 0 && (
                            <Button
                              variant="outline"
                              onClick={() => setHistory(row)}
                            >
                              Histórico
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
            <p className="muted">
              Nenhuma congregação encontrada para os filtros selecionados.
            </p>
          )}
          <p className="muted">{rows.length} congregações na listagem.</p>
        </section>
      )}
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
          onClose={() => {
            setEditing(null);
            void load();
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
