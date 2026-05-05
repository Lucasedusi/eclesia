"use client";

import { Bell, Menu, Search, Settings } from "lucide-react";

type AppHeaderProps = {
  title?: string;
  subtitle?: string;
  onOpenSidebar?: () => void;
};

export function AppHeader({
  title = "Dashboard",
  subtitle = "Visão geral da plataforma",
  onOpenSidebar,
}: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="flex h-20 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onOpenSidebar}
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 lg:hidden"
            aria-label="Abrir menu"
          >
            <Menu size={22} />
          </button>

          <div className="min-w-0">
            <h2 className="truncate text-xl font-bold text-slate-950 md:text-2xl">
              {title}
            </h2>
            <p className="mt-0.5 hidden text-sm text-slate-500 sm:block">
              {subtitle}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eef4ff] text-[#0b51b7] transition hover:bg-[#dfeaff]"
            aria-label="Notificações"
          >
            <Bell size={19} />
            <span className="absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-white" />
          </button>

          <button
            type="button"
            className="hidden h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 transition hover:bg-slate-200 sm:flex"
            aria-label="Configurações"
          >
            <Settings size={19} />
          </button>

          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-2.5 py-2 shadow-sm">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0b51b7] text-sm font-bold text-white">
              LE
            </div>

            <div className="hidden pr-2 leading-tight md:block">
              <p className="text-sm font-semibold text-slate-900">
                Lucas Eduardo
              </p>
              <p className="text-xs text-slate-500">Administrador</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}