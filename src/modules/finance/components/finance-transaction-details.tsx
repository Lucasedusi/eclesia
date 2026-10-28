"use client";
import Link from "next/link";
import { useState } from "react";
import { FileDown, Printer } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import type { FinanceCatalogs } from "../types/finance-catalog.types";
import type { FinanceTransactionDetail } from "../types/finance-query.types";
import { formatMoney } from "../utils/finance-money";
import { financeLocation } from "../utils/finance-navigation";
import { getFinanceDocumentUrlAction } from "../actions/finance-document.actions";
export function FinanceTransactionDetails({
  transaction: t,
  catalogs,
  unit,
  month,
  onClose,
  actions,
}: {
  transaction: FinanceTransactionDetail;
  catalogs: FinanceCatalogs;
  unit: string;
  month: string;
  onClose: () => void;
  actions?: React.ReactNode;
}) {
  const [error, setError] = useState("");
  const [openingDocument, setOpeningDocument] = useState<string | null>(null);
  return (
    <Modal
      title="Detalhes do lançamento"
      className="finance-drawer finance-transaction-details"
      onClose={onClose}
      footer={actions}
    >
      <div className="stack">
        {error && <div role="alert">{error}</div>}
        <div className="row">
          <span
            className={`badge ${t.direction === "EXPENSE" ? "finance-expense-badge" : ""}`}
          >
            {t.direction === "INCOME" ? "Entrada" : "Saída"}
          </span>
          <span className="badge">
            {t.status === "CANCELLED" ? "Cancelado" : "Confirmado"}
          </span>
          <span className="muted finance-desktop-only finance-detail-revision">Revisão {t.revision}</span>
        </div>
        <strong
          style={{
            fontSize: 32,
            color: t.direction === "INCOME" ? "#087F5B" : "#B5474D",
          }}
        >
          {formatMoney(t.amountCents)}
        </strong>
        <h3>{t.categoryName}</h3>
        <div className="grid">
          <div>
            <p className="muted">Caixa ou conta</p>
            <span>
              {catalogs.cashboxes.find((b) => b.id === t.cashboxId)?.name ||
                "Caixa indisponível"}
            </span>
          </div>
          <div>
            <p className="muted">Forma de pagamento</p>
            <span>
              {catalogs.paymentMethods.find((m) => m.id === t.paymentMethodId)
                ?.name || "Forma indisponível"}
            </span>
          </div>
          <div className="finance-detail-identity">
            <p className="muted">{t.direction === "INCOME" ? "Recebido de" : "Pago a"}</p>
            <span>{t.personName || t.beneficiaryName || (t.direction === "INCOME" ? "Contribuição coletiva" : "Não informado")}</span>
            {t.contributorKind === "CONGREGATION" && <small className="muted">Congregação</small>}
            {t.contributorKind === "ORGANIZATION" && <small className="muted">Empresa, instituição ou outros</small>}
          </div>
          <div>
            <p className="muted">Data da movimentação</p>
            {t.date.split("-").reverse().join("/")}
          </div>
          <div>
            <p className="muted">Mês de referência</p>
            {t.referenceMonth.split("-").reverse().join("/")}
          </div>
          <div>
            <p className="muted">Departamento</p>
            {t.departmentName}
          </div>
          {t.classificationName && (
            <div>
              <p className="muted">Classificação no lançamento</p>
              {t.classificationName}
            </div>
          )}
        </div>
        {t.description && <p>{t.description}</p>}
        {t.documentNumber && (
          <p className="muted">Documento: {t.documentNumber}</p>
        )}
        {t.paymentReference && (
          <p className="muted">Referência do pagamento: {t.paymentReference}</p>
        )}
        {t.notes && <div className="notice">{t.notes}</div>}
        {t.attendanceId && (
          <p className="notice">
            Este item faz parte de um atendimento. O comprovante reúne todas as
            contribuições da pessoa.
          </p>
        )}
        <section className="stack">
          <h3>Comprovantes</h3>
          {t.receipts.length === 0 ? (
            <p className="muted">Sem comprovante emitido.</p>
          ) : (
            t.receipts.map((r) => (
              <Link
                key={r.id}
                className="finance-secondary-link"
                target="_blank"
                rel="noopener"
                href={financeLocation(
                  `/financeiro/comprovantes/${r.id}`,
                  unit,
                  month,
                )}
              >
                <Printer size={17} />
                Imprimir comprovante
                {(r.status === "SUPERSEDED" || r.status === "CANCELLED") && (
                  <span className="muted">
                    {" "}
                    · {r.status === "SUPERSEDED" ? "Substituído" : "Cancelado"}
                  </span>
                )}
              </Link>
            ))
          )}
        </section>
        {t.documents.length > 0 && (
          <section className="stack">
            <h3>Anexos</h3>
            {t.documents.map((d) => (
              <Button
                key={d.id}
                variant="outline"
                loading={openingDocument === d.id}
                disabled={openingDocument !== null}
                onClick={async () => {
                  setOpeningDocument(d.id);
                  const popup = window.open("about:blank", "_blank");
                  if (popup) popup.opener = null;
                  try {
                    const result = await getFinanceDocumentUrlAction(
                      unit,
                      d.id,
                    );
                    if (!result.ok) {
                      popup?.close();
                      setError(result.message);
                      return;
                    }
                    if (popup) popup.location.href = result.data.url;
                    else {
                      const a = document.createElement("a");
                      a.href = result.data.url;
                      a.download = d.name;
                      a.click();
                    }
                  } catch {
                    popup?.close();
                    setError("Não foi possível abrir o anexo.");
                  } finally {
                    setOpeningDocument(null);
                  }
                }}
              >
                <FileDown size={15} />
                {d.name}
              </Button>
            ))}
          </section>
        )}
        <details className="finance-transaction-history">
          <summary>Histórico de alterações <span className="muted">{t.history.length} registro{t.history.length !== 1 ? "s" : ""}</span></summary>
          <div className="stack">
          {t.history.map((h) => (
            <div className="card" key={h.revision}>
              <strong>Revisão {h.revision}</strong>
              <p>{h.reason}</p>
              {h.beforeAmountCents !== null && h.afterAmountCents !== null && (
                <p className="muted">
                  {formatMoney(h.beforeAmountCents)} →{" "}
                  {formatMoney(h.afterAmountCents)}
                </p>
              )}
              <span className="muted">
                {new Date(h.createdAt).toLocaleString("pt-BR", {
                  timeZone: "America/Sao_Paulo",
                })}
              </span>
            </div>
          ))}
          </div>
        </details>
      </div>
    </Modal>
  );
}
