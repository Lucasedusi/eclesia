"use client";

import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { mainNavigation, secondaryNavigation } from "@/constants/navigation";
import { APP_CONFIG } from "@/constants/app";
import * as S from "./app-sidebar.styles";

type NavigationItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  indicator?: boolean;
  notification?: boolean;
};

type AppSidebarProps = {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onNavigate?: () => void;
  mobile?: boolean;
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

function SidebarAvatar() {
  return (
    <S.Avatar aria-hidden="true">
      <span>LE</span>
    </S.Avatar>
  );
}

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
    const hasIndicator = item.indicator ?? item.notification;

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
          {hasIndicator && <S.Indicator />}
        </S.IconSlot>

        {!isCollapsed && <S.NavLabel>{item.label}</S.NavLabel>}
        {isCollapsed && <S.Tooltip>{item.label}</S.Tooltip>}
      </S.NavItem>
    );
  }

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
        <S.NavList $collapsed={isCollapsed} aria-label="Menu principal">
          {mainNavigation.map((item) => renderNavItem(item))}
        </S.NavList>

        <S.NavDivider />

        <S.NavList $collapsed={isCollapsed} $secondary aria-label="Menu do sistema">
          {secondaryNavigation.map((item) => renderNavItem(item))}
        </S.NavList>
      </S.SidebarScrollArea>

      <S.SidebarFooter>
        {isCollapsed ? (
          <S.FooterCollapsed>
            <SidebarAvatar />
          </S.FooterCollapsed>
        ) : (
          <S.FooterContent>
            <SidebarAvatar />

            <S.FooterText>
              <S.FooterEyebrow>Bem-vindo 👋</S.FooterEyebrow>
              <S.FooterName>Lucas Eduardo</S.FooterName>
            </S.FooterText>

            <ChevronRight size={19} strokeWidth={1.9} />
          </S.FooterContent>
        )}
      </S.SidebarFooter>
    </S.SidebarRoot>
  );
}
