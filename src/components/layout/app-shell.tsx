"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { AuthContext } from "@/modules/auth/types/auth.types";
import { AppHeader } from "./app-header";
import { AppSidebar } from "./app-sidebar";
import { MobileSidebar } from "./mobile-sidebar";
import * as S from "./app-shell.styles";

type AppShellProps = {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  authContext: AuthContext;
};

const SIDEBAR_STORAGE_KEY = "eclesias-sidebar-collapsed";
const AppShellContext = createContext(false);

export function AppShell({ children, title, subtitle, authContext }: AppShellProps) {
  const hasParentShell = useContext(AppShellContext);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setSidebarCollapsed(localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true");
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  function handleToggleSidebar() {
    setSidebarCollapsed((current) => {
      const nextValue = !current;
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(nextValue));
      return nextValue;
    });
  }

  // Páginas antigas ainda podem declarar AppShell para manter compatibilidade.
  // O layout autenticado compartilhado é o único responsável pela moldura visual.
  if (hasParentShell) return <>{children}</>;

  return (
    <AppShellContext.Provider value>
      <S.ShellRoot data-app-shell>
        <S.DesktopSidebarSlot>
          <AppSidebar
            collapsed={sidebarCollapsed}
            onToggleCollapse={handleToggleSidebar}
            authContext={authContext}
          />
        </S.DesktopSidebarSlot>

        <MobileSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} authContext={authContext} />

        <S.Content $collapsed={sidebarCollapsed}>
          <AppHeader
            title={title}
            subtitle={subtitle}
            onOpenSidebar={() => setSidebarOpen(true)}
            authContext={authContext}
          />

          <S.Main>
            <S.MainInner>{children}</S.MainInner>
          </S.Main>
        </S.Content>
      </S.ShellRoot>
    </AppShellContext.Provider>
  );
}
