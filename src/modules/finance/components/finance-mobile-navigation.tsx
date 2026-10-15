"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Ellipsis, type LucideIcon } from "lucide-react";
import { FinancePwaInstall } from "./finance-pwa-install";
import { financeLocation } from "../utils/finance-navigation";

type Item = { label: string; path: string; icon: LucideIcon };

export function FinanceMobileNavigation({
  items,
  pathname,
  unitId,
  month,
  navigate,
}: {
  items: ReadonlyArray<Item>;
  pathname: string;
  unitId: string;
  month: string;
  navigate: (url: string) => void;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const primary = items.filter((item) =>
    ["/financeiro", "/financeiro/lancamentos", "/financeiro/atendimento"].includes(
      item.path,
    ),
  );
  const secondary = items.filter((item) => !primary.includes(item));
  const moreSelected = secondary.some((item) => item.path === pathname);

  useEffect(() => {
    if (!moreOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMoreOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [moreOpen]);

  function link(item: Item, compact: boolean) {
    const label = item.path === "/financeiro" && compact ? "Início" : item.label;
    const href = financeLocation(item.path, unitId, month);
    return (
      <Link
        key={item.path}
        href={href}
        aria-label={label}
        aria-current={pathname === item.path ? "page" : undefined}
        onNavigate={(event) => {
          event.preventDefault();
          setMoreOpen(false);
          navigate(href);
        }}
      >
        <item.icon size={21} aria-hidden="true" />
        <span>{label}</span>
      </Link>
    );
  }

  return (
    <nav className="finance-mobile-navigation no-print" aria-label="Navegação financeira mobile">
      {/* Keep installation listening while the menu is closed. */}
      <div id="finance-mobile-more" className="finance-mobile-more" role="group" aria-label="Mais opções" hidden={!moreOpen}>
        {secondary.map((item) => link(item, false))}
        <FinancePwaInstall />
        <Link
          href="/"
          onNavigate={(event) => {
            event.preventDefault();
            setMoreOpen(false);
            navigate("/");
          }}
        >
          <ArrowLeft size={20} aria-hidden="true" />
          <span>Voltar ao sistema</span>
        </Link>
      </div>
      <div className="finance-mobile-navigation-row">
        {primary.map((item) => link(item, true))}
        <button
          type="button"
          aria-controls="finance-mobile-more"
          aria-expanded={moreOpen}
          aria-current={moreSelected ? "page" : undefined}
          onClick={() => setMoreOpen((open) => !open)}
        >
          <Ellipsis size={21} aria-hidden="true" />
          <span>Mais</span>
        </button>
      </div>
    </nav>
  );
}
