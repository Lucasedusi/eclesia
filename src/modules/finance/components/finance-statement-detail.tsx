import { ArrowDownLeft, Calculator, Layers3 } from "lucide-react";
import type { StatementVersionDTO } from "../types/finance-statement.types";
import { formatMoney } from "../utils/finance-money";
export function FinanceStatementDetail({
  statement: s,
  superseded = false,
}: {
  statement: StatementVersionDTO;
  superseded?: boolean;
}) {
  return (
    <article className="stack">
      <header className="card finance-statement-meta">
        <div className="row spread">
          <div>
            <h2>{s.congregationName}</h2>
            <p className="finance-statement-period">
              Competência {s.month.split("-").reverse().join("/")} · Versão{" "}
              {s.revision}
            </p>
            <p className="muted">
              Gerado em{" "}
              {new Date(s.createdAt).toLocaleString("pt-BR", {
                timeZone: "America/Sao_Paulo",
              })}
              {s.createdByName ? ` por ${s.createdByName}` : ""}
            </p>
          </div>
          <span className="badge">
            {superseded
              ? "Substituído"
              : s.stale
                ? "Desatualizado"
                : "Versão atual"}
          </span>
        </div>
        {s.stale && (
          <p className="notice finance-statement-stale">
            Há lançamentos ou configurações posteriores a esta versão. Gere
            outra versão para refletir as alterações.
          </p>
        )}
        {superseded && (
          <p className="notice">
            Uma versão mais recente está disponível. Os valores abaixo preservam
            o demonstrativo original.
          </p>
        )}
      </header>
      <p className="muted finance-statement-note">
        Este demonstrativo não registra pagamentos. Ele orienta os valores a
        lançar como despesas e a entregar à Catedral.
      </p>
      <div className="grid">
        <section className="card finance-summary-card finance-income-card">
          <div className="row">
            <span className="finance-summary-icon">
              <ArrowDownLeft size={21} aria-hidden="true" />
            </span>
            <p className="muted">Entradas totais</p>
          </div>
          <div className="amount">{formatMoney(s.totalIncomeCents)}</div>
        </section>
        <section className="card finance-summary-card finance-base-card">
          <div className="row">
            <span className="finance-summary-icon">
              <Calculator size={21} aria-hidden="true" />
            </span>
            <p className="muted">Base de cálculo</p>
          </div>
          <div className="amount">{formatMoney(s.eligibleIncomeCents)}</div>
        </section>
        <section className="card finance-summary-card finance-excluded-card">
          <div className="row">
            <span className="finance-summary-icon">
              <Layers3 size={21} aria-hidden="true" />
            </span>
            <p className="muted">Entradas fora da base</p>
          </div>
          <div className="amount">{formatMoney(s.excludedIncomeCents)}</div>
        </section>
      </div>
      <section className="card stack">
        <h2>Entradas por departamento</h2>
        <div className="table-scroll">
          <table className="finance-mobile-card-table">
            <thead>
              <tr>
                <th>Departamento</th>
                <th>Participação</th>
                <th style={{ textAlign: "right" }}>Entradas</th>
              </tr>
            </thead>
            <tbody>
              {s.departments.map((d) => (
                <tr key={d.id}>
                  <td data-label="Departamento">{d.name}</td>
                  <td data-label="Participação">
                    {d.participatesInBase ? "Incluído na base" : "Fora da base"}
                  </td>
                  <td className="money" data-label="Entradas">{formatMoney(d.incomeCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="card stack">
        <h2>Memória de cálculo</h2>
        <div className="table-scroll">
          <table className="finance-mobile-card-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Base utilizada</th>
                <th>Cálculo</th>
                <th>Destino</th>
                <th style={{ textAlign: "right" }}>Valor</th>
              </tr>
            </thead>
            <tbody>
              {s.items.map((i, index) => (
                <tr key={index}>
                  <td data-label="Item">
                    {i.name}
                    {i.role === "PREBEND_DEDUCTION" && (
                      <div className="muted">Descontado da prebenda bruta</div>
                    )}
                  </td>
                  <td data-label="Base utilizada">
                    {i.calculation === "FIXED" ? "—" : formatMoney(i.baseCents)}
                  </td>
                  <td data-label="Cálculo">
                    {i.calculation === "FIXED"
                      ? "Valor fixo"
                      : `${i.percentage}%`}
                    {i.capCents !== undefined && (
                      <div className="muted">
                        Teto: {formatMoney(i.capCents)}
                      </div>
                    )}
                    {i.capApplied && (
                      <>
                        <span className="badge">Teto aplicado</span>
                        <div className="muted">
                          Antes do teto:{" "}
                          {formatMoney(i.uncappedCents ?? i.calculatedCents)}
                        </div>
                      </>
                    )}
                  </td>
                  <td data-label="Destino">
                    {i.destination === "LOCAL_PASTOR"
                      ? "Pastor · valor bruto"
                      : "Catedral"}
                  </td>
                  <td className="money" data-label="Valor">{formatMoney(i.calculatedCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <div className="grid">
        <section
          className="card stack"
          style={{ background: "#0B3D32", color: "white" }}
        >
          <h2>Total a entregar à Catedral</h2>
          <div className="amount" data-testid="statement-cathedral-total">
            {formatMoney(s.cathedralTotalCents)}
          </div>
          <span style={{ fontSize: 12 }}>
            Repasse, descontos da prebenda e demais itens destinados à Catedral.
          </span>
        </section>
        <section className="card stack">
          <h2>Prebenda líquida do pastor</h2>
          <div className="amount" data-testid="statement-pastor-net">
            {formatMoney(s.netPastorCents)}
          </div>
          <span className="muted">
            Bruta {formatMoney(s.grossPrebendCents)} − descontos{" "}
            {formatMoney(s.prebendDeductionCents)}
          </span>
        </section>
      </div>
    </article>
  );
}
