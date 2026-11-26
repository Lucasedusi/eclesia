"use client";
import { FinanceSelect } from "./finance-select";
import { FinanceDateField } from "./finance-date-field";
import { normalizeCategoryName } from "../utils/finance-category-name";
import {
  FinanceRangeEditor,
  type FinanceDateRange,
} from "./finance-range-editor";
import { FinanceFieldPopup } from "./finance-field-popup";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { ChevronDown } from "lucide-react";
import { isLocalDate } from "../utils/finance-period";
import styles from "@/components/form/pickers/pickers.module.css";
import { useRef, useState } from "react";
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
  const [range, setRange] = useState<FinanceDateRange | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [listOpen, setListOpen] = useState(false);
  function openRange() {
    setRange({ dateFrom: options.dateFrom, dateTo: options.dateTo });
  }
  const matching = categories.filter(
    (c) =>
      (c.direction === options.direction || c.direction === "BOTH") &&
      normalizeCategoryName(c.name).includes(normalizeCategoryName(search)),
  );
  const selected = categories.filter((c) => options.categoryIds.includes(c.id));
  return (
    <div className="stack finance-category-options">
      <div className="finance-category-period">
        <FinanceDateField
          label="Data inicial"
          withCalendar
          required={false}
          onOpenCalendar={openRange}
          min="2000-01-01"
          max="2099-12-31"
          value={options.dateFrom}
          onChange={(iso) => onChange({ ...options, dateFrom: iso })}
        />
        <FinanceDateField
          label="Data final"
          withCalendar
          required={false}
          onOpenCalendar={openRange}
          min="2000-01-01"
          max="2099-12-31"
          value={options.dateTo}
          onChange={(iso) => onChange({ ...options, dateTo: iso })}
        />

        <FinanceSelect
          label="Movimentação"
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
        </FinanceSelect>
        <FinanceSelect
          label="Apresentação"
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
        </FinanceSelect>
      </div>
      {range && (
        <Modal
          title="Período do relatório"
          size="lg"
          className="finance-period-dialog"
          onClose={() => setRange(null)}
          footer={
            <Button
              disabled={
                !isLocalDate(range.dateFrom) ||
                !isLocalDate(range.dateTo) ||
                range.dateFrom > range.dateTo
              }
              onClick={() => {
                onChange({ ...options, ...range });
                setRange(null);
              }}
            >
              Aplicar
            </Button>
          }
        >
          <FinanceRangeEditor range={range} onChange={setRange} />
        </Modal>
      )}
      <div className="finance-category-picker stack">
        <span>Categorias</span>
        <button
          ref={trigger}
          type="button"
          className={styles.multiTrigger}
          aria-haspopup="dialog"
          aria-expanded={listOpen}
          onClick={() => {
            setSearch("");
            setListOpen(!listOpen);
          }}
        >
          {selected.length
            ? selected.length === 1
              ? selected[0].name
              : selected.length + " categorias selecionadas"
            : "Selecionar categorias"}
          <ChevronDown
            size={17}
            className={styles.chevron}
            aria-hidden="true"
          />
        </button>
        {listOpen && (
          <FinanceFieldPopup
            anchor={trigger}
            onDismiss={() => setListOpen(false)}
          >
            <div
              role="dialog"
              aria-label="Selecionar categorias"
              className="stack"
            >
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
            </div>
          </FinanceFieldPopup>
        )}
        {!!selected.length && (
          <p className="muted finance-category-selected">
            Selecionadas: {selected.map((c) => c.name).join(" · ")}
          </p>
        )}
      </div>
    </div>
  );
}
