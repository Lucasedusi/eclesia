"use client";

import { useEffect, useState } from "react";
import type { AuthContext } from "@/modules/auth/types/auth.types";
import { AppHeader } from "./app-header";
import { AppSidebar } from "./app-sidebar";
import { MobileSidebar } from "./mobile-sidebar";
import * as S from "./app-shell.styles";

type AppShellProps = {
  children: React.ReactNode;
  authContext: AuthContext;
};

const SIDEBAR_STORAGE_KEY = "eclesias-sidebar-collapsed";

export function AppShell({ children, authContext }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        setSidebarCollapsed(localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true");
      } catch {
        setSidebarCollapsed(false);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  function handleToggleSidebar() {
    const next = !sidebarCollapsed;
    setSidebarCollapsed(next);
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
    } catch {
      // Browsers that block storage still retain the preference for this session.
    }
  }

  return (
    <S.ShellRoot data-app-shell>
        <S.DesktopSidebarSlot>
          <AppSidebar
            collapsed={sidebarCollapsed === true}
            onToggleCollapse={sidebarCollapsed === null ? undefined : handleToggleSidebar}
            authContext={authContext}
          />
        </S.DesktopSidebarSlot>

        <MobileSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} authContext={authContext} />

        <S.Content $collapsed={sidebarCollapsed === true}>
          <AppHeader
            onOpenSidebar={() => setSidebarOpen(true)}
            authContext={authContext}
          />

          <S.Main>
            <S.MainInner>{children}</S.MainInner>
          </S.Main>
        </S.Content>
    </S.ShellRoot>
  );
}
