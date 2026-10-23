"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { FinanceEntryForm } from "../components/finance-entry-form";
import {
  useFinanceDirtyGuard,
  useFinanceNavigation,
} from "../components/finance-shell";
import { newEntryState } from "../utils/finance-entry-session";
import { centsToDecimal, formatMoney } from "../utils/finance-money";
import { financeLocation } from "../utils/finance-navigation";
import type { FinanceCapabilities } from "../types/finance.types";
import type { FinanceCatalogs } from "../types/finance-catalog.types";
import { bankImportDraftSchema, type BankImportMutation } from "./schemas";
import type {
  BankImportBatch,
  BankImportCandidate,
  BankImportItem,
} from "./types";
import {
  getBankImportCandidatesAction,
  mutateBankImportAction,
} from "./actions";

export const bankImportStatus = {
  PENDING: "Pendente",
  POSTED: "Lançado",
  LINKED: "Vinculado",
  IGNORED: "Ignorado",
  DUPLICATE: "Mesmo movimento",
};
const events: Record<string, string> = {
  SAVE_DRAFT: "Rascunho salvo",
  POST: "Lançamento confirmado",
  LINK: "Registro vinculado",
  DUPLICATE: "Mesma movimentação reconhecida",
  IGNORE: "Item ignorado",
  RESTORE: "Pendência restaurada",
  REOPEN: "Conferência reaberta",
  UNLINK: "Vínculo desfeito",
};
export function BankImportReview({
  unit,
  month,
  batch,
  item,
  catalogs,
  capabilities,
  onResult,
  onClose,
}: {
  unit: string;
  month: string;
  batch: BankImportBatch;
  item: BankImportItem;
  catalogs: FinanceCatalogs;
  capabilities: FinanceCapabilities;
  onResult: (item: BankImportItem, next: boolean) => void;
  onClose: () => void;
}) {
  const navigation = useFinanceNavigation(),
    pending = useRef<{ input: BankImportMutation; next: boolean } | null>(null);
  const [busy, setBusy] = useState(false),
    [uncertain, setUncertain] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const [formStatus, setFormStatus] = useState({ dirty: false, busy: false });
  const [reason, setReason] = useState(""),
    [duplicateReason, setDuplicateReason] = useState(""),
    [reconciliationReason, setReconciliationReason] = useState("");
  const [candidates, setCandidates] = useState<BankImportCandidate[]>([]),
    [loading, setLoading] = useState(true),
    [candidateError, setCandidateError] = useState("");
  const [otherBox, setOtherBox] = useState(""),
    [transferDescription, setTransferDescription] = useState("");
  const [reviewKind, setReviewKind] = useState<"ENTRY" | "TRANSFER">("ENTRY");
  const [candidateVersion, setCandidateVersion] = useState(0);
  useEffect(() => {
    let active = true;
    getBankImportCandidatesAction(unit, item.id)
      .then((result) => {
        if (!active) return;
        setLoading(false);
        if (result.ok) {
          setCandidates(result.data);
          setCandidateError("");
        } else setCandidateError(result.message);
      })
      .catch(() => {
        if (active) {
          setLoading(false);
          setCandidateError(
            "Não foi possível consultar os registros existentes.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, [unit, item.id, item.revision, candidateVersion]);
  const strong = candidates.some((c) => c.strong),
    isPending = item.status === "PENDING",
    locked = busy || uncertain;
  const decisions = {
    ...(duplicateReason.trim() ? { duplicateReason } : {}),
    ...(reconciliationReason.trim() ? { reconciliationReason } : {}),
  };
  function envelope(action: BankImportMutation["action"], payload: unknown) {
    return {
      unit,
      itemId: item.id,
      revision: item.revision,
      operationKey: crypto.randomUUID(),
      action,
      payload,
    } as BankImportMutation;
  }
  async function apply(input: BankImportMutation, next = false) {
    if (busy)
      return {
        ok: false as const,
        code: "UNAVAILABLE" as const,
        message: "Aguarde a confirmação em andamento.",
      };
    pending.current ??= { input, next };
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await mutateBankImportAction(pending.current.input);
      if (!result.ok) {
        setError(result.message);
        if (result.code === "UNAVAILABLE") setUncertain(true);
        else {
          pending.current = null;
          setUncertain(false);
        }
        return result;
      }
      const advance = pending.current.next,
        action = pending.current.input.action;
      pending.current = null;
      setUncertain(false);
      setFormStatus({ dirty: false, busy: false });
      setMessage(
        action === "SAVE_DRAFT" ? "Rascunho salvo." : "Conferência atualizada.",
      );
      onResult(result.data, advance);
      navigation.refresh();
      return result;
    } catch {
      setUncertain(true);
      const message =
        "A resposta não chegou. Repita a mesma tentativa para conferir o resultado sem duplicar o lançamento.";
      setError(message);
      return { ok: false as const, code: "UNAVAILABLE" as const, message };
    } finally {
      setBusy(false);
    }
  }
  useFinanceDirtyGuard(
    uncertain,
    async () =>
      pending.current ? (await apply(pending.current.input)).ok : false,
    () => !uncertain,
  );
  function close() {
    if (locked || formStatus.busy) return;
    if (
      formStatus.dirty &&
      !window.confirm("Descartar as alterações ainda não salvas deste item?")
    )
      return;
    onClose();
  }
  function decide(action: "IGNORE" | "RESTORE" | "UNLINK" | "REOPEN") {
    if (
      formStatus.dirty &&
      !window.confirm(
        "Continuar com esta decisão e descartar as alterações ainda não salvas?",
      )
    )
      return;
    void apply(envelope(action, { reason }));
  }
  const handleStatus = useCallback(
    (value: { dirty: boolean; busy: boolean }) => setFormStatus(value),
    [],
  );
  const parsedDraft = bankImportDraftSchema.safeParse(item.draft),
    seed = newEntryState(item.date ?? "");
  const account = catalogs.cashboxes.find((b) => b.id === batch.cashboxId);
  const pix = catalogs.paymentMethods.filter(
    (m) =>
      m.status === "ACTIVE" &&
      m.kind === "PIX" &&
      account?.paymentMethodIds.includes(m.id),
  );
  const draft = parsedDraft.success
    ? parsedDraft.data
    : {
        state: {
          ...seed,
          cashboxId: batch.cashboxId,
          amount: centsToDecimal(Math.abs(item.amountCents ?? 0)).replace(
            ".",
            ",",
          ),
          paymentMethodId:
            /\bPIX\b/i.test(item.history) && pix.length === 1 ? pix[0].id : "",
        },
        extra: [],
      };
  draft.state = {
    ...draft.state,
    cashboxId: batch.cashboxId,
    date: item.date ?? "",
    ...(item.amountCents !== null && item.amountCents < 0
      ? { amount: centsToDecimal(Math.abs(item.amountCents)).replace(".", ",") }
      : {}),
  };
  const money = formatMoney(Math.abs(item.amountCents ?? 0));
  return (
    <section
      className="bank-import-card stack"
      aria-label="Conferência do extrato"
    >
      <header className="row spread">
        <div>
          <h2>Conferir linha {item.rowNumber}</h2>
          <p className="muted">
            {item.amountCents === null
              ? "Valor a conferir"
              : `${item.amountCents > 0 ? "Entrada" : "Saída"} · ${money}`}{" "}
            · {bankImportStatus[item.status]}
          </p>
        </div>
        <div className="row">
          <Button
            variant="outline"
            disabled={locked || formStatus.busy}
            onClick={close}
          >
            Voltar à fila
          </Button>
          <Button
            variant="outline"
            disabled={locked || formStatus.busy}
            onClick={() => {
              close();
              navigation.refresh();
            }}
          >
            Recarregar
          </Button>
        </div>
      </header>
      {error && <div role="alert">{error}</div>}
      {message && <div role="status">{message}</div>}
      {uncertain && (
        <div className="bank-import-warning stack">
          <p>A tentativa está preservada até a confirmação.</p>
          <Button
            disabled={busy}
            onClick={() => pending.current && void apply(pending.current.input)}
          >
            Conferir a mesma tentativa
          </Button>
        </div>
      )}
      <dl className="bank-import-source">
        <div>
          <dt>Data do extrato</dt>
          <dd>
            {item.date?.split("-").reverse().join("/") ?? item.sourceDate}
          </dd>
        </div>
        <div>
          <dt>Conta bancária</dt>
          <dd>{batch.cashboxName}</dd>
        </div>
        <div>
          <dt>Documento</dt>
          <dd>{item.document || "Não informado"}</dd>
        </div>
        <div>
          <dt>Histórico bancário</dt>
          <dd>{item.history}</dd>
        </div>
        <div className="bank-import-source-wide">
          <dt>Informações complementares</dt>
          <dd>{item.complement || "Não informadas"}</dd>
        </div>
      </dl>
      {item.issue && (
        <div role="alert">
          {item.issue} Confira esta linha no arquivo original. Ela pode ser
          ignorada com justificativa.
        </div>
      )}
      {item.changed && (
        <div className="bank-import-warning">
          O registro financeiro foi alterado depois desta conferência.
          {item.stale
            ? " Os dados atuais já não correspondem ao extrato."
            : " Data, conta, direção e total ainda correspondem ao extrato."}
        </div>
      )}
      {item.stale && !item.changed && (
        <div className="bank-import-warning">
          O vínculo precisa ser conferido novamente. Nenhum lançamento foi
          recriado automaticamente.
        </div>
      )}
      {item.result && (
        <div className="notice">
          <span>Este item possui uma referência financeira registrada.</span>
          {item.result.receiptId && (
            <Link
              className="finance-secondary-link"
              target="_blank"
              rel="noopener"
              href={financeLocation(
                `/financeiro/comprovantes/${item.result.receiptId}`,
                unit,
                month,
              )}
            >
              Abrir comprovante
            </Link>
          )}
          <Link
            className="finance-secondary-link"
            target="_blank"
            rel="noopener"
            href={financeLocation(
              "/financeiro/lancamentos",
              unit,
              item.date?.slice(0, 7) ?? month,
            )}
          >
            Consultar lançamentos
          </Link>
        </div>
      )}
      {isPending && !item.issue && (
        <>
          <section className="stack">
            <h3>Conferir registros existentes</h3>
            <p className="muted">
              Compare os registros antes de criar um novo lançamento. Um vínculo
              usa o registro já existente e mantém o saldo.
            </p>
            {loading && (
              <p role="status">Consultando movimentos compatíveis…</p>
            )}
            {candidateError && (
              <div role="alert">
                {candidateError}
                <Button
                  variant="outline"
                  onClick={() => {
                    setLoading(true);
                    setCandidateVersion((v) => v + 1);
                  }}
                >
                  Tentar consulta novamente
                </Button>
              </div>
            )}
            {!loading && !candidateError && candidates.length === 0 && (
              <p className="muted">Nenhum registro compatível encontrado.</p>
            )}
            {candidates.map((c) => (
              <div className="bank-import-choice" key={`${c.kind}-${c.id}`}>
                <div>
                  <strong>{c.label}</strong>
                  <p className="muted">
                    {c.date?.split("-").reverse().join("/")} ·{" "}
                    {formatMoney(Math.abs(c.amountCents))} ·{" "}
                    {c.strong
                      ? "Origem idêntica em outro arquivo"
                      : c.kind === "ITEM"
                        ? "Outra linha importada"
                        : "Registro financeiro existente"}
                    {!c.compatible ? " · Indisponível para vínculo" : ""}
                  </p>
                </div>
                <Button
                  variant="outline"
                  disabled={!c.compatible || locked || formStatus.busy}
                  onClick={() => {
                    if (
                      formStatus.dirty &&
                      !window.confirm(
                        "Vincular este registro e descartar as alterações de classificação ainda não salvas?",
                      )
                    )
                      return;
                    if (
                      !window.confirm(
                        "Confirma que este registro corresponde ao movimento do extrato?",
                      )
                    )
                      return;
                    void apply(
                      c.kind === "ITEM"
                        ? envelope("DUPLICATE", {
                            targetId: c.id,
                            reason:
                              "Mesmo movimento reconhecido na conferência",
                          })
                        : envelope("LINK", {
                            targetKind: c.kind,
                            targetId: c.id,
                            ...decisions,
                          }),
                    );
                  }}
                >
                  {c.kind === "ITEM"
                    ? "É o mesmo movimento"
                    : "Vincular este registro"}
                </Button>
              </div>
            ))}
            {strong && (
              <label className="bank-import-warning">
                Motivo para tratar como movimento distinto
                <textarea
                  value={duplicateReason}
                  maxLength={1000}
                  disabled={locked || formStatus.busy}
                  onChange={(e) => setDuplicateReason(e.target.value)}
                  placeholder="Preencha somente se for criar ou vincular outro movimento."
                />
              </label>
            )}
            {batch.reconciliation === "MISMATCH" &&
              !batch.reconciliationReason && (
                <label className="bank-import-warning">
                  Motivo para prosseguir com a divergência de saldos
                  <textarea
                    value={reconciliationReason}
                    maxLength={1000}
                    disabled={locked || formStatus.busy}
                    onChange={(e) => setReconciliationReason(e.target.value)}
                  />
                </label>
              )}
          </section>
          <div className="tabs" aria-label="Tipo de registro">
            <button
              type="button"
              disabled={locked || formStatus.busy}
              aria-pressed={reviewKind === "ENTRY"}
              onClick={() => {
                if (
                  !formStatus.dirty ||
                  window.confirm("Descartar a classificação ainda não salva?")
                ) {
                  setFormStatus({ dirty: false, busy: false });
                  setReviewKind("ENTRY");
                }
              }}
            >
              Lançamento
            </button>
            {capabilities.transfer && (
              <button
                type="button"
                disabled={locked || formStatus.busy}
                aria-pressed={reviewKind === "TRANSFER"}
                onClick={() => {
                  if (
                    !formStatus.dirty ||
                    window.confirm("Descartar a classificação ainda não salva?")
                  ) {
                    setFormStatus({ dirty: false, busy: false });
                    setReviewKind("TRANSFER");
                  }
                }}
              >
                Transferência interna
              </button>
            )}
          </div>
          {reviewKind === "ENTRY" ? (
            <fieldset
              disabled={locked}
              style={{ border: 0, padding: 0, minWidth: 0 }}
            >
              <FinanceEntryForm
                unit={unit}
                month={month}
                date={item.date!}
                catalogs={catalogs}
                capabilities={capabilities}
                direction={item.amountCents! > 0 ? "INCOME" : "EXPENSE"}
                mode={item.amountCents! > 0 ? "ATTENDANCE" : "SINGLE"}
                onStatusChange={handleStatus}
                bankImport={{
                  draft,
                  amountCents: Math.abs(item.amountCents!),
                  saveDraft: async (value) =>
                    (await apply(envelope("SAVE_DRAFT", value))).ok,
                  submit: async (command, next) => {
                    const response = await apply(
                      {
                        ...envelope("POST", { command, ...decisions }),
                        operationKey: command.operationKey,
                      } as BankImportMutation,
                      next,
                    );
                    if (!response.ok) return response;
                    const r = response.data.result!;
                    return {
                      ok: true,
                      data: {
                        operationId: r.operationId!,
                        transactionIds: r.transactionIds ?? [],
                        attendanceId: r.attendanceId ?? null,
                        transferId: r.transferId ?? null,
                        receiptId: r.receiptId ?? null,
                        revision: response.data.revision,
                        replayed: false,
                      },
                    };
                  },
                }}
              />
            </fieldset>
          ) : (
            <form
              className="stack"
              onSubmit={(e) => {
                e.preventDefault();
                void apply(
                  envelope("POST", {
                    ...decisions,
                    command: {
                      kind: "TRANSFER",
                      operationKey: crypto.randomUUID(),
                      congregationId: unit,
                      date: item.date,
                      amountCents: Math.abs(item.amountCents!),
                      sourceCashboxId:
                        item.amountCents! < 0 ? batch.cashboxId : otherBox,
                      targetCashboxId:
                        item.amountCents! > 0 ? batch.cashboxId : otherBox,
                      description: transferDescription,
                    },
                  }),
                );
              }}
            >
              <p className="notice">
                Transferência de {money} entre caixas desta congregação. A conta
                do extrato será{" "}
                {item.amountCents! < 0 ? "a origem" : "o destino"}. Pagamentos a
                terceiros devem ser classificados como saídas.
              </p>
              <label>
                Outra conta ou caixa
                <select
                  value={otherBox}
                  required
                  disabled={locked}
                  onChange={(e) => setOtherBox(e.target.value)}
                >
                  <option value="">Selecione</option>
                  {catalogs.cashboxes
                    .filter(
                      (b) => b.status === "ACTIVE" && b.id !== batch.cashboxId,
                    )
                    .map((b) => (
                      <option value={b.id} key={b.id}>
                        {b.name}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Descrição da transferência
                <input
                  maxLength={1000}
                  value={transferDescription}
                  disabled={locked}
                  onChange={(e) => setTransferDescription(e.target.value)}
                />
              </label>
              <Button type="submit" disabled={locked}>
                Confirmar transferência
              </Button>
            </form>
          )}
        </>
      )}
      {(isPending ||
        item.status === "IGNORED" ||
        item.status === "LINKED" ||
        item.status === "DUPLICATE" ||
        (item.status === "POSTED" && item.cancelled)) && (
        <section className="stack">
          <h3>Decisão sobre o item</h3>
          <label>
            Motivo da decisão
            <textarea
              value={reason}
              minLength={5}
              maxLength={1000}
              disabled={locked || formStatus.busy}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <div className="row">
            {isPending && (
              <Button
                variant="outline"
                disabled={locked || formStatus.busy || reason.trim().length < 5}
                onClick={() => decide("IGNORE")}
              >
                Ignorar item
              </Button>
            )}
            {item.status === "IGNORED" && (
              <Button
                disabled={locked || reason.trim().length < 5}
                onClick={() => decide("RESTORE")}
              >
                Restaurar pendência
              </Button>
            )}
            {(item.status === "LINKED" || item.status === "DUPLICATE") && (
              <Button
                disabled={locked || reason.trim().length < 5}
                onClick={() => decide("UNLINK")}
              >
                Desfazer vínculo
              </Button>
            )}
            {item.status === "POSTED" && item.cancelled && (
              <Button
                disabled={locked || reason.trim().length < 5}
                onClick={() => decide("REOPEN")}
              >
                Reabrir conferência
              </Button>
            )}
          </div>
        </section>
      )}
      {item.historyEvents.length > 0 && (
        <details>
          <summary>Histórico de decisões ({item.historyEvents.length})</summary>
          <ol className="bank-import-history">
            {item.historyEvents.map((e, index) => (
              <li key={index}>
                <strong>{events[e.action] ?? e.action}</strong> · {e.actor} ·{" "}
                {new Date(e.at).toLocaleString("pt-BR", {
                  timeZone: "America/Sao_Paulo",
                })}
                {e.reason && <p>{e.reason}</p>}
              </li>
            ))}
          </ol>
        </details>
      )}
    </section>
  );
}
