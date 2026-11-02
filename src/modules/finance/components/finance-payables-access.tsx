"use client";

import type { ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFinanceDesktop } from "../hooks/use-finance-desktop";
import { useFinanceNavigation } from "./finance-shell";

export function FinancePayablesAccess({ children, mobileDevice = false }: {
  children?: ReactNode;
  mobileDevice?: boolean;
}) {
  const desktop = useFinanceDesktop();
  const navigation = useFinanceNavigation();
  const search = useSearchParams();

  function back() {
    const params = new URLSearchParams();
    for (const key of ["unidade", "mes"]) {
      const value = search.get(key);
      if (value) params.set(key, value);
    }
    navigation.navigate(`/financeiro${params.size ? `?${params}` : ""}`);
  }

  if (mobileDevice || !desktop) return (
    <section className="card stack finance-payables-desktop-notice">
      <Monitor size={30} aria-hidden="true" />
      <h1>Contas a pagar</h1>
      <p className="muted">Contas a pagar está disponível apenas no computador.</p>
      <Button variant="outline" onClick={back} disabled={navigation.isPending}>Voltar à visão geral</Button>
    </section>
  );

  return <div className="finance-desktop-only">{children}</div>;
}
