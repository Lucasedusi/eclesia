"use client";
import { type ReactNode, useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ButtonRoot } from "@/components/ui/button.styles";
import { useRouter } from "next/navigation";
import { FileDown, Loader2, RotateCcw } from "lucide-react";
import { useMemberReport } from "../hooks/use-member-report";
import { birthdayHref, birthdayMonths, birthdaySearch, type BirthdayFilters } from "../validations/member-birthdays";
import { MemberSearchField } from "./member-list-fields";
import * as B from "./birthdays.styles";
import * as S from "./members.styles";

type Props = {
  filters: BirthdayFilters; month: number; label: string; total: number; canExport: boolean;
  congregations: { id: string; name: string; regions: { id: string; name: string } | null }[];
  children: ReactNode;
};
const periods = [["today", "Dia"], ["week", "Semana"], ["month", "Mês"], ["all", "Todos"]] as const;

export function BirthdayPageLink({ href, children }: { href?: string; children: ReactNode }) {
  if (!href) return <Button variant="secondary" size="sm" disabled>{children}</Button>;
  return <ButtonRoot as={Link} href={href} scroll={false} $variant="secondary" $size="sm" $fullWidth={false}>{children}</ButtonRoot>;
}

export function BirthdayControls({ filters, month, label, total, canExport, congregations, children }: Props) {
  const { busy, download, feedback, setFeedback } = useMemberReport();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useOptimistic(filters);
  const [input, setInput] = useState(filters.search);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function cancelTimer() {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  }

  useEffect(() => {
    function restoreSearch() {
      cancelTimer();
      setInput(new URLSearchParams(window.location.search).get("search") ?? "");
    }
    window.addEventListener("popstate", restoreSearch);
    return () => {
      cancelTimer();
      window.removeEventListener("popstate", restoreSearch);
    };
  }, []);

  function apply(changes: Partial<BirthdayFilters>) {
    cancelTimer();
    const next = { ...selected, search: birthdaySearch(input), ...changes };
    if (next.period !== "month") delete next.month;
    setFeedback(null);
    startTransition(() => {
      setSelected(next);
      router.replace(birthdayHref(next), { scroll: false });
    });
  }

  function search(value: string) {
    cancelTimer();
    setInput(value);
    const term = birthdaySearch(value);
    if (term === selected.search) return;
    if (!term) apply({ search: "" });
    else timer.current = setTimeout(() => apply({ search: term }), 400);
  }

  const regions = [...new Map(congregations.flatMap(({ regions }) => regions ? [[regions.id, regions] as const] : [])).values()]
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const showMonth = selected.period === "month";
  const selectCount = Number(showMonth) + Number(regions.length > 0) + Number(congregations.length > 0);
  const searching = birthdaySearch(input) !== filters.search;
  const updating = pending || searching;
  const hasFilters = Boolean(input || selected.regionId || selected.congregationId || selected.period !== "today");

  return <>
    <B.Header>
      <div><h2>Aniversariantes</h2><p>{label} · {total} {total === 1 ? "aniversariante" : "aniversariantes"}</p></div>
      <B.PeriodActions>
        <B.PeriodTabs aria-label="Período dos aniversários">
          {periods.map(([period, name]) => <B.PeriodTab key={period} $active={selected.period === period}
            href={birthdayHref({ ...selected, period, search: birthdaySearch(input) })} scroll={false} prefetch={false}
            aria-current={selected.period === period ? "page" : undefined}
            onNavigate={(event) => { event.preventDefault(); apply({ period }); }}>
            {name}
          </B.PeriodTab>)}
        </B.PeriodTabs>
        {canExport && <B.ExportButton type="button" aria-label={busy ? "Gerando PDF…" : "Exportar PDF"} disabled={busy || updating || !total}
          onClick={() => void download({ kind: "birthdays", format: "pdf", filters })}>
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : <FileDown aria-hidden />}
          <span><span className="export-verb">{busy ? "Gerando " : "Exportar "}</span>PDF{busy && "…"}</span>
        </B.ExportButton>}
      </B.PeriodActions>
    </B.Header>
    {feedback && <p role={feedback.error ? "alert" : "status"} className="px-[22px] py-2 text-sm">{feedback.message}</p>}
    <B.Filters $selectCount={selectCount}>
      <MemberSearchField label="Pesquisar aniversariantes" placeholder="Nome ou matrícula" maxLength={80} value={input}
        pending={updating} onChange={(event) => search(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && birthdaySearch(input)) { event.preventDefault(); apply({}); }
        }}
        onClear={() => { setInput(""); apply({ search: "" }); }} />
      {showMonth && <S.Select aria-label="Mês do aniversário" value={selected.month ?? month}
        onChange={(event) => apply({ month: Number(event.target.value) })}>
        {birthdayMonths.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}
      </S.Select>}
      {regions.length > 0 && <S.Select aria-label="Regional" value={selected.regionId}
        onChange={(event) => apply({ regionId: event.target.value, congregationId: "" })}>
        <option value="">Todas as Regionais</option>
        {regions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </S.Select>}
      {congregations.length > 0 && <S.Select aria-label="Congregação" value={selected.congregationId}
        onChange={(event) => apply({ congregationId: event.target.value })}>
        <option value="">Todas as Congregações</option>
        {congregations.filter((item) => !selected.regionId || item.regions?.id === selected.regionId)
          .map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </S.Select>}
      <S.ResetFiltersButton type="button" title="Limpar filtros" aria-label="Limpar filtros de aniversariantes" disabled={!hasFilters}
        onClick={() => { setInput(""); apply({ period: "today", search: "", regionId: "", congregationId: "" }); }}>
        <RotateCcw aria-hidden />
      </S.ResetFiltersButton>
    </B.Filters>
    {updating ? <S.Loading role="status" aria-label="Carregando aniversariantes"><Loader2 aria-hidden /></S.Loading> : children}
  </>;
}
