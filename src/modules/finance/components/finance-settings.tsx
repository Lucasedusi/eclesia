"use client";
import { FinanceEmpty } from "./finance-empty";
import { FinanceSkeleton } from "./finance-skeleton";
import { useFinanceNavigation } from "./finance-shell";
import { formatFinanceMonth } from "../utils/finance-period";
import { useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  FinanceCatalogs,
  CatalogItem,
} from "../types/finance-catalog.types";
import type { FinanceUnit } from "../types/finance.types";
import type { StatementRuleSet } from "../types/finance-statement.types";
import {
  FinanceCatalogForm,
  type CatalogEntity,
  methodLabels,
} from "./finance-catalog-form";
import { FinanceRuleEditor } from "./finance-rule-editor";
export function FinanceSettings({
  latestStatementMonth,
  currentMonth,
  catalogs,
  unit,
  month,
  roles,
  rules,
  units,
}: {
  latestStatementMonth: string | null;
  currentMonth: string;
  catalogs: FinanceCatalogs;
  unit: string;
  month: string;
  roles: { id: string; name: string }[];
  rules: StatementRuleSet[];
  units: FinanceUnit[];
}) {
  const { isPending } = useFinanceNavigation();
  const [rulesDirty, setRulesDirty] = useState(false);
  const [tab, setTab] = useState<CatalogEntity | "RULES">(
      "DEPARTMENT",
    ),
    [editing, setEditing] = useState<{
      entity: CatalogEntity;
      id?: string;
    } | null>(null);
  const tabs = [
    { id: "DEPARTMENT", label: "Departamentos" },
    { id: "CATEGORY", label: "Categorias" },
    { id: "CLASSIFICATION", label: "Classificações" },
    { id: "PAYMENT_METHOD", label: "Formas de pagamento" },
    { id: "RULES", label: "Regras do demonstrativo" },
  ] as const;
  const rows: CatalogItem[] =
    tab === "DEPARTMENT"
      ? catalogs.departments
      : tab === "CATEGORY"
        ? catalogs.categories
        : tab === "CLASSIFICATION"
          ? catalogs.classifications
          : tab === "PAYMENT_METHOD"
            ? catalogs.paymentMethods
            : [];
  function details(id: string) {
    if (tab === "DEPARTMENT") {
      const d = catalogs.departments.find((v) => v.id === id),
        version = d?.baseVersions.find((v) => v.effectiveMonth <= month);
      return version
        ? `${version.participatesInBase ? "Participa da base" : "Apenas no relatório"} · desde ${formatFinanceMonth(version.effectiveMonth)}`
        : "Configure a participação na base";
    }
    if (tab === "CATEGORY") {
      const c = catalogs.categories.find((v) => v.id === id)!;
      return `${c.direction === "INCOME" ? "Entrada" : c.direction === "EXPENSE" ? "Saída" : "Entrada e saída"}${c.isTithe ? " · Dízimo" : ""}${c.isOffering ? " · Oferta" : ""}${c.requiresPerson ? " · Pessoa obrigatória" : ""}`;
    }
    if (tab === "PAYMENT_METHOD")
      return methodLabels[
        catalogs.paymentMethods.find((v) => v.id === id)!.kind
      ];
    return "Classificação ajustável no lançamento";
  }
  return (
    <div className="stack">
      <div className="row spread">
        <div>
          <h1>Configurações financeiras</h1>
          <p className="muted">
            Cadastros do campo e regras próprias de cada congregação.
          </p>
        </div>
      </div>
      <div className="tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            aria-pressed={tab === t.id}
            onClick={() => {
              if (
                t.id !== tab &&
                rulesDirty &&
                !window.confirm("Descartar as alterações nas regras?")
              )
                return;
              setRulesDirty(false);
              setTab(t.id);
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "RULES" ? (
        <FinanceRuleEditor
          key={`${unit}-${month}-${rules[0]?.id ?? "new"}`}
          latestStatementMonth={latestStatementMonth}
          currentMonth={currentMonth}
          unit={unit}
          month={month}
          rules={rules}
          units={units}
          onDirtyChange={setRulesDirty}
        />
      ) : (
        <section className="card stack">
          <div className="row spread">
            <h2>{tabs.find((t) => t.id === tab)?.label}</h2>
            <Button onClick={() => setEditing({ entity: tab })}>
              <Plus size={16} />
              Novo cadastro
            </Button>
          </div>
          {isPending ? (
            <FinanceSkeleton table />
          ) : rows.length === 0 ? (
            <FinanceEmpty>
              Nenhum cadastro por aqui. Comece adicionando o primeiro.
            </FinanceEmpty>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Configuração</th>
                    <th>Situação</th>
                    <th>
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <strong>{r.name}</strong>
                      </td>
                      <td className="muted">{details(r.id)}</td>
                      <td>
                        <span className="badge">
                          {r.status === "ACTIVE" ? "Ativo" : "Inativo"}
                        </span>
                      </td>
                      <td>
                        <Button
                          variant="outline"
                          size="sm"
                          aria-label={`Editar ${r.name}`}
                          onClick={() => setEditing({ entity: tab, id: r.id })}
                        >
                          <Pencil size={14} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
      {editing && (
        <FinanceCatalogForm
          {...editing}
          unit={unit}
          month={month}
          catalogs={catalogs}
          roles={roles}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
