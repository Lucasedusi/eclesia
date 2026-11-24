"use client";

import { useState, useTransition } from "react";
import { BookOpen, Check, FileUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFinanceNavigation } from "../components/finance-shell";
import {
  applyAccountingPlan,
  loadAccountingPlan,
  previewPlanFile,
} from "./actions";
import {
  categoryCode,
  postingAccounts,
  readMappingCells,
  reviewAccounts,
  reviewLinks,
  suggestLinks,
  type Account,
  type DraftLink,
  type EntryLink,
  type PlanState,
} from "./plan";
import { AccountsTable } from "./accounts-table";
import { normalizeCategoryName } from "../utils/finance-category-name";
import styles from "./workspace.module.css";

const movement = (direction: EntryLink["direction"]) =>
  direction === "INCOME" ? "Entrada" : "Saída";
const emptyRow: DraftLink = {
  name: "",
  direction: "INCOME",
  code: "",
  create: false,
  selected: true,
};
type EditableRow = DraftLink & { key: string };
type Review = { accounts: Account[]; links: EntryLink[] };
const withKey = (row: DraftLink): EditableRow => ({
  ...row,
  key: crypto.randomUUID(),
});

function PlanEditor({
  initial,
  close,
}: {
  initial: PlanState;
  close: () => void;
}) {
  const [state, setState] = useState(initial);
  const [imported, setImported] = useState<Account[]>([]);
  const [drafts, setDrafts] = useState<EditableRow[]>([]);
  const [paste, setPaste] = useState("");
  const [review, setReview] = useState<Review | null>(null);
  const [message, setMessage] = useState("");
  const [busy, start] = useTransition();
  const [conflict, setConflict] = useState(false);
  const [page, setPage] = useState(0);
  const { refresh } = useFinanceNavigation();
  const selectedCount = drafts.filter((row) => row.selected).length;
  const names = new Set(
    state.categories.map((c) => normalizeCategoryName(c.name)),
  );
  const isNew = (row: DraftLink) =>
    !!row.name.trim() && !names.has(normalizeCategoryName(row.name));
  const newSelected = drafts.filter(
    (row) => row.selected && isNew(row) && !row.create,
  ).length;
  const oldAccounts = new Map(state.accounts.map((a) => [a.code, a]));
  const merged = new Map(oldAccounts);
  imported.forEach((a) => merged.set(a.code, a));
  const accounts = [...merged.values()];
  const posting = postingAccounts(accounts);
  const changed = reviewAccounts(state.accounts, imported);
  const index = Math.min(page, Math.max(0, Math.ceil(drafts.length / 20) - 1));
  function add(rows: DraftLink[]) {
    setDrafts((old) => [...old, ...rows.map(withKey)]);
    setPage(Math.floor(drafts.length / 20));
  }
  function edit(key: string, patch: Partial<DraftLink>) {
    setDrafts((old) =>
      old.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  }
  function runReview() {
    try {
      const links = reviewLinks(drafts, state.categories, accounts);
      if (!links.length && !changed.length) {
        setMessage("Nenhuma alteração para aplicar.");
        return;
      }
      setReview({ accounts: changed, links });
      setMessage("");
    } catch (error) {
      setMessage((error as Error).message);
    }
  }
  return (
    <div className="stack">
      {message && (
        <p role="status" className={styles.notice}>
          {message}
        </p>
      )}
      {conflict && (
        <Button
          variant="secondary"
          onClick={() =>
            start(async () => {
              const result = await loadAccountingPlan();
              if (result.ok) {
                setState(result.data);
                setReview(null);
                setConflict(false);
                setMessage(
                  "Dados atualizados. Revise as alterações novamente.",
                );
              } else setMessage(result.message);
            })
          }
        >
          Atualizar para revisar
        </Button>
      )}
      {review ? (
        <>
          <h3>Revisar alterações</h3>
          <p>
            {review.accounts.length} contas a importar ou atualizar ·{" "}
            {review.links.length} vínculos a alterar
          </p>
          {!!review.accounts.length && (
            <AccountsTable
              rows={review.accounts}
              current={state.accounts}
              review
            />
          )}
          {!!review.links.length && (
            <div className={styles.scroll}>
              <table>
                <thead>
                  <tr>
                    <th>Categoria</th>
                    <th>Movimento</th>
                    <th>Atual</th>
                    <th>Após confirmar</th>
                  </tr>
                </thead>
                <tbody>
                  {review.links.map((row) => {
                    const old = state.categories.find(
                      (c) => c.id === row.category,
                    );
                    const account = row.code && merged.get(row.code);
                    return (
                      <tr key={row.name + row.direction}>
                        <td>
                          {row.name}
                          {!old && <small> · Nova categoria</small>}
                        </td>
                        <td>{movement(row.direction)}</td>
                        <td>
                          {(old && categoryCode(old, row.direction)) ||
                            "Sem vínculo"}
                        </td>
                        <td>
                          {account
                            ? account.code + " · " + account.name
                            : "Remover vínculo"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="row">
            <Button
              disabled={busy}
              variant="secondary"
              onClick={() => setReview(null)}
            >
              Voltar à edição
            </Button>
            <Button
              disabled={busy || conflict}
              loading={busy}
              onClick={() =>
                start(async () => {
                  const result = await applyAccountingPlan({
                    ...review,
                    revision: state.revision,
                  });
                  if (!result.ok) {
                    setMessage(result.message);
                    setConflict(result.code === "CONFLICT");
                    return;
                  }
                  setState(result.data);
                  setImported([]);
                  setDrafts([]);
                  setReview(null);
                  setMessage("Alterações contábeis aplicadas.");
                  refresh();
                })
              }
            >
              <Check size={16} />
              Confirmar alterações
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className={styles.section}>
            <h3>Plano de contas</h3>
            <label>
              Importar plano em PDF
              <input
                type="file"
                accept="application/pdf,.pdf"
                disabled={busy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  setImported([]);
                  setMessage("");
                  if (file.size > 5 * 1024 * 1024) {
                    setMessage("O PDF deve ter até 5 MB.");
                    return;
                  }
                  const form = new FormData();
                  form.set("file", file);
                  start(async () => {
                    const result = await previewPlanFile(form);
                    if (result.ok) {
                      setImported(result.data);
                      setMessage(
                        `PDF lido. ${result.data.length} contas para conferência.`,
                      );
                    } else setMessage(result.message);
                  });
                }}
              />
            </label>
            {!!imported.length && (
              <p>
                {changed.length} contas novas ou alteradas ·{" "}
                {imported.length - changed.length} já cadastradas
              </p>
            )}
            {!!accounts.length && (
              <details>
                <summary>Consultar plano ({accounts.length} contas)</summary>
                <AccountsTable rows={accounts} current={state.accounts} />
              </details>
            )}
          </div>
          <div className={styles.section}>
            <h3>Vínculos das categorias</h3>
            <details>
              <summary>
                Consultar vínculos atuais ({state.categories.length} categorias)
              </summary>
              <div className={styles.scroll}>
                <table>
                  <thead>
                    <tr>
                      <th>Categoria</th>
                      <th>Entrada</th>
                      <th>Saída</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.categories.map((c) => (
                      <tr key={c.id}>
                        <td>
                          {c.name}
                          {c.legacy && (
                            <small>
                              {" "}
                              · Código anterior para conferência: {c.legacy}
                            </small>
                          )}
                        </td>
                        <td>
                          {c.direction === "EXPENSE"
                            ? "—"
                            : c.income || "Pendente"}
                        </td>
                        <td>
                          {c.direction === "INCOME"
                            ? "—"
                            : c.expense || "Pendente"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
            <details>
              <summary>Colar vínculos de uma planilha</summary>
              <label>
                Cole as colunas Categoria, Movimento e Chamada ou a aba
                Categorias com o cabeçalho.
                <textarea
                  rows={4}
                  value={paste}
                  onChange={(e) => setPaste(e.target.value)}
                />
              </label>
              <Button
                variant="secondary"
                disabled={!paste.trim() || busy}
                onClick={() => {
                  try {
                    const rows = readMappingCells(paste);
                    add(rows);
                    setMessage(
                      `${rows.length} linhas lidas. Marque as que deseja aplicar.`,
                    );
                    setPaste("");
                  } catch (error) {
                    setMessage((error as Error).message);
                  }
                }}
              >
                Carregar linhas
              </Button>
            </details>
            <div className="row">
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => add([emptyRow])}
              >
                <Plus size={16} />
                Adicionar vínculo
              </Button>
              <Button
                variant="secondary"
                disabled={!accounts.length || busy}
                onClick={() => {
                  const rows = suggestLinks(state.categories, accounts).filter(
                    (s) =>
                      !drafts.some(
                        (d) => d.name === s.name && d.direction === s.direction,
                      ),
                  );
                  add(rows);
                  setMessage(
                    rows.length
                      ? `${rows.length} sugestões para revisão.`
                      : "Nenhuma nova correspondência inequívoca.",
                  );
                }}
              >
                Sugerir vínculos
              </Button>
            </div>
            <datalist id="financial-plan-categories">
              {state.categories.map((c) => (
                <option key={c.id} value={c.name} />
              ))}
            </datalist>
            <datalist id="financial-plan-accounts">
              {posting.map((a) => (
                <option key={a.code} value={a.code}>
                  {a.name} · {a.classification}
                </option>
              ))}
            </datalist>
            {!!drafts.length && (
              <>
                <div className="row">
                  <span>
                    {selectedCount} de {drafts.length} linhas marcadas
                  </span>
                  <Button
                    variant="secondary"
                    onClick={() =>
                      setDrafts(
                        drafts.map((d) => ({
                          ...d,
                          selected: selectedCount !== drafts.length,
                        })),
                      )
                    }
                  >
                    {selectedCount === drafts.length
                      ? "Desmarcar todas"
                      : "Marcar todas"}
                  </Button>
                </div>
                {newSelected > 0 && (
                  <div>
                    <Button
                      variant="secondary"
                      onClick={() =>
                        setDrafts(
                          drafts.map((row) =>
                            row.selected && isNew(row)
                              ? { ...row, create: true }
                              : row,
                          ),
                        )
                      }
                    >
                      Marcar criação de categorias nas {newSelected} linhas
                      novas selecionadas
                    </Button>
                  </div>
                )}
                {drafts.slice(index * 20, index * 20 + 20).map((row, i) => (
                  <div className={styles.edit} key={row.key}>
                    <label className={styles.check}>
                      <input
                        type="checkbox"
                        checked={row.selected}
                        onChange={(e) =>
                          edit(row.key, { selected: e.target.checked })
                        }
                      />
                      Incluir linha {index * 20 + i + 1}
                    </label>
                    <label>
                      Categoria
                      <input
                        list="financial-plan-categories"
                        value={row.name}
                        onChange={(e) =>
                          edit(row.key, { name: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Movimento
                      <select
                        value={row.direction}
                        onChange={(e) =>
                          edit(row.key, {
                            direction: e.target.value as EntryLink["direction"],
                          })
                        }
                      >
                        <option value="INCOME">Entrada</option>
                        <option value="EXPENSE">Saída</option>
                      </select>
                    </label>
                    <label>
                      Chamada
                      <input
                        list="financial-plan-accounts"
                        value={row.code}
                        onChange={(e) =>
                          edit(row.key, { code: e.target.value })
                        }
                        placeholder="Código da conta"
                      />
                      <small>{merged.get(row.code)?.name}</small>
                    </label>
                    <Button
                      variant="secondary"
                      aria-label={`Excluir linha ${index * 20 + i + 1}`}
                      onClick={() =>
                        setDrafts(drafts.filter((d) => d.key !== row.key))
                      }
                    >
                      <Trash2 size={16} />
                    </Button>
                    {isNew(row) && (
                      <label className={styles.check}>
                        <input
                          type="checkbox"
                          checked={row.create}
                          onChange={(e) =>
                            edit(row.key, { create: e.target.checked })
                          }
                        />
                        Criar esta categoria se ainda não existir
                      </label>
                    )}
                  </div>
                ))}
                {drafts.length > 20 && (
                  <div className="row">
                    <Button
                      variant="secondary"
                      disabled={!index}
                      onClick={() => setPage(index - 1)}
                    >
                      Linhas anteriores
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={(index + 1) * 20 >= drafts.length}
                      onClick={() => setPage(index + 1)}
                    >
                      Próximas linhas
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
          <div className="row">
            <Button
              disabled={
                busy || (!changed.length && !drafts.some((d) => d.selected))
              }
              loading={busy}
              onClick={runReview}
            >
              <FileUp size={16} />
              Revisar alterações
            </Button>
            <Button variant="secondary" disabled={busy} onClick={close}>
              {changed.length || drafts.length ? "Descartar edição" : "Fechar"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
export function AccountingPlanWorkspace() {
  const [state, setState] = useState<PlanState | null>(null);
  const [busy, start] = useTransition();
  const [error, setError] = useState("");
  return (
    <section className="card stack">
      <h2>Plano de contas e vínculos</h2>
      {state ? (
        <PlanEditor initial={state} close={() => setState(null)} />
      ) : (
        <div>
          <Button
            variant="secondary"
            loading={busy}
            onClick={() =>
              start(async () => {
                const result = await loadAccountingPlan();
                setError(result.ok ? "" : result.message);
                if (result.ok) setState(result.data);
              })
            }
          >
            <BookOpen size={16} />
            Gerenciar plano de contas
          </Button>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
