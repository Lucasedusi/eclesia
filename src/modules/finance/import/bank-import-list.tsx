"use client";
import { useLayoutEffect, useRef, useState } from "react";
import {
  Upload,
  ArrowRight,
  Monitor,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFinanceNavigation } from "../components/finance-shell";
import { financeLocation } from "../utils/finance-navigation";
import type { FinanceCatalogs } from "../types/finance-catalog.types";
import type { BankImportBatch } from "./types";
import { prepareBankImportAction } from "./actions";
import { BankImportLifecycleButton } from "./bank-import-lifecycle";
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
  const [file, setFile] = useState<File | null>(null),
    [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => {
    const input = fileInput.current;
    return () => {
      // Activity preserves this page; a new visit starts with no pending upload.
      setFile(null);
      setDragging(false);
      setError("");
      if (input) input.value = "";
    };
  }, []);
  function choose(file: File | undefined) {
    if (!file) return;
    if (
      !/\.xlsx$/i.test(file.name) ||
      !file.size ||
      file.size > 5 * 1024 * 1024
    ) {
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
      setError("Selecione um arquivo XLSX de até 5 MB.");
      return;
    }
    setFile(file);
    setError("");
  }
  async function upload(form: FormData) {
    if (!file) {
      setError("Selecione o extrato para continuar.");
      return;
    }
    form.set("file", file);
    setBusy(true);
    setError("");
    form.set("unit", unit);
    try {
      const result = await prepareBankImportAction(form);
      if (!result.ok) setError(result.message);
      else {
        setFile(null);
        if (fileInput.current) fileInput.current.value = "";
        navigation.navigate(
          financeLocation(
            `/financeiro/lancamentos/importacoes/${result.data.id}`,
            unit,
            month,
          ),
        );
      }
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
            <div className="grid bank-import-upload-grid">
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
              <div className="bank-import-upload-field">
                <span className="bank-import-field-label">
                  Extrato XLSX do Sicoob
                </span>
                <div
                  className={`bank-import-upload-control ${dragging ? "is-dragging" : ""}`}
                  onDragOver={(event) => {
                    event.preventDefault();
                    if (!busy) setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(event) => {
                    event.preventDefault();
                    setDragging(false);
                    if (!busy) choose(event.dataTransfer.files[0]);
                  }}
                >
                  <label className="bank-import-dropzone" title={file?.name}>
                    <input
                      ref={fileInput}
                      name="file"
                      type="file"
                      aria-label="Extrato XLSX do Sicoob"
                      accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                      onChange={(event) => choose(event.target.files?.[0])}
                    />
                    {file ? (
                      <FileSpreadsheet size={18} aria-hidden="true" />
                    ) : (
                      <Upload size={18} aria-hidden="true" />
                    )}
                    <span role="status">
                      {file?.name ?? "Selecionar ou arrastar extrato"}
                    </span>
                  </label>
                  {file && (
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label="Remover arquivo selecionado"
                      onClick={() => {
                        setFile(null);
                        if (fileInput.current) fileInput.current.value = "";
                      }}
                    >
                      <X size={16} />
                    </Button>
                  )}
                </div>
              </div>
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
                    <th>Ações</th>
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
                        <BankImportLifecycleButton
                          label="Excluir importação"
                          disabled={!b.canDelete}
                          target={{
                            unit,
                            batchId: b.id,
                            action: "DELETE_BATCH",
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {history.pageCount > 1 && (
            <nav
              className="bank-import-pagination"
              aria-label="Páginas de importações"
            >
              <span className="muted">
                Página {history.page} de {history.pageCount}
              </span>
              <div className="row">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={history.page <= 1}
                  onClick={() =>
                    navigation.navigate(`${base}&pagina=${history.page - 1}`)
                  }
                >
                  <ChevronLeft size={16} /> Anterior
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={history.page >= history.pageCount}
                  onClick={() =>
                    navigation.navigate(`${base}&pagina=${history.page + 1}`)
                  }
                >
                  Próxima <ChevronRight size={16} />
                </Button>
              </div>
            </nav>
          )}
        </section>
      </div>
    </BankImportLayout>
  );
}
