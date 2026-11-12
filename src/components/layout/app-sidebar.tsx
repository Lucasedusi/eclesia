"use client";

import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { ChevronLeft, ChevronRight, LogOut } from "lucide-react";
import { mainNavigation, secondaryNavigation } from "@/constants/navigation";
import { APP_CONFIG } from "@/constants/app";
import { LinkPendingIndicator } from "@/components/navigation/navigation-feedback";
import type { AuthContext } from "@/modules/auth/types/auth.types";
import { useFormStatus } from "react-dom";
import { logoutAction } from "@/modules/auth/actions/auth.actions";
import * as S from "./app-sidebar.styles";

type NavigationItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  requiredPermission?: string;
  churchAdminOnly?: boolean;
};

type AppSidebarProps = {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onNavigate?: () => void;
  mobile?: boolean;
  authContext: AuthContext;
};

function EclesiaLogo({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <S.LogoWrapper $collapsed={collapsed} aria-hidden="true">
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M24 44C35.0457 44 44 35.0457 44 24C44 12.9543 35.0457 4 24 4C12.9543 4 4 12.9543 4 24C4 35.0457 12.9543 44 24 44Z"
          fill="#415BA5"
        />
        <path
          d="M24 4C24 15.0457 15.0457 24 4 24C4 12.9543 12.9543 4 24 4Z"
          fill="#6C82DA"
        />
        <path
          d="M24 4C35.0457 4 44 12.9543 44 24C32.9543 24 24 15.0457 24 4Z"
          fill="#243B87"
        />
        <path
          d="M24 36C30.6274 36 36 30.6274 36 24C36 17.3726 30.6274 12 24 12C17.3726 12 12 17.3726 12 24C12 30.6274 17.3726 36 24 36Z"
          fill="#071426"
        />
        <path
          d="M24 12C24 18.6274 18.6274 24 12 24C12 17.3726 17.3726 12 24 12Z"
          fill="#8EA0F2"
        />
      </svg>
    </S.LogoWrapper>
  );
}

function SidebarLogout() {
  const { pending } = useFormStatus();
  return <S.FooterLogout type="submit" aria-label="Sair do sistema" title="Encerrar sessão" disabled={pending} aria-busy={pending}>
    <LogOut size={20} aria-hidden />
  </S.FooterLogout>;
}

export function AppSidebar({
  collapsed = false,
  onToggleCollapse,
  onNavigate,
  mobile = false,
  authContext,
}: AppSidebarProps) {
  const pathname = usePathname();
  const isCollapsed = collapsed && !mobile;

  function canShow(item: NavigationItem) {
    const hasRequiredPermission =
      !item.requiredPermission || authContext.permissions.includes(item.requiredPermission);
    const hasRequiredAdminScope =
      !item.churchAdminOnly ||
      (authContext.access.role === "ADMIN" && authContext.access.scope === "CHURCH");
    return hasRequiredPermission && hasRequiredAdminScope;
  }

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
      <S.NavItem
        key={item.href}
        href={item.href}
        onClick={onNavigate}
        title={isCollapsed ? item.label : undefined}
        $active={active}
        $collapsed={isCollapsed}
      >
        <S.IconSlot>
          <Icon size={20} strokeWidth={1.55} />
        </S.IconSlot>

        {!isCollapsed && <S.NavLabel>{item.label}</S.NavLabel>}
        {!isCollapsed && <LinkPendingIndicator />}
        {isCollapsed && <S.Tooltip>{item.label}</S.Tooltip>}
      </S.NavItem>
    );
  }

  const mainItems = mainNavigation.filter(canShow);
  const secondaryItems = secondaryNavigation.filter(canShow);

  return (
    <S.SidebarRoot $collapsed={isCollapsed}>
      <S.SidebarHeader $collapsed={isCollapsed}>
        <S.Brand>
          <EclesiaLogo collapsed={isCollapsed} />

          {!isCollapsed && <S.BrandName>{APP_CONFIG.name}</S.BrandName>}
        </S.Brand>

        {!mobile && onToggleCollapse && (
          <S.CollapseButton
            type="button"
            onClick={onToggleCollapse}
            aria-label={isCollapsed ? "Expandir sidebar" : "Recolher sidebar"}
          >
            {isCollapsed ? (
              <ChevronRight size={20} strokeWidth={2} />
            ) : (
              <ChevronLeft size={18} strokeWidth={2} />
            )}
          </S.CollapseButton>
        )}
      </S.SidebarHeader>

      <S.SidebarScrollArea>
        {mainItems.length > 0 && (
          <S.NavList $collapsed={isCollapsed} aria-label="Menu principal">
            {mainItems.map(renderNavItem)}
          </S.NavList>
        )}

        {mainItems.length > 0 && secondaryItems.length > 0 && <S.NavDivider />}

        {secondaryItems.length > 0 && (
          <S.NavList $collapsed={isCollapsed} $secondary aria-label="Menu do sistema">
            {secondaryItems.map(renderNavItem)}
          </S.NavList>
        )}
      </S.SidebarScrollArea>

      <S.SidebarFooter $collapsed={isCollapsed} title={authContext.church.name}>
        <form action={logoutAction}><SidebarLogout /></form>
        <span className={isCollapsed ? "sr-only" : undefined}>{authContext.church.name}</span>
      </S.SidebarFooter>
    </S.SidebarRoot>
  );
}
