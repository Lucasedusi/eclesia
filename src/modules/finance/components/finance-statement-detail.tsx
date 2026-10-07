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
      <header>
        <div className="row spread">
          <div>
            <p className="eyebrow">
              Demonstrativo mensal · versão {s.revision}
            </p>
            <h1>{s.congregationName}</h1>
            <p className="muted">
              Referência {s.month.split("-").reverse().join("/")} · Gerado em{" "}
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
          <p className="notice">
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
      <p className="notice">
        Este demonstrativo não registra pagamentos. Ele orienta os valores a
        lançar como despesas e a entregar à Catedral.
      </p>
      <div className="grid">
        <section className="card">
          <p className="muted">Entradas totais</p>
          <div className="amount">{formatMoney(s.totalIncomeCents)}</div>
        </section>
        <section className="card">
          <p className="muted">Base de cálculo</p>
          <div className="amount">{formatMoney(s.eligibleIncomeCents)}</div>
        </section>
        <section className="card">
          <p className="muted">Entradas fora da base</p>
          <div className="amount">{formatMoney(s.excludedIncomeCents)}</div>
        </section>
      </div>
      <section className="card stack">
        <h2>Entradas por departamento</h2>
        <div className="table-scroll">
          <table>
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
                  <td>{d.name}</td>
                  <td>
                    {d.participatesInBase ? "Incluído na base" : "Fora da base"}
                  </td>
                  <td className="money">{formatMoney(d.incomeCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="card stack">
        <h2>Memória de cálculo</h2>
        <div className="table-scroll">
          <table>
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
                  <td>
                    {i.name}
                    {i.role === "PREBEND_DEDUCTION" && (
                      <div className="muted">Descontado da prebenda bruta</div>
                    )}
                  </td>
                  <td>
                    {i.calculation === "FIXED" ? "—" : formatMoney(i.baseCents)}
                  </td>
                  <td>
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
                  <td>
                    {i.destination === "LOCAL_PASTOR"
                      ? "Pastor · valor bruto"
                      : "Catedral"}
                  </td>
                  <td className="money">{formatMoney(i.calculatedCents)}</td>
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
      <section className="card stack">
        <div className="row spread">
          <span>Total distribuído</span>
          <strong>{formatMoney(s.distributionTotalCents)}</strong>
        </div>
        <div className="row spread">
          <span>Restante da distribuição</span>
          <strong className={s.remainderCents < 0 ? "negative" : ""}>
            {formatMoney(s.remainderCents)}
          </strong>
        </div>
        <p className="muted">
          Base de cálculo menos a distribuição. Este valor não representa o
          saldo dos caixas. Despesas já lançadas no período:{" "}
          {formatMoney(s.expenseCents)}.
        </p>
      </section>
    </article>
  );
}
