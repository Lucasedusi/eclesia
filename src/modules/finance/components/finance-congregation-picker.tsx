"use client";
import { useLayoutEffect, useRef, useState } from "react";
import { Church, Loader2, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { searchFinanceCongregationsAction } from "../actions/finance-contributor.actions";
import type { FinanceCongregationOption } from "../types/finance-contributor.types";

export function FinanceCongregationPicker({
  unit,
  value,
  onChange,
}: {
  unit: string;
  value: FinanceCongregationOption | null;
  onChange: (value: FinanceCongregationOption | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FinanceCongregationOption[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const sequence = useRef(0);
  useLayoutEffect(
    () => () => {
      ++sequence.current;
    },
    [],
  );
  async function search() {
    const request = ++sequence.current;
    setBusy(true);
    setError("");
    setResults([]);
    try {
      const result = await searchFinanceCongregationsAction(unit, query);
      if (request !== sequence.current) return;
      if (result.ok) {
        setResults(result.data);
        if (!result.data.length) setError("Nenhuma congregação encontrada.");
      } else setError(result.message);
    } catch {
      if (request === sequence.current)
        setError("Não foi possível buscar as congregações.");
    } finally {
      if (request === sequence.current) setBusy(false);
    }
  }
  return (
    <div className="stack">
      {value ? (
        <div className="notice finance-selected-person">
          <span className="finance-selected-person-identity">
            <Church size={20} aria-hidden="true" />
            <strong>{value.name}</strong>
          </span>
          <Button
            variant="outline"
            size="sm"
            className="finance-selected-person-remove"
            aria-label="Remover congregação selecionada"
            onClick={() => {
              ++sequence.current;
              setResults([]);
              setQuery("");
              setError("");
              setBusy(false);
              onChange(null);
            }}
          >
            <Trash2 size={18} aria-hidden="true" />
          </Button>
        </div>
      ) : (
        <>
          <label>
            Nome da congregação
            <span className="finance-search-input">
              <input
                value={query}
                maxLength={160}
                autoComplete="off"
                placeholder="Digite pelo menos 2 caracteres"
                onChange={(event) => {
                  ++sequence.current;
                  setQuery(event.target.value);
                  setResults([]);
                  setError("");
                  setBusy(false);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void search();
                  }
                }}
              />
              <button
                type="button"
                aria-label="Buscar congregação"
                disabled={busy || query.trim().length < 2}
                aria-busy={busy}
                onClick={() => void search()}
              >
                {busy ? <Loader2 size={18} className="finance-spin" aria-hidden="true" /> : <Search size={18} aria-hidden="true" />}
              </button>
            </span>
          </label>
          <div aria-live="polite">
            {error && <p role="alert">{error}</p>}
            {results.map((item) => (
              <Button
                key={item.id}
                variant="outline"
                fullWidth
                style={{ justifyContent: "flex-start", marginTop: 8 }}
                onClick={() => {
                  ++sequence.current;
                  setResults([]);
                  setBusy(false);
                  onChange(item);
                }}
              >
                <Church size={17} aria-hidden="true" />
                {item.name}
              </Button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function FinanceCongregationFilter({
  unit,
  initial,
}: {
  unit: string;
  initial: FinanceCongregationOption | null;
}) {
  const [value, setValue] = useState(initial);
  return (
    <div className="stack">
      <span>Congregação que pagou ou recebeu</span>
      <input
        type="hidden"
        name="contributorCongregationId"
        value={value?.id ?? ""}
      />
      <FinanceCongregationPicker
        unit={unit}
        value={value}
        onChange={setValue}
      />
    </div>
  );
}
