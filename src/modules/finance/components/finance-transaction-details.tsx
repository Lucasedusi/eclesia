"use client";
import Link from "next/link";
import { useState } from "react";
import { FileDown, FileText, Printer } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import type { FinanceCatalogs } from "../types/finance-catalog.types";
import type { FinanceTransactionDetail } from "../types/finance-query.types";
import { financeTransactionStatusLabel } from "../utils/finance-transaction-status";
import { formatMoney } from "../utils/finance-money";
import { financeLocation } from "../utils/finance-navigation";
import { getFinanceDocumentUrlAction } from "../actions/finance-document.actions";
import { createFinanceDigitalReceiptLinkAction } from "../actions/finance-digital-receipt.actions";
import { SHAREABLE_RECEIPT_STATUSES } from "../utils/finance-digital-receipt";
import type { DigitalReceiptLink } from "../types/finance-digital-receipt.types";
import { FinanceDigitalReceiptDialog } from "./finance-digital-receipt-dialog";
import { ReceiptActions } from "./finance-digital-receipt.styles";
const historyActions = { CREATED: "Lançado", UPDATED: "Alterado", CANCELLED: "Cancelado" };

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
  const [preparingReceipt, setPreparingReceipt] = useState<string | null>(null);
  const [digital, setDigital] = useState<{ link: DigitalReceiptLink; number: string } | null>(null);
  if (digital) return <FinanceDigitalReceiptDialog link={digital.link} number={digital.number} attendance={Boolean(t.attendanceId)} onClose={() => setDigital(null)} />;
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
            {financeTransactionStatusLabel(t.status)}
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
              <ReceiptActions key={r.id}>
              <Link
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
              {t.status === "CONFIRMED" && SHAREABLE_RECEIPT_STATUSES.includes(r.status) && <Button variant="outline" size="sm" loading={preparingReceipt === r.id} disabled={preparingReceipt !== null} onClick={async () => {
                setPreparingReceipt(r.id);
                setError("");
                try {
                  const result = await createFinanceDigitalReceiptLinkAction(unit, r.id);
                  if (result.ok) setDigital({ link: result.data, number: r.number });
                  else setError(result.message);
                } catch {
                  setError("Não foi possível preparar o comprovante digital. Tente novamente.");
                } finally { setPreparingReceipt(null); }
              }}><FileText size={16} aria-hidden="true" />Comprovante digital</Button>}
              </ReceiptActions>
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
              <strong>{historyActions[h.action]}{h.actorName ? ` por ${h.actorName}` : " · Responsável não identificado"}</strong>
              {h.reason && <p>{h.reason}</p>}
              {h.beforeAmountCents !== null && h.afterAmountCents !== null && h.beforeAmountCents !== h.afterAmountCents && (
                <p className="muted">
                  {formatMoney(h.beforeAmountCents)} →{" "}
                  {formatMoney(h.afterAmountCents)}
                </p>
              )}
              <span className="muted">
                Revisão {h.revision} · {new Date(h.createdAt).toLocaleString("pt-BR", {
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
