"use client";
import { useState } from "react";
import type {
  CategoryReportOptions,
  ReportCategory,
} from "../types/finance-category-report.types";

export function FinanceCategoryReportOptions({
  options,
  categories,
  onChange,
}: {
  options: CategoryReportOptions;
  categories: ReportCategory[];
  onChange: (value: CategoryReportOptions) => void;
}) {
  const [search, setSearch] = useState("");
  const normalize = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("pt-BR");
  const matching = categories.filter(
    (c) =>
      (c.direction === options.direction || c.direction === "BOTH") &&
      normalize(c.name).includes(normalize(search.trim())),
  );
  const selected = categories.filter((c) => options.categoryIds.includes(c.id));
  return (
    <div className="stack finance-category-options">
      <p className="muted">
        Movimentações da congregação selecionada no topo, pelas datas dos
        lançamentos.
      </p>
      <div className="finance-informative-period">
        <label>
          Data inicial
          <input
            type="date"
            min="2000-01-01"
            max="2099-12-31"
            value={options.dateFrom}
            onChange={(e) => onChange({ ...options, dateFrom: e.target.value })}
          />
        </label>
        <label>
          Data final
          <input
            type="date"
            min="2000-01-01"
            max="2099-12-31"
            value={options.dateTo}
            onChange={(e) => onChange({ ...options, dateTo: e.target.value })}
          />
        </label>
      </div>
      <div className="finance-informative-period">
        <label>
          Movimentação
          <select
            value={options.direction}
            onChange={(e) => {
              setSearch("");
              onChange({
                ...options,
                direction: e.target.value as CategoryReportOptions["direction"],
                categoryIds: [],
              });
            }}
          >
            <option value="EXPENSE">Saída</option>
            <option value="INCOME">Entrada</option>
          </select>
        </label>
        <label>
          Apresentação
          <select
            value={options.presentation}
            onChange={(e) =>
              onChange({
                ...options,
                presentation: e.target
                  .value as CategoryReportOptions["presentation"],
              })
            }
          >
            <option value="SUMMARY">Resumido — total por categoria</option>
            <option value="DETAILED">
              Detalhado — lançamentos por categoria
            </option>
          </select>
        </label>
      </div>
      <fieldset className="finance-category-picker stack">
        <legend>Categorias</legend>
        <label>
          Buscar categoria
          <input
            type="search"
            value={search}
            maxLength={120}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ex.: Combustível"
          />
        </label>
        <div className="finance-category-list">
          {matching.map((c) => (
            <label key={c.id}>
              <input
                type="checkbox"
                checked={options.categoryIds.includes(c.id)}
                disabled={
                  !options.categoryIds.includes(c.id) &&
                  options.categoryIds.length >= 50
                }
                onChange={(e) =>
                  onChange({
                    ...options,
                    categoryIds: e.target.checked
                      ? [...options.categoryIds, c.id]
                      : options.categoryIds.filter((id) => id !== c.id),
                  })
                }
              />
              <span>
                {c.name}
                {c.status !== "ACTIVE" && <small> · Inativa</small>}
              </span>
            </label>
          ))}
          {!matching.length && (
            <p className="muted">
              Nenhuma categoria encontrada para esta movimentação.
            </p>
          )}
        </div>
        <div className="row spread">
          <small className="muted">
            {selected.length} selecionada(s) · até 50 categorias
          </small>
          {!!selected.length && (
            <button
              type="button"
              className="finance-report-link"
              onClick={() => onChange({ ...options, categoryIds: [] })}
            >
              Limpar seleção
            </button>
          )}
        </div>
        {!!selected.length && (
          <p className="muted finance-category-selected">
            Selecionadas: {selected.map((c) => c.name).join(" · ")}
          </p>
        )}
      </fieldset>
    </div>
  );
}
