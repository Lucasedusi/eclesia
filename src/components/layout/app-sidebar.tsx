"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, Church } from "lucide-react";
import {
  footerNavigation,
  mainNavigation,
  secondaryNavigation,
} from "@/constants/navigation";
import { APP_CONFIG } from "@/constants/app";
import { cn } from "@/utils/cn";

type NavigationItem =
  | (typeof mainNavigation)[number]
  | (typeof secondaryNavigation)[number]
  | (typeof footerNavigation)[number];

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
    if (href === "/") {
      return pathname === "/";
    }

    return pathname.startsWith(href);
  }

  function renderNavItem(item: NavigationItem) {
    const Icon = item.icon;
    const active = isActive(item.href);

    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onNavigate}
        title={isCollapsed ? item.label : undefined}
        className={cn(
          "group relative flex items-center gap-3 rounded-[14px] px-3 py-3 text-sm font-bold transition-all",
          isCollapsed && "justify-center px-0",
          active
            ? "bg-[#3956a6] text-white shadow-sm"
            : "text-white/72 hover:bg-white/10 hover:text-white",
        )}
      >
        <Icon
          size={20}
          className={cn(
            "shrink-0 transition",
            active ? "text-white" : "text-white/65 group-hover:text-white",
          )}
        />

        {!isCollapsed && <span className="truncate">{item.label}</span>}

        {isCollapsed && (
          <span className="pointer-events-none absolute left-[4.6rem] z-50 whitespace-nowrap rounded-xl bg-slate-950 px-3 py-2 text-xs font-bold text-white opacity-0 shadow-lg transition group-hover:opacity-100">
            {item.label}
          </span>
        )}
      </Link>
    );
  }

  return (
    <aside
      className={cn(
        "flex h-full flex-col overflow-hidden border-r border-white/10 bg-[#071426] text-white transition-all duration-300",
        isCollapsed ? "w-[88px]" : "w-72",
      )}
    >
      <div
        className={cn(
          "relative flex h-24 items-center gap-3 border-b border-white/10 px-5",
          isCollapsed && "justify-center px-4",
        )}
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-[#3956a6] text-white shadow-sm">
          <Church size={24} />
        </div>

        {!isCollapsed && (
          <div className="min-w-0">
            <h1 className="truncate text-xl font-extrabold leading-none tracking-tight text-white">
              {APP_CONFIG.name}
            </h1>
            <p className="mt-1 truncate text-xs font-bold text-white/50">
              Gestão da Igreja
            </p>
          </div>
        )}

        {!mobile && onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="absolute -right-4 top-8 flex h-8 w-8 items-center justify-center rounded-full border border-[#cfcec9] bg-white text-[#3956a6] shadow-sm transition hover:bg-[#eef2ff]"
            aria-label={isCollapsed ? "Expandir sidebar" : "Recolher sidebar"}
          >
            {isCollapsed ? (
              <ChevronRight size={18} />
            ) : (
              <ChevronLeft size={18} />
            )}
          </button>
        )}
      </div>

      <div className="no-scrollbar flex-1 overflow-y-auto overflow-x-hidden px-4 py-5">
        <div className="mb-6">
          {!isCollapsed && (
            <p className="mb-3 px-3 text-[11px] font-extrabold uppercase tracking-[0.18em] text-white/35">
              Principal
            </p>
          )}

          <nav className="space-y-1.5">
            {mainNavigation.map((item) => renderNavItem(item))}
          </nav>
        </div>

        <div className="mt-7">
          {!isCollapsed && (
            <p className="mb-3 px-3 text-[11px] font-extrabold uppercase tracking-[0.18em] text-white/35">
              Sistema
            </p>
          )}

          <nav className="space-y-1.5">
            {secondaryNavigation.map((item) => renderNavItem(item))}
          </nav>
        </div>
      </div>

      <div className="border-t border-white/10 p-4">
        {!isCollapsed && (
          <div className="mb-3 rounded-[18px] border border-white/10 bg-white/5 p-4">
            <p className="text-sm font-extrabold text-white">
              Ambiente inicial
            </p>
            <p className="mt-1 text-xs leading-5 text-white/50">
              Base preparada para modelagem dos módulos.
            </p>
          </div>
        )}

        <nav className="space-y-1.5">
          {footerNavigation.map((item) => renderNavItem(item))}
        </nav>
      </div>
    </aside>
  );
}
