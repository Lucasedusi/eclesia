"use client";

import { Bell, CalendarDays, ChevronDown, Menu, Settings } from "lucide-react";

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
    <header className="sticky top-0 z-30 border-none bg-white/95 backdrop-blur">
      <div className="flex h-20 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onOpenSidebar}
            className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-white text-slate-700 shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition hover:bg-[#eef2ff] hover:text-[#3956a6] lg:hidden"
            aria-label="Abrir menu"
          >
            <Menu size={20} />
          </button>

          <div className="min-w-0">
            <p className="mt-0.5 hidden text-[14px] font-bold text-slate-500 sm:block">
              Paz do Senhor, Secretário! 👋
            </p>
          </div>
        </div>

        <div className="hidden items-center gap-3 lg:flex">
          <div className="flex h-10 border border-slate-100 items-center gap-2 rounded-[6px] bg-white px-4 text-[14px] font-semibold text-slate-600">
            <CalendarDays size={17} className="text-[#3956a6]" />
            <span>Hoje</span>
          </div>

          <button
            type="button"
            className="relative border border-slate-100 flex h-10 w-10 items-center justify-center rounded-[6px] bg-white text-slate-600 transition hover:bg-[#eef2ff] hover:text-[#3956a6]"
            aria-label="Notificações"
          >
            <Bell size={18} />
            <span className="absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-white" />
          </button>

          <button
            type="button"
            className="flex h-10 w-10 border border-slate-100 items-center justify-center rounded-[6px] bg-white text-slate-600 transition hover:bg-[#eef2ff] hover:text-[#3956a6] "
            aria-label="Configurações"
          >
            <Settings size={18} />
          </button>

          <div className="flex h-11 items-center gap-3 rounded-[10px] bg-white ">
            <div className="hidden leading-tight xl:block">
              <p className="text-[14px] font-bold text-slate-950">
                Lucas Eduardo
              </p>

              <p className="text-xs font-medium text-slate-500">
                Administrador
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <button
            type="button"
            className="relative flex h-10 w-10 items-center justify-center rounded-[10px] bg-white text-slate-600 shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition hover:bg-[#eef2ff] hover:text-[#3956a6]"
            aria-label="Notificações"
          >
            <Bell size={18} />
            <span className="absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-white" />
          </button>

          <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#3956a6] text-[13px] font-bold text-white">
            LE
          </div>
        </div>
      </div>
    </header>
  );
}
