"use client";
import { useState } from "react";
import { Upload, ArrowRight, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFinanceNavigation } from "../components/finance-shell";
import { financeLocation } from "../utils/finance-navigation";
import type { FinanceCatalogs } from "../types/finance-catalog.types";
import type { BankImportBatch } from "./types";
import { prepareBankImportAction } from "./actions";
import { BankImportLayout } from "./bank-import.styles";

export function BankImportMobile({
  unit,
  month,
}: {
  unit: string;
  month: string;
}) {
  const navigation = useFinanceNavigation();
  return (
    <section className="bank-import-mobile bank-import-card">
      <Monitor size={28} />
      <h2>Importação de extratos</h2>
      <p>Use um computador para conferir e importar extratos.</p>
      <Button
        variant="outline"
        onClick={() =>
          navigation.navigate(
            financeLocation("/financeiro/lancamentos", unit, month),
          )
        }
      >
        Voltar aos lançamentos
      </Button>
    </section>
  );
}
export function BankImportList({
  unit,
  month,
  catalogs,
  history,
}: {
  unit: string;
  month: string;
  catalogs: FinanceCatalogs;
  history: { batches: BankImportBatch[]; page: number; pageCount: number };
}) {
  const navigation = useFinanceNavigation(),
    accounts = catalogs.cashboxes.filter(
      (b) => b.kind === "BANK_ACCOUNT" && b.status === "ACTIVE",
    );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function upload(form: FormData) {
    setBusy(true);
    setError("");
    form.set("unit", unit);
    try {
      const result = await prepareBankImportAction(form);
      if (!result.ok) setError(result.message);
      else
        navigation.navigate(
          financeLocation(
            `/financeiro/lancamentos/importacoes/${result.data.id}`,
            unit,
            month,
          ),
        );
    } catch {
      setError(
        "Não foi possível confirmar o envio. Envie o mesmo arquivo novamente para retomar a importação.",
      );
    } finally {
      setBusy(false);
    }
  }
  const base = financeLocation(
    "/financeiro/lancamentos/importacoes",
    unit,
    month,
  );
  return (
    <BankImportLayout>
      <BankImportMobile unit={unit} month={month} />
      <div className="bank-import-desktop stack">
        <header>
          <h1>Importar extrato bancário</h1>
          <p className="muted">
            Prepare os movimentos do Sicoob e confira cada lançamento antes de
            confirmar.
          </p>
        </header>
        <form className="bank-import-card stack" action={upload}>
          <fieldset
            disabled={busy}
            className="stack"
            style={{ border: 0, padding: 0 }}
          >
            <div className="grid">
              <label>
                Conta bancária
                <select
                  name="cashboxId"
                  required
                  defaultValue={accounts.length === 1 ? accounts[0].id : ""}
                >
                  <option value="">Selecione a conta do extrato</option>
                  {accounts.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                      {b.bankName ? ` · ${b.bankName}` : ""}
                      {b.accountNumber ? ` · ${b.accountNumber}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Extrato XLSX do Sicoob
                <input
                  name="file"
                  type="file"
                  required
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                />
              </label>
            </div>
            <p className="muted">
              Até 5 MB e 5.000 movimentos. A conta deve corresponder ao arquivo
              enviado. A preparação cria pendências; a confirmação de cada item
              registra a movimentação.
            </p>
            {!accounts.length && (
              <p role="alert">
                Cadastre uma conta bancária ativa nesta congregação para
                importar o extrato.
              </p>
            )}
            {error && <p role="alert">{error}</p>}
            <div>
              <Button
                type="submit"
                disabled={busy || !accounts.length}
                loading={busy}
              >
                <Upload size={16} />
                Preparar importação
              </Button>
            </div>
          </fieldset>
        </form>
        <section className="bank-import-card stack">
          <h2>Importações anteriores</h2>
          {history.batches.length === 0 ? (
            <p className="muted">Nenhum extrato importado nesta congregação.</p>
          ) : (
            <div className="bank-import-table">
              <table>
                <thead>
                  <tr>
                    <th>Arquivo e conta</th>
                    <th>Período</th>
                    <th>Movimentos</th>
                    <th>Pendentes</th>
                    <th>Conferência</th>
                  </tr>
                </thead>
                <tbody>
                  {history.batches.map((b) => (
                    <tr key={b.id}>
                      <td>
                        <strong>{b.fileName}</strong>
                        <span className="bank-import-excerpt">
                          {b.cashboxName}
                        </span>
                      </td>
                      <td>
                        {b.dateFrom?.split("-").reverse().join("/") ??
                          "A conferir"}
                        <br />
                        {b.dateTo !== b.dateFrom &&
                          b.dateTo?.split("-").reverse().join("/")}
                      </td>
                      <td>{b.total}</td>
                      <td>{b.pending}</td>
                      <td>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            navigation.navigate(
                              financeLocation(
                                `/financeiro/lancamentos/importacoes/${b.id}`,
                                unit,
                                month,
                              ),
                            )
                          }
                        >
                          Continuar
                          <ArrowRight size={14} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="row spread">
            <span className="muted">
              Página {history.page} de {history.pageCount}
            </span>
            <div className="row">
              <Button
                variant="outline"
                disabled={history.page <= 1}
                onClick={() =>
                  navigation.navigate(`${base}&pagina=${history.page - 1}`)
                }
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                disabled={history.page >= history.pageCount}
                onClick={() =>
                  navigation.navigate(`${base}&pagina=${history.page + 1}`)
                }
              >
                Próxima
              </Button>
            </div>
          </div>
        </section>
      </div>
    </BankImportLayout>
  );
}
