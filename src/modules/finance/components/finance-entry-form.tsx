"use client";
import { FinanceMoneyInput } from "./finance-money-input";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Plus, Printer, Save, Trash2, ArrowRight } from "lucide-react";
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
import type { BankImportDraft } from "../import/schemas";
import type { FinanceActionResult } from "../types/finance.types";
export type BankImportEntry = {
  draft: BankImportDraft;
  amountCents: number;
  submit: (
    command: FinanceCommand,
    next: boolean,
  ) => Promise<FinanceActionResult<FinanceMutationResult>>;
  saveDraft: (draft: BankImportDraft) => Promise<boolean>;
};
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
  bankImport,
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
  bankImport?: BankImportEntry;
}) {
  const financeNavigation = useFinanceNavigation(),
    form = useRef<HTMLFormElement>(null),
    pending = useRef<FinanceCommand | null>(null),
    operationKey = useRef("");
  const [state, setState] = useState(
      () => bankImport?.draft.state ?? seed(date, initialTransaction),
    ),
    [extra, setExtra] = useState<Line[]>(bankImport?.draft.extra ?? []),
    [savedDocumentIds, setSavedDocumentIds] = useState<string[]>(
      bankImport?.draft.state.documentIds ?? [],
    ),
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
    groupCorrection = Boolean(initialTransaction?.attendanceId),
    collective =
      direction === "INCOME" && state.contributor?.kind === "COLLECTIVE";
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
    setState(bankImport?.draft.state ?? seed(date, initialTransaction));
    setExtra(bankImport?.draft.extra ?? []);
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
        if (bankImport && total !== bankImport.amountCents) {
          setError(
            "A soma das contribuições deve ser igual ao valor do extrato.",
          );
          return false;
        }
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
      const result = bankImport
        ? await bankImport.submit(pending.current, action === "CONTINUE")
        : await submitFinanceCommand(pending.current);
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
      if (bankImport) return true;
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
  async function saveDraft() {
    if (!bankImport || busy || uploading || ambiguous) return false;
    setBusy(true);
    setError("");
    try {
      const saved = await bankImport.saveDraft({ state, extra });
      if (saved) setDirty(false);
      return saved;
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
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const keepFocusedFieldVisible = () => {
      if (
        !window.matchMedia("(max-width: 760px)").matches ||
        viewport.height >= window.innerHeight * 0.85
      )
        return;
      const focused = document.activeElement;
      if (
        focused instanceof HTMLElement &&
        form.current?.contains(focused) &&
        focused.matches("input, select, textarea")
      )
        focused.scrollIntoView({ block: "center", inline: "nearest" });
    };
    viewport.addEventListener("resize", keepFocusedFieldVisible);
    return () =>
      viewport.removeEventListener("resize", keepFocusedFieldVisible);
  }, []);
  useFinanceDirtyGuard(
    dirty || ambiguous,
    () => (bankImport ? saveDraft() : save("SAVE")),
    discard,
  );
  return (
    <form
      ref={form}
      key={identityVersion}
      className={
        mode === "ATTENDANCE" || bankImport
          ? "finance-attendance-form"
          : "stack"
      }
      onSubmit={(e) => {
        e.preventDefault();
        void save(!bankImport && mode === "ATTENDANCE" ? "CONTINUE" : "SAVE");
      }}
    >
      {confirmation && (
        <div className="notice" role="status">
          {mode === "ATTENDANCE" ? "Atendimento" : "Lançamento"} confirmado.
          {confirmation.receiptId && (
            <>
              {" "}
              <Link
                className="finance-secondary-link"
                target="_blank"
                rel="noopener"
                href={financeLocation(
                  `/financeiro/comprovantes/${confirmation.receiptId}`,
                  unit,
                  month,
                )}
              >
                <Printer size={16} aria-hidden="true" /> Comprovante
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
          {collective && (
            <div className="stack">
              <label>
                Descrição da contribuição
                <input
                  maxLength={1000}
                  placeholder="Ex.: Oferta do culto de ensino"
                  value={state.description}
                  onChange={(e) => change({ description: e.target.value })}
                />
              </label>
              <small className="muted">
                Opcional. Esta descrição aparecerá no relatório.
              </small>
            </div>
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
              disabled={groupCorrection || Boolean(bankImport)}
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
              disabled={groupCorrection || Boolean(bankImport)}
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
        {bankImport && extra.length > 0 && (
          <div className="bank-import-warning">
            <p>
              Este rascunho antigo divide o movimento em várias contribuições.
              As classificações foram preservadas.
            </p>
            <Button
              variant="outline"
              onClick={() => {
                if (
                  !window.confirm(
                    "Unificar o valor na primeira classificação e remover as demais contribuições deste rascunho?",
                  )
                )
                  return;
                setExtra([]);
                setState((current) => ({
                  ...current,
                  amount: centsToDecimal(bankImport.amountCents).replace(
                    ".",
                    ",",
                  ),
                }));
                setDirty(true);
              }}
            >
              Usar uma classificação
            </Button>
          </div>
        )}
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
                {mode === "ATTENDANCE" && !bankImport
                  ? `Contribuição ${index + 1}`
                  : direction === "EXPENSE"
                    ? "Dados da saída"
                    : "Dados da entrada"}
              </legend>
              {collective && index > 0 && (
                <label>
                  Descrição da contribuição {index + 1}
                  <input
                    maxLength={1000}
                    placeholder="Ex.: Oferta de missões"
                    value={line.description}
                    onChange={(e) =>
                      changeLine(index, { description: e.target.value })
                    }
                  />
                </label>
              )}
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
                    readOnly={Boolean(bankImport) && extra.length === 0}
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
              {mode === "ATTENDANCE" && !bankImport && index > 0 && (
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
        {mode === "ATTENDANCE" && !bankImport && (
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
            {collective
              ? "Documento, observações e anexos"
              : "Documento, descrição, observações e anexos"}
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
            {!collective && (
              <label>
                Descrição
                <input
                  maxLength={1000}
                  value={state.description}
                  onChange={(e) => change({ description: e.target.value })}
                />
              </label>
            )}
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
                change({
                  documentIds: [...savedDocumentIds, ...next.map((d) => d.id)],
                });
              }}
              onBusy={setUploading}
            />
            {bankImport && savedDocumentIds.length > 0 && (
              <div className="row">
                <span>
                  {savedDocumentIds.length} anexo(s) preservado(s) no rascunho.
                </span>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSavedDocumentIds([]);
                    change({ documentIds: files.map((d) => d.id) });
                  }}
                >
                  Remover anexos salvos
                </Button>
              </div>
            )}
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
          mode === "ATTENDANCE" || bankImport
            ? "finance-attendance-summary finance-entry-summary stack"
            : "finance-entry-summary stack"
        }
      >
        <section
          className="finance-entry-review stack"
          aria-label={
            mode === "ATTENDANCE"
              ? "Conferência do atendimento"
              : "Conferência do lançamento"
          }
        >
          <h3>Conferir antes de confirmar</h3>
          <dl>
            <div>
              <dt>{direction === "EXPENSE" ? "Favorecido" : "Pessoa"}</dt>
              <dd>
                {direction === "EXPENSE"
                  ? state.beneficiaryName || "Não informado"
                  : state.personLabel ||
                    (state.contributor?.kind === "COLLECTIVE"
                      ? "Contribuição coletiva"
                      : "Não identificada")}
              </dd>
            </div>
            <div>
              <dt>Data</dt>
              <dd>{state.date.split("-").reverse().join("/")}</dd>
            </div>
            <div>
              <dt>Caixa ou conta</dt>
              <dd>{box?.name || "Não selecionado"}</dd>
            </div>
            <div>
              <dt>Forma de pagamento</dt>
              <dd>
                {catalogs.paymentMethods.find(
                  (method) => method.id === state.paymentMethodId,
                )?.name || "Não selecionada"}
              </dd>
            </div>
          </dl>
          <div className="finance-entry-review-items">
            <span className="muted">
              {lines.length}{" "}
              {direction === "EXPENSE"
                ? lines.length === 1
                  ? "item"
                  : "itens"
                : lines.length === 1
                  ? "contribuição"
                  : "contribuições"}
            </span>
            {lines.map((line, index) => (
              <div key={index} className="row spread">
                <span className="finance-entry-review-item-label">
                  <span>
                    {catalogs.categories.find(
                      (category) => category.id === line.categoryId,
                    )?.name || `Item ${index + 1} sem categoria`}
                  </span>
                  {line.departmentId && (
                    <small className="muted">
                      {
                        catalogs.departments.find(
                          (department) => department.id === line.departmentId,
                        )?.name
                      }
                    </small>
                  )}
                  {line.titheClassificationId && (
                    <small className="muted">
                      Dízimo:{" "}
                      {
                        catalogs.classifications.find(
                          (classification) =>
                            classification.id === line.titheClassificationId,
                        )?.name
                      }
                    </small>
                  )}
                </span>
                {mode === "ATTENDANCE" && (
                  <strong>
                    {line.amount ? `R$ ${line.amount}` : "Sem valor"}
                  </strong>
                )}
              </div>
            ))}
          </div>
          <div className="finance-entry-review-total row spread">
            <span>
              {mode === "ATTENDANCE" && !bankImport
                ? "Total do atendimento"
                : "Total do lançamento"}
            </span>
            <strong
              data-testid={
                mode === "ATTENDANCE" ? "attendance-total" : undefined
              }
            >
              {formatMoney(total)}
            </strong>
          </div>
        </section>
        <div className="finance-entry-actions">
          <div className="finance-entry-primary-action">
            <span className="finance-entry-primary-total">
              Total <strong>{formatMoney(total)}</strong>
            </span>
            <Button
              type="submit"
              variant={direction === "EXPENSE" ? "danger" : "primary"}
              className={
                mode === "ATTENDANCE" || bankImport
                  ? "finance-attendance-action"
                  : undefined
              }
              aria-busy={busy}
              disabled={busy || uploading}
            >
              <span className="finance-action-icon">
                {busy ? (
                  <span className="finance-spinner" aria-hidden="true" />
                ) : (
                  <Save size={16} aria-hidden="true" />
                )}
              </span>
              <span className="finance-action-label">
                <span className="finance-desktop-only">
                  {bankImport
                    ? "Finalizar"
                    : initialTransaction
                      ? "Salvar correção"
                      : mode === "ATTENDANCE"
                        ? "Confirmar atendimento"
                        : "Salvar"}
                </span>
                <span className="finance-mobile-only">Salvar</span>
              </span>
            </Button>
          </div>
          {bankImport && (
            <div className="finance-entry-secondary-actions">
              <Button
                variant="outline"
                disabled={busy || uploading}
                onClick={() => void save("CONTINUE")}
                className="finance-attendance-action"
              >
                <span className="finance-action-icon">
                  <ArrowRight size={16} />
                </span>
                <span className="finance-action-label">
                  Finalizar e próximo
                </span>
              </Button>
              <Button
                variant="outline"
                disabled={busy || uploading || ambiguous}
                onClick={() => void saveDraft()}
                className="finance-attendance-action"
              >
                <span className="finance-action-icon">
                  <Save size={16} />
                </span>
                <span className="finance-action-label">Salvar rascunho</span>
              </Button>
            </div>
          )}
          {!initialTransaction && !bankImport && (
            <div className="finance-entry-secondary-actions">
              <Button
                variant="outline"
                disabled={busy || uploading}
                className={
                  mode === "ATTENDANCE"
                    ? "finance-attendance-action"
                    : undefined
                }
                onClick={() => void save("CONTINUE")}
              >
                <span className="finance-action-icon">
                  <ArrowRight size={16} aria-hidden="true" />
                </span>
                <span className="finance-action-label">Salvar e continuar</span>
              </Button>
              <Button
                variant="outline"
                disabled={busy || uploading}
                className={
                  mode === "ATTENDANCE"
                    ? "finance-attendance-action"
                    : undefined
                }
                onClick={() => void save("PRINT")}
              >
                <span className="finance-action-icon">
                  <Printer size={16} aria-hidden="true" />
                </span>
                <span className="finance-action-label">Salvar e imprimir</span>
              </Button>
            </div>
          )}
        </div>
      </aside>
    </form>
  );
}
