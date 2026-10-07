"use client";
import { FinanceMoneyInput } from "./finance-money-input";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Plus, Printer, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FinanceCatalogs } from "../types/finance-catalog.types";
import type { FinanceCapabilities } from "../types/finance.types";
import type { FinanceTransactionDetail } from "../types/finance-query.types";
import type {
  FinanceCommand,
  FinanceMutationResult,
} from "../types/finance-command.types";
import { financeCommandSchema } from "../validations/finance-command.schemas";
import { submitFinanceCommand } from "../actions/finance-command.actions";
import {
  parseMoneyInput,
  formatMoney,
  centsToDecimal,
} from "../utils/finance-money";
import {
  newEntryState,
  nextEntryDefaults,
  type EntryFormState,
} from "../utils/finance-entry-session";
import { financeLocation } from "../utils/finance-navigation";
import { FinanceContributorPicker } from "./finance-contributor-picker";
import {
  FinanceDocumentFields,
  type AttachedDocument,
} from "./finance-document-fields";
import { useFinanceDirtyGuard, useFinanceNavigation } from "./finance-shell";
type Line = Pick<
  EntryFormState,
  | "categoryId"
  | "departmentId"
  | "amount"
  | "titheClassificationId"
  | "description"
  | "notes"
  | "documentNumber"
