"use client";

import { useEffect, useState } from "react";
import { AppHeader } from "./app-header";
import { AppSidebar } from "./app-sidebar";
import { MobileSidebar } from "./mobile-sidebar";
import * as S from "./app-shell.styles";

type AppShellProps = {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
};

const SIDEBAR_STORAGE_KEY = "eclesias-sidebar-collapsed";

export function AppShell({ children, title, subtitle }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const storedValue = localStorage.getItem(SIDEBAR_STORAGE_KEY);
    setSidebarCollapsed(storedValue === "true");
  }, []);

  function handleToggleSidebar() {
    setSidebarCollapsed((current) => {
      const nextValue = !current;
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(nextValue));
      return nextValue;
    });
  }

  return (
    <S.ShellRoot>
      <S.DesktopSidebarSlot>
        <AppSidebar
          collapsed={sidebarCollapsed}
          onToggleCollapse={handleToggleSidebar}
        />
      </S.DesktopSidebarSlot>

      <MobileSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <S.Content $collapsed={sidebarCollapsed}>
        <AppHeader
          title={title}
          subtitle={subtitle}
          onOpenSidebar={() => setSidebarOpen(true)}
        />

        <S.Main>
          <S.MainInner>{children}</S.MainInner>
        </S.Main>
      </S.Content>
    </S.ShellRoot>
  );
}
