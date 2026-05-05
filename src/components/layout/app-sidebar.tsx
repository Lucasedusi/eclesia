"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, Church } from "lucide-react";
import {
  footerNavigation,
  mainNavigation,
  secondaryNavigation,
} from "@/constants/navigation";
import { cn } from "@/utils/cn";

type AppSidebarProps = {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onNavigate?: () => void;
  mobile?: boolean;
};

export function AppSidebar({
  collapsed = false,
  onToggleCollapse,
  onNavigate,
  mobile = false,
}: AppSidebarProps) {
  const pathname = usePathname();

  const isCollapsed = collapsed && !mobile;

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  function renderNavItem(item: (typeof mainNavigation)[number]) {
    const Icon = item.icon;
    const active = isActive(item.href);

    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onNavigate}
        title={isCollapsed ? item.label : undefined}
        className={cn(
          "group relative flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition",
          isCollapsed && "justify-center px-0",
          active
            ? "bg-white text-[#0b51b7] shadow-sm"
            : "text-white/78 hover:bg-white/10 hover:text-white"
        )}
      >
        <Icon size={20} className="shrink-0" />

        {!isCollapsed && <span className="truncate">{item.label}</span>}

        {isCollapsed && (
          <span className="pointer-events-none absolute left-[4.4rem] z-50 whitespace-nowrap rounded-xl bg-slate-950 px-3 py-2 text-xs font-semibold text-white opacity-0 shadow-lg transition group-hover:opacity-100">
            {item.label}
          </span>
        )}
      </Link>
    );
  }

  return (
    <aside
      className={cn(
        "flex h-full flex-col bg-[#3361b3] text-white transition-all duration-300",
        isCollapsed ? "w-[88px]" : "w-72"
      )}
    >
      <div
        className={cn(
          "relative flex h-24 items-center gap-3 px-6",
          isCollapsed && "justify-center px-4"
        )}
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-[#0b51b7] shadow-sm">
          <Church size={25} />
        </div>

        {!isCollapsed && (
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold leading-none tracking-tight">
              Eclesias
            </h1>
            <p className="mt-1 truncate text-xs font-medium text-white/70">
              Gestão da Igreja
            </p>
          </div>
        )}

        {!mobile && onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="absolute -right-4 top-8 flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-[#0b51b7] shadow-sm transition hover:bg-slate-50"
            aria-label={isCollapsed ? "Expandir sidebar" : "Recolher sidebar"}
          >
            {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="mb-4">
          {!isCollapsed && (
            <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">
              Principal
            </p>
          )}

          <nav className="space-y-1">
            {mainNavigation.map((item) => renderNavItem(item))}
          </nav>
        </div>

        <div className="mt-7">
          {!isCollapsed && (
            <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">
              Sistema
            </p>
          )}

          <nav className="space-y-1">
            {secondaryNavigation.map((item) => renderNavItem(item))}
          </nav>
        </div>
      </div>

      <div className="border-t border-white/10 p-4">
        <nav className="space-y-1">
          {footerNavigation.map((item) => renderNavItem(item))}
        </nav>
      </div>
    </aside>
  );
}