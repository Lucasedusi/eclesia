"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getMemberFinanceAction } from "../actions/member.actions";
import type { MemberFinancialPage } from "../types/member-finance.types";
import { memberFinanceFiltersSchema } from "../validations/member-finance.schemas";
import {
  financeDirectionLabel,
  financeStatusLabel,
  formatMemberMoney,
} from "../utils/member-finance-formatters";
import { formatDateOnly } from "../utils/member-formatters";
import * as S from "./member-details.styles";
export function MemberFinanceTab({
  memberId,
  canExport,
}: {
  memberId: string;
  canExport: boolean;
}) {
  const [filters, setFilters] = useState({ dateFrom: "", dateTo: "" }),
    [applied, setApplied] = useState(filters),
    [data, setData] = useState<MemberFinancialPage | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [downloading, setDownloading] = useState(false);
  const request = useRef(0),
    downloadLock = useRef(false);
  async function load(page: number, next = applied) {
    const id = ++request.current;
    setLoading(true);
    setError("");
    try {
      const result = await getMemberFinanceAction(memberId, page, next);
      if (id !== request.current) return;
      if (result.success) {
        setData(result.data);
        setApplied(next);
      } else {
        setData(null);
        setError(result.message);
      }
    } catch {
      if (id === request.current) {
        setData(null);
        setError("Não foi possível carregar os lançamentos. Tente novamente.");
      }
    } finally {
      if (id === request.current) setLoading(false);
    }
  }
  useEffect(() => {
    let active = true;
    const counter = request;
    const id = ++counter.current;
    getMemberFinanceAction(memberId, 1, {})
      .then((result) => {
        if (!active || id !== request.current) return;
        if (result.success) setData(result.data);
        else setError(result.message);
      })
      .catch(() => {
        if (active)
          setError(
            "Não foi possível carregar os lançamentos. Tente novamente.",
          );
      })
      .finally(() => {
        if (active && id === request.current) setLoading(false);
      });
    return () => {
      active = false;
      counter.current++;
    };
  }, [memberId]);
  function filter(event: FormEvent) {
    event.preventDefault();
    const parsed = memberFinanceFiltersSchema.safeParse(filters);
    if (!parsed.success) {
      setError("Informe um período válido, com o início anterior ao fim.");
      return;
    }
    void load(1, parsed.data);
  }
  async function download(format: "pdf" | "xlsx") {
    if (downloadLock.current) return;
    downloadLock.current = true;
    setDownloading(true);
    setError("");
    try {
      const response = await fetch("/api/members/finance/reports", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, format, filters: applied }),
      });
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.message || "Não foi possível exportar.");
      }
      const expected =
        format === "pdf"
          ? "application/pdf"
          : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      if (!response.headers.get("Content-Type")?.includes(expected))
        throw new Error("Entre novamente para exportar.");
      const url = URL.createObjectURL(await response.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `financeiro-membro.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível exportar.");
    } finally {
      downloadLock.current = false;
      setDownloading(false);
    }
  }
  return (
    <S.Section>
      <S.TabHeader>
        <div>
          <h4>Financeiro do membro</h4>
          <p>Consulta dos lançamentos vinculados nas unidades autorizadas.</p>
        </div>
      </S.TabHeader>
      <S.FinanceFilters onSubmit={filter}>
        <S.FormField>
          <span>Data inicial</span>
          <S.FormControl
            type="date"
            value={filters.dateFrom}
            onChange={(e) =>
              setFilters({ ...filters, dateFrom: e.target.value })
            }
          />
        </S.FormField>
        <S.FormField>
          <span>Data final</span>
          <S.FormControl
            type="date"
            value={filters.dateTo}
            onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
          />
        </S.FormField>
        <S.FormActions>
          <Button type="submit" disabled={loading || downloading}>
            Aplicar período
          </Button>
        </S.FormActions>
      </S.FinanceFilters>
      {error && (
        <S.Error role="alert">
          {error}
          {!data && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void load(1)}
              disabled={loading}
            >
              Tentar novamente
            </Button>
          )}
        </S.Error>
      )}
      {loading ? (
        <S.Loading aria-label="Carregando financeiro">
          <Loader2 />
        </S.Loading>
      ) : (
        data && (
          <>
            <S.TabHeader>
              <p>
                {data.period} · {data.total} lançamento(s)
              </p>
              {canExport && (
                <S.ExportActions>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={downloading}
                    onClick={() => void download("pdf")}
                  >
                    <Download size={14} />
                    PDF
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={downloading}
                    onClick={() => void download("xlsx")}
                  >
                    <Download size={14} />
                    Excel
                  </Button>
                </S.ExportActions>
              )}
            </S.TabHeader>
            <S.FinanceSummary>
              {[
                ["Entradas confirmadas", data.summary.incomeCents],
                ["Saídas confirmadas", data.summary.expenseCents],
                ["Cancelados", data.summary.cancelledCents],
                ["Não confirmados", data.summary.pendingCents],
              ].map(([label, cents]) => (
                <article key={label}>
                  <small>{label}</small>
                  <strong>{formatMemberMoney(Number(cents) / 100)}</strong>
                </article>
              ))}
            </S.FinanceSummary>
            {!data.items.length ? (
              <S.Empty>Nenhum lançamento encontrado para o período.</S.Empty>
            ) : (
              <S.SimpleTable>
                <table>
                  <thead>
                    <tr>
                      {[
                        "Data",
                        "Tipo",
                        "Categoria",
                        "Descrição",
                        "Pagamento",
                        "Valor",
                        "Situação",
                      ].map((label) => (
                        <th key={label}>{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((item) => (
                      <tr key={item.id}>
                        <td>{formatDateOnly(item.transactionDate)}</td>
                        <td>{financeDirectionLabel(item.transactionType)}</td>
                        <td>{item.category}</td>
                        <td>
                          {item.description || item.transactionNumber || "—"}
                        </td>
                        <td>{item.paymentMethod || "Não informado"}</td>
                        <td>{formatMemberMoney(item.amount)}</td>
                        <td>{financeStatusLabel(item.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </S.SimpleTable>
            )}
            {data.pageCount > 1 && (
              <S.Pager>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={data.page <= 1 || downloading}
                  onClick={() => void load(data.page - 1)}
                >
                  Anterior
                </Button>
                <span>
                  {data.page} de {data.pageCount}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={data.page >= data.pageCount || downloading}
                  onClick={() => void load(data.page + 1)}
                >
                  Próxima
                </Button>
              </S.Pager>
            )}
          </>
        )
      )}
    </S.Section>
  );
}