>;
function seed(date: string, t?: FinanceTransactionDetail): EntryFormState {
  const state = newEntryState(date);
  if (!t) return state;
  return {
    ...state,
    date: t.date,
    cashboxId: t.cashboxId,
    paymentMethodId: t.paymentMethodId,
    categoryId: t.categoryId,
    departmentId: t.departmentId,
    amount: centsToDecimal(t.amountCents).replace(".", ","),
    titheClassificationId: t.titheClassificationId,
    description: t.description ?? "",
    notes: t.notes ?? "",
    documentNumber: t.documentNumber ?? "",
    contributor: t.memberId
      ? { kind: "MEMBER", memberId: t.memberId }
      : t.contributorKind === "UNREGISTERED"
        ? { kind: "UNREGISTERED", name: t.personName ?? "" }
        : { kind: "COLLECTIVE" },
    personLabel: t.personName ?? "",
    beneficiaryName: t.beneficiaryName ?? "",
    paymentReference: t.paymentReference ?? "",
  };
}
export function FinanceEntryForm({
  unit,
  month,
  date,
  catalogs,
  capabilities,
  mode = "SINGLE",
  direction = "INCOME",
  initialTransaction,
  onConfirmed,
  onClose,
  onStatusChange,
}: {
  unit: string;
  month: string;
  date: string;
  catalogs: FinanceCatalogs;
  capabilities: FinanceCapabilities;
  mode?: "SINGLE" | "ATTENDANCE";
  direction?: "INCOME" | "EXPENSE";
  initialTransaction?: FinanceTransactionDetail;
  onConfirmed?: (result: FinanceMutationResult) => void;
  onClose?: () => void;
  onStatusChange?: (status: { dirty: boolean; busy: boolean }) => void;
}) {
  const financeNavigation = useFinanceNavigation(),
    form = useRef<HTMLFormElement>(null),
    pending = useRef<FinanceCommand | null>(null),
    operationKey = useRef("");
  const [state, setState] = useState(() => seed(date, initialTransaction)),
    [extra, setExtra] = useState<Line[]>([]),
    [files, setFiles] = useState<AttachedDocument[]>([]),
    [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(false),
    [ambiguous, setAmbiguous] = useState(false),
    [error, setError] = useState(""),
    [confirmation, setConfirmation] = useState<FinanceMutationResult | null>(
      null,
    ),
    [reason, setReason] = useState(""),
    [identityVersion, setIdentityVersion] = useState(0);
  const lines: Line[] = [state, ...extra],
    groupCorrection = Boolean(initialTransaction?.attendanceId);
  const boxes = catalogs.cashboxes.filter(
      (b) => b.status === "ACTIVE" || b.id === state.cashboxId,
    ),
    box = boxes.find((b) => b.id === state.cashboxId),
    methods = catalogs.paymentMethods.filter(
      (m) => m.status === "ACTIVE" && box?.paymentMethodIds.includes(m.id),
    );
  const categories = catalogs.categories.filter(
    (c) =>
      c.status === "ACTIVE" &&
      (c.direction === direction || c.direction === "BOTH"),
  );
  const total = lines.reduce((sum, l) => {
    try {
      return sum + parseMoneyInput(l.amount);
    } catch {
      return sum;
    }
  }, 0);
  function change(patch: Partial<EntryFormState>) {
    setState((current) => ({ ...current, ...patch }));
    setDirty(true);
  }
  function changeLine(index: number, patch: Partial<Line>) {
    if (index === 0) change(patch);
    else {
      setExtra((current) =>
        current.map((l, i) => (i === index - 1 ? { ...l, ...patch } : l)),
      );
      setDirty(true);
    }
  }
  function discard() {
    if (busy || uploading || ambiguous) return false;
    setState(seed(date, initialTransaction));
    setExtra([]);
    setFiles([]);
    setDirty(false);
    pending.current = null;
    operationKey.current = "";
    setAmbiguous(false);
    onClose?.();
    return true;
  }
  async function save(
    action: "SAVE" | "CONTINUE" | "PRINT" = "SAVE",
  ): Promise<boolean> {
    if (busy || uploading || (!ambiguous && !form.current?.reportValidity()))
      return false;
    let popup: Window | null = null;
    if (action === "PRINT") {
      popup = window.open("about:blank", "_blank");
      if (popup) popup.opener = null;
    }
    setBusy(true);
    setError("");
    try {
      if (!pending.current) {
        operationKey.current ||= crypto.randomUUID();
        const contributor =
          state.contributor ??
          (direction === "EXPENSE" ? { kind: "COLLECTIVE" } : null);
        const payment = {
          date: state.date,
          cashboxId: state.cashboxId,
          paymentMethodId: state.paymentMethodId,
          contributor,
          beneficiaryName: state.beneficiaryName,
          paymentReference: state.paymentReference,
          documentIds: state.documentIds,
        };
        const items = lines.map((l) => ({
          categoryId: l.categoryId,
          departmentId: l.departmentId,
          amountCents: parseMoneyInput(l.amount),
          titheClassificationId: catalogs.categories.find(
            (c) => c.id === l.categoryId,
          )?.isTithe
            ? l.titheClassificationId
            : null,
          description: l.description,
          notes: l.notes,
          documentNumber: l.documentNumber,
        }));
        const input = initialTransaction
          ? {
              kind: "CORRECT_TRANSACTION",
              operationKey: operationKey.current,
              congregationId: unit,
              id: initialTransaction.id,
              expectedRevision: initialTransaction.revision,
              reason,
              replacement: { ...payment, direction, item: items[0] },
            }
          : {
              kind: "RECORD",
              operationKey: operationKey.current,
              congregationId: unit,
              mode,
              direction,
              ...payment,
              items,
              issueReceipt: true,
            };
        const parsed = financeCommandSchema.safeParse(input);
        if (!parsed.success) {
          popup?.close();
          setError(
            parsed.error.issues
              .map((i) =>
                i.path.includes("contributor")
                  ? "Identifique a pessoa ou escolha contribuição coletiva."
                  : i.message,
              )
              .join(" "),
          );
          return false;
        }
        pending.current = parsed.data;
      }
      const result = await submitFinanceCommand(pending.current);
      if (!result.ok) {
        popup?.close();
        setError(result.message);
        if (result.code === "UNAVAILABLE") {
          setAmbiguous(true);
        } else {
          pending.current = null;
          setAmbiguous(false);
        }
        return false;
      }
      pending.current = null;
      operationKey.current = "";
      setAmbiguous(false);
      setDirty(false);
      setConfirmation(result.data);
      onConfirmed?.(result.data);
      financeNavigation.refresh();
      if (action === "PRINT" && result.data.receiptId) {
        const url =
          financeLocation(
            `/financeiro/comprovantes/${result.data.receiptId}`,
            unit,
            month,
          ) + "&imprimir=1";
        if (popup) popup.location.href = url;
      } else popup?.close();
      if (initialTransaction || (action === "SAVE" && mode === "SINGLE")) {
        onClose?.();
      } else {
        setState(nextEntryDefaults(state, ""));
        setExtra([]);
        setFiles([]);
        setIdentityVersion((v) => v + 1);
      }
      return true;
    } catch {
      popup?.close();
      if (pending.current) setAmbiguous(true);
      setError(
        pending.current
          ? "Não foi possível confirmar. Tente novamente; a mesma operação será conferida antes de gravar."
          : "Confira os valores. Use vírgula para os centavos, por exemplo 200,00.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    onStatusChange?.({
      dirty: dirty || ambiguous,
      busy: busy || uploading || ambiguous,
    });
  }, [dirty, ambiguous, busy, uploading, onStatusChange]);
  useEffect(() => {
    if (identityVersion > 0)
      form.current
        ?.querySelector<HTMLInputElement>("[data-person-search]")
        ?.focus();
  }, [identityVersion]);
  useFinanceDirtyGuard(dirty || ambiguous, () => save("SAVE"), discard);
  return (
    <form
      ref={form}
      key={identityVersion}
      className={mode === "ATTENDANCE" ? "finance-attendance-form" : "stack"}
      onSubmit={(e) => {
        e.preventDefault();
        void save(mode === "ATTENDANCE" ? "CONTINUE" : "SAVE");
      }}
    >
      {confirmation && (
        <div className="notice" role="status">
          {mode === "ATTENDANCE" ? "Atendimento" : "Lançamento"} confirmado.
          {confirmation.receiptId && (
            <>
              {" "}
              <Link
                target="_blank"
                rel="noopener"
                href={financeLocation(
                  `/financeiro/comprovantes/${confirmation.receiptId}`,
                  unit,
                  month,
                )}
              >
                Abrir comprovante
              </Link>
            </>
          )}
        </div>
      )}
      {error && <div role="alert">{error}</div>}
      {ambiguous && (
        <div className="notice">
          O preenchimento está preservado. Confirme esta tentativa antes de
          fazer outro lançamento.
        </div>
      )}
      <fieldset
        disabled={busy || ambiguous}
        className="stack finance-entry-fields"
        style={{ border: 0, padding: 0, minWidth: 0 }}
      >
        <section className="stack finance-form-section">
          <h3>{direction === "EXPENSE" ? "Favorecido" : "Pessoa atendida"}</h3>
          {groupCorrection ? (
            <p className="notice">
              A identificação e o recebimento pertencem ao atendimento inteiro.
              Você pode corrigir a contribuição abaixo. Para alterar os dados
              comuns, cancele o atendimento e registre novamente.
            </p>
          ) : direction === "INCOME" ? (
            <FinanceContributorPicker
              key={identityVersion}
              unit={unit}
              value={state.contributor}
              label={state.personLabel}
              canLookup={capabilities.lookupContributors}
              onChange={(contributor, personLabel, suggested) => {
                change({
                  contributor,
                  personLabel,
                  titheClassificationId: suggested ?? null,
                });
                setExtra((current) =>
                  current.map((l) => ({
                    ...l,
                    titheClassificationId: suggested ?? null,
                  })),
                );
              }}
            />
          ) : (
            <label>
              Favorecido (opcional)
              <input
                value={state.beneficiaryName}
                maxLength={160}
                onChange={(e) => change({ beneficiaryName: e.target.value })}
              />
            </label>
          )}
        </section>
        <h3 className="finance-section-title">
          {direction === "EXPENSE" ? "Pagamento" : "Recebimento"}
        </h3>
        <div className="grid">
          <label>
            Data
            <input
              data-entry-focus
              type="date"
              value={state.date}
              required
              disabled={groupCorrection}
              onChange={(e) => change({ date: e.target.value })}
            />
          </label>
          <label>
            Referência
            <input
              readOnly
              value={state.date.slice(0, 7).split("-").reverse().join("/")}
              tabIndex={-1}
            />
          </label>
        </div>
        <div className="grid">
          <label>
            Caixa ou conta
            <select
              value={state.cashboxId}
              required
              disabled={groupCorrection}
              onChange={(e) => {
                const b = boxes.find((v) => v.id === e.target.value),
                  available = catalogs.paymentMethods.filter(
                    (m) =>
                      m.status === "ACTIVE" &&
                      b?.paymentMethodIds.includes(m.id),
                  );
                change({
                  cashboxId: e.target.value,
                  paymentMethodId:
                    available.length === 1 ? available[0].id : "",
                });
              }}
            >
              <option value="">Selecione</option>
              {boxes.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                  {b.status !== "ACTIVE" ? " (inativo)" : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            Forma de pagamento
            <select
              value={state.paymentMethodId}
              required
              disabled={groupCorrection}
              onChange={(e) => change({ paymentMethodId: e.target.value })}
            >
              <option value="">Selecione</option>
              {methods.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {lines.map((line, index) => {
          const category = catalogs.categories.find(
            (c) => c.id === line.categoryId,
          );
          return (
            <fieldset
              className="stack finance-form-section"
              key={index}
              style={{
                minWidth: 0,
                border: mode === "ATTENDANCE" ? undefined : 0,
                padding: mode === "ATTENDANCE" ? 18 : 0,
              }}
            >
              <legend>
                {mode === "ATTENDANCE"
                  ? `Contribuição ${index + 1}`
                  : direction === "EXPENSE"
                    ? "Dados da saída"
                    : "Dados da entrada"}
              </legend>
              <div className="grid">
                <label>
                  Categoria
                  <select
                    value={line.categoryId}
                    required
                    onChange={(e) => {
                      const c = categories.find((v) => v.id === e.target.value);
                      changeLine(index, {
                        categoryId: e.target.value,
                        ...(c?.departmentId
                          ? { departmentId: c.departmentId }
                          : {}),
                      });
                    }}
                  >
                    <option value="">Selecione</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Departamento
                  <select
                    value={line.departmentId}
                    required
                    onChange={(e) =>
                      changeLine(index, { departmentId: e.target.value })
                    }
                  >
                    <option value="">Selecione</option>
                    {catalogs.departments
                      .filter((d) => d.status === "ACTIVE")
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                  </select>
                </label>
              </div>
              <div className="grid">
                <label>
                  Valor (R$)
                  <FinanceMoneyInput
                    inputMode="decimal"
                    value={line.amount}
                    placeholder="0,00"
                    required
                    onChange={(e) =>
                      changeLine(index, { amount: e.target.value })
                    }
                  />
                </label>
                {category?.isTithe && (
                  <label>
                    Classificação do dízimo
                    <select
                      value={line.titheClassificationId ?? ""}
                      required
                      onChange={(e) =>
                        changeLine(index, {
                          titheClassificationId: e.target.value || null,
                        })
                      }
                    >
                      <option value="">Selecione</option>
                      {catalogs.classifications
                        .filter((c) => c.status === "ACTIVE")
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                    </select>
                  </label>
                )}
              </div>
              {mode === "ATTENDANCE" && index > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setExtra((current) =>
                      current.filter((_, i) => i !== index - 1),
                    );
                    setDirty(true);
                  }}
                >
                  <Trash2 size={14} />
                  Remover contribuição
                </Button>
              )}
            </fieldset>
          );
        })}
        {mode === "ATTENDANCE" && (
          <Button
            variant="outline"
            onClick={() => {
              setExtra((current) => [
                ...current,
                {
                  categoryId: state.categoryId,
                  departmentId: state.departmentId,
                  amount: "",
                  titheClassificationId: state.titheClassificationId,
                  description: "",
                  notes: "",
                  documentNumber: "",
                },
              ]);
              setDirty(true);
            }}
            disabled={lines.length >= 50}
          >
            <Plus size={16} />
            Adicionar contribuição
          </Button>
        )}
        <details
          open={state.detailsOpen}
          onToggle={(e) => {
            const open = e.currentTarget.open;
            if (open !== state.detailsOpen)
              setState((current) => ({ ...current, detailsOpen: open }));
          }}
        >
          <summary className="muted" style={{ cursor: "pointer" }}>
            Documento, descrição, observações e anexos
          </summary>
          <div className="stack" style={{ marginTop: 16 }}>
            <label>
              Número do documento
              <input
                maxLength={80}
                value={state.documentNumber}
                onChange={(e) => change({ documentNumber: e.target.value })}
              />
            </label>
            <label>
              Descrição
              <input
                maxLength={1000}
                value={state.description}
                onChange={(e) => change({ description: e.target.value })}
              />
            </label>
            <label>
              Observações
              <textarea
                maxLength={1000}
                value={state.notes}
                onChange={(e) => change({ notes: e.target.value })}
              />
            </label>
            <label>
              Referência do pagamento
              <input
                maxLength={160}
                value={state.paymentReference}
                onChange={(e) => change({ paymentReference: e.target.value })}
              />
            </label>
            <FinanceDocumentFields
              unit={unit}
              value={files}
              onChange={(next) => {
                setFiles(next);
                change({ documentIds: next.map((d) => d.id) });
              }}
              onBusy={setUploading}
            />
          </div>
        </details>
        {initialTransaction && (
          <label>
            Justificativa da correção
            <textarea
              required
              minLength={5}
              maxLength={1000}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setDirty(true);
              }}
            />
          </label>
        )}
      </fieldset>
      <aside
        className={
          mode === "ATTENDANCE" ? "finance-attendance-summary stack" : "stack"
        }
      >
        {mode === "ATTENDANCE" && (
          <div className="finance-attendance-total stack">
            <h3>Resumo do atendimento</h3>
            <p className="muted">
              {state.personLabel ||
                (state.contributor?.kind === "COLLECTIVE"
                  ? "Contribuição coletiva"
                  : "Identifique a pessoa para começar")}
            </p>
            <span className="muted">
              {lines.length}{" "}
              {lines.length === 1 ? "contribuição" : "contribuições"}
            </span>
            <span>Total do atendimento</span>
            <strong data-testid="attendance-total" style={{ fontSize: 25 }}>
              {formatMoney(total)}
            </strong>
          </div>
        )}
        <div className="row">
          <Button
            type="submit"
            variant={direction === "EXPENSE" ? "danger" : "primary"}
            loading={busy}
            disabled={uploading}
          >
            <Save size={16} />
            {initialTransaction
              ? "Salvar correção"
              : mode === "ATTENDANCE"
                ? "Confirmar atendimento"
                : "Salvar"}
          </Button>
          {!initialTransaction && (
            <>
              <Button
                variant="outline"
                disabled={busy || uploading}
                onClick={() => void save("CONTINUE")}
              >
                Salvar e continuar
              </Button>
              <Button
                variant="outline"
                disabled={busy || uploading}
                onClick={() => void save("PRINT")}
              >
                <Printer size={16} />
                Salvar e imprimir
              </Button>
            </>
          )}
        </div>
      </aside>
    </form>
  );
}
