"use client";
import { useFinanceNavigation } from "./finance-shell";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { financeLocation } from "../utils/finance-navigation";
import { Plus, ArrowUpRight, ArrowLeftRight, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FinanceCatalogs } from "../types/finance-catalog.types";
import type { FinanceCapabilities } from "../types/finance.types";
import type {
  FinanceTransactionDetail,
  FinanceTransactionPage,
} from "../types/finance-query.types";
import type { FinanceFilters } from "../validations/finance-query.schemas";
import { formatMoney } from "../utils/finance-money";
import { FinanceTransactionsTable } from "./finance-transactions-table";
import { FinanceTransactionDrawer } from "./finance-transaction-drawer";
import { FinanceCancellationDialog } from "./finance-correction-dialog";
import {
  FinanceTransferDialog,
  type TransferRow,
} from "./finance-transfer-dialog";
export function FinanceTransactionsWorkspace({
  unit,
  month,
  date,
  catalogs,
  capabilities,
  result,
  filters,
  transfers,
  initialEntry,
}: {
  unit: string;
  month: string;
  date: string;
  catalogs: FinanceCatalogs;
  capabilities: FinanceCapabilities;
  result: FinanceTransactionPage;
  filters: FinanceFilters;
  transfers: { items: TransferRow[]; page: number; pageCount: number };
  initialEntry: "INCOME" | "EXPENSE" | null;
}) {
  const [entry, setEntry] = useState<{
      direction: "INCOME" | "EXPENSE";
      transaction?: FinanceTransactionDetail;
    } | null>(
      initialEntry && capabilities.create ? { direction: initialEntry } : null,
    ),
    [cancel, setCancel] = useState<{
      id: string;
      revision: number;
      kind: "CANCEL_TRANSACTION" | "CANCEL_ATTENDANCE" | "CANCEL_TRANSFER";
      attendance?: { id: string; revision: number };
    } | null>(null),
    [transfer, setTransfer] = useState<{ existing?: TransferRow } | null>(null),
    navigation = useFinanceNavigation(),
    search = useSearchParams();
  function transferActions(t: TransferRow) {
    if (!capabilities.transfer || t.status === "CANCELLED") return null;
    return (
      <div className="row">
        <Button
          variant="outline"
          size="sm"
          aria-label="Corrigir transferência"
          onClick={() => setTransfer({ existing: t })}
        >
          <Pencil size={14} />
        </Button>
        <Button
          variant="outline"
          size="sm"
          aria-label="Cancelar transferência"
          onClick={() =>
            setCancel({
              id: t.id,
              revision: t.revision,
              kind: "CANCEL_TRANSFER",
            })
          }
        >
          <X size={14} />
        </Button>
      </div>
    );
  }
  return (
    <div className="stack">
      <FinanceTransactionsTable
        unit={unit}
        month={month}
        catalogs={catalogs}
        result={result}
        filters={filters}
        actions={
          <div className="row finance-transaction-actions">
            {capabilities.create && <Button variant="outline" className="finance-desktop-only" onClick={() => navigation.navigate(financeLocation("/financeiro/lancamentos/importacoes", unit, month))}>Importar extrato</Button>}
            {capabilities.transfer && (
              <Button variant="outline" className="finance-transfer-action" onClick={() => setTransfer({})}>
                <ArrowLeftRight size={16} />
                Transferir
              </Button>
            )}
            {capabilities.create && (
              <>
                <Button
                  variant="outline"
                  className="finance-expense-action"
                  onClick={() => setEntry({ direction: "EXPENSE" })}
                >
                  <ArrowUpRight size={16} />
                  <span className="finance-desktop-only">Nova saída</span>
                  <span className="finance-mobile-only">Saída</span>
                </Button>
                <Button className="finance-income-action" onClick={() => setEntry({ direction: "INCOME" })}>
                  <Plus size={16} />
                  <span className="finance-desktop-only">Nova entrada</span>
                  <span className="finance-mobile-only">Entrada</span>
                </Button>
              </>
            )}
          </div>
        }
        detailActions={(t, close) =>
          t.status !== "CANCELLED" ? (
            <div className="finance-detail-actions">
              {capabilities.update && (
                <Button
                  variant="outline"
                  onClick={() => {
                    close();
                    setEntry({ direction: t.direction, transaction: t });
                  }}
                >
                  <Pencil size={15} />
                  Corrigir
                </Button>
              )}
              {capabilities.cancel && (
                <>
                  <Button
                    variant="danger"
                    className="finance-desktop-only"
                    onClick={() => {
                      close();
                      setCancel({
                        id: t.id,
                        revision: t.revision,
                        kind: "CANCEL_TRANSACTION",
                      });
                    }}
                  >
                    Cancelar lançamento
                  </Button>
                  <Button
                    variant="danger"
                    className="finance-mobile-only"
                    onClick={() => {
                      close();
                      setCancel({
                        id: t.id,
                        revision: t.revision,
                        kind: "CANCEL_TRANSACTION",
                        attendance: t.attendanceId && t.attendanceRevision != null
                          ? { id: t.attendanceId, revision: t.attendanceRevision }
                          : undefined,
                      });
                    }}
                  >
                    <X size={17} aria-hidden="true" />
                    Cancelar
                  </Button>
                  {t.attendanceId && (
                    <Button
                      variant="outline"
                      className="finance-desktop-only"
                      onClick={() => {
                        close();
                        setCancel({
                          id: t.attendanceId!,
                          revision: t.attendanceRevision!,
                          kind: "CANCEL_ATTENDANCE",
                        });
                      }}
                    >
                      Cancelar atendimento
                    </Button>
                  )}
                </>
              )}
            </div>
          ) : undefined
        }
      />
      {transfers.items.length > 0 && (
        <details className="card finance-transfers">
          <summary>
            <ArrowLeftRight size={17} aria-hidden="true" />
            Transferências entre caixas
          </summary>
          <div className="stack" style={{ marginTop: 18 }}>
            <div className="finance-mobile-transfers">
              {transfers.items.map((t) => (
                <article className="finance-mobile-transfer-card" key={t.id}>
                  <div className="row spread">
                    <strong>{formatMoney(t.amountCents)}</strong>
                    <span className="badge">
                      {t.status === "CANCELLED" ? "Cancelada" : "Confirmada"}
                    </span>
                  </div>
                  <p>
                    {catalogs.cashboxes.find((b) => b.id === t.sourceCashboxId)
                      ?.name || "Origem indisponível"}
                    {" → "}
                    {catalogs.cashboxes.find((b) => b.id === t.targetCashboxId)
                      ?.name || "Destino indisponível"}
                  </p>
                  <p className="muted">
                    {t.date.split("-").reverse().join("/")}
                    {t.description ? ` · ${t.description}` : ""}
                  </p>
                  {transferActions(t)}
                </article>
              ))}
            </div>
            <div className="table-scroll finance-desktop-transfers">
              <table>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Origem → destino</th>
                    <th>Valor</th>
                    <th>Situação</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {transfers.items.map((t) => (
                    <tr key={t.id}>
                      <td>{t.date.split("-").reverse().join("/")}</td>
                      <td>
                        {
                          catalogs.cashboxes.find(
                            (b) => b.id === t.sourceCashboxId,
                          )?.name
                        }{" "}
                        →{" "}
                        {
                          catalogs.cashboxes.find(
                            (b) => b.id === t.targetCashboxId,
                          )?.name
                        }
                        <div className="muted">{t.description}</div>
                      </td>
                      <td className="money">{formatMoney(t.amountCents)}</td>
                      <td>
                        {t.status === "CANCELLED" ? "Cancelada" : "Confirmada"}
                      </td>
                      <td>
                        {transferActions(t)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {transfers.pageCount > 1 && (
              <div className="row">
                <span className="muted">
                  Página {transfers.page} de {transfers.pageCount}
                </span>
                {[-1, 1].map((delta) => (
                  <Button
                    key={delta}
                    variant="outline"
                    disabled={
                      transfers.page + delta < 1 ||
                      transfers.page + delta > transfers.pageCount
                    }
                    onClick={() => {
                      const q = new URLSearchParams(search);
                      q.set("transferPage", String(transfers.page + delta));
                      navigation.navigate(`/financeiro/lancamentos?${q}`);
                    }}
                  >
                    {delta < 0 ? "Anterior" : "Próxima"}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </details>
      )}
      {entry && (
        <FinanceTransactionDrawer
          unit={unit}
          month={month}
          date={date}
          catalogs={catalogs}
          capabilities={capabilities}
          direction={entry.direction}
          initialTransaction={entry.transaction}
          onClose={() => setEntry(null)}
        />
      )}
      {cancel && (
        <FinanceCancellationDialog
          unit={unit}
          {...cancel}
          onClose={() => setCancel(null)}
        />
      )}
      {transfer && (
        <FinanceTransferDialog
          unit={unit}
          date={date}
          boxes={catalogs.cashboxes}
          existing={transfer.existing}
          onClose={() => setTransfer(null)}
        />
      )}
    </div>
  );
}
