"use client";

import { useEffect, useState } from "react";
import { AppHeader } from "./app-header";
import { AppSidebar } from "./app-sidebar";
import { MobileSidebar } from "./mobile-sidebar";
import { cn } from "@/utils/cn";

type AppShellProps = {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
};

export function AppShell({ children, title, subtitle }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const savedValue = localStorage.getItem("eclesias-sidebar-collapsed");

    if (savedValue) {
      setSidebarCollapsed(savedValue === "true");
    }
  }, []);

  function handleToggleSidebar() {
    setSidebarCollapsed((current) => {
      const nextValue = !current;
      localStorage.setItem("eclesias-sidebar-collapsed", String(nextValue));
      return nextValue;
    });
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="fixed inset-y-0 left-0 z-40 hidden lg:block">
        <AppSidebar
          collapsed={sidebarCollapsed}
          onToggleCollapse={handleToggleSidebar}
        />
      </div>

      <MobileSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div
        className={cn(
          "transition-all duration-300",
          sidebarCollapsed ? "lg:pl-[88px]" : "lg:pl-72"
        )}
      >
        <AppHeader
          title={title}
          subtitle={subtitle}
          onOpenSidebar={() => setSidebarOpen(true)}
        />

        <main className="px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}