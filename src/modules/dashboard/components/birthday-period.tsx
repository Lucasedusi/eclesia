"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { dashboardPeriod, type DashboardPeriod } from "../dashboard";

export function BirthdayPeriod({ period }: { period: DashboardPeriod }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useOptimistic(period);
  return <select aria-label="Período dos aniversariantes" aria-busy={pending} value={selected} onChange={event => {
    const next = dashboardPeriod(event.target.value);
    startTransition(() => {
      setSelected(next);
      router.replace(next === "today" ? "/" : `/?period=${next}`, { scroll: false });
    });
  }}>
    <option value="today">Dia</option><option value="week">Semana</option><option value="month">Mês</option>
  </select>;
}
