"use client";

import { X } from "lucide-react";
import { AppSidebar } from "./app-sidebar";
import { cn } from "@/utils/cn";

type MobileSidebarProps = {
  open: boolean;
  onClose: () => void;
};

export function MobileSidebar({ open, onClose }: MobileSidebarProps) {
  return (
    <div
      className={cn(
        "fixed inset-0 z-50 lg:hidden",
        open ? "pointer-events-auto" : "pointer-events-none"
      )}
    >
      <div
        onClick={onClose}
        className={cn(
          "absolute inset-0 bg-slate-950/45 transition-opacity",
          open ? "opacity-100" : "opacity-0"
        )}
      />

      <div
        className={cn(
          "absolute left-0 top-0 h-full transition-transform duration-300",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="relative h-full">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white transition hover:bg-white/20"
            aria-label="Fechar menu"
          >
            <X size={20} />
          </button>

          <AppSidebar onNavigate={onClose} mobile />
        </div>
      </div>
    </div>
  );
}