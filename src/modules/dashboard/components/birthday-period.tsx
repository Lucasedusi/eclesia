"use client";

import { PickerSelect } from "@/components/form/pickers/picker-select";
import { Cake } from "lucide-react";
import { ResultsSkeleton } from "@/components/ui/results-skeleton";
import { type ReactNode, useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { dashboardPeriod, type DashboardPeriod } from "../dashboard";

export function BirthdayPeriod({ period, label, columns, children }: { period: DashboardPeriod; label: string; columns: number; children: ReactNode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useOptimistic(period);
  return <section className="church-dashboard-panel" aria-label="Aniversariantes">
    <div className="church-dashboard-section-header">
      <div className="church-dashboard-birthday-heading">
        <span className="church-dashboard-icon"><Cake size={23} aria-hidden /></span>
        <div><h2>Aniversariantes</h2><p>{label}</p></div>
      </div>
      <PickerSelect fieldClassName="birthday-period" aria-label="Período dos aniversariantes" aria-busy={pending} value={selected} onChange={event => {
        const next = dashboardPeriod(event.target.value);
        startTransition(() => {
          setSelected(next);
          router.replace(next === "today" ? "/" : `/?period=${next}`, { scroll: false });
        });
      }}>
        <option value="today">Dia</option><option value="week">Semana</option><option value="month">Mês</option>
      </PickerSelect>
    </div>
    {pending ? <ResultsSkeleton label="Carregando aniversariantes" columns={columns} /> : children}
  </section>;
}
