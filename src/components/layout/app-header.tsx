"use client";

import {
  Bell,
  ChevronDown,
  Menu,
  MessageCircle,
  Moon,
  SunMedium,
} from "lucide-react";
import * as S from "./app-header.styles";

type AppHeaderProps = {
  title?: string;
  subtitle?: string;
  onOpenSidebar?: () => void;
};

function HeaderIconButton({
  label,
  children,
  hasNotification = false,
}: {
  label: string;
  children: React.ReactNode;
  hasNotification?: boolean;
}) {
  return (
    <S.IconButton type="button" aria-label={label}>
      {children}
      {hasNotification && <S.NotificationDot />}
    </S.IconButton>
  );
}

export function AppHeader({ onOpenSidebar }: AppHeaderProps) {
  return (
    <S.HeaderRoot>
      <S.HeaderInner>
        <S.HeaderLeft>
          <S.MobileMenuButton
            type="button"
            onClick={onOpenSidebar}
            aria-label="Abrir menu"
          >
            <Menu size={20} strokeWidth={1.8} />
          </S.MobileMenuButton>

          <S.Greeting>
            Paz do Senhor, <strong>Secretário</strong> 👋
          </S.Greeting>
        </S.HeaderLeft>

        <S.HeaderActions>
          <S.ThemeToggle type="button" aria-label="Alternar tema">
            <S.ThemeToggleThumb>
              <SunMedium size={15} strokeWidth={1.7} />
            </S.ThemeToggleThumb>
            <S.ThemeToggleIcon>
              <Moon size={14} strokeWidth={1.7} />
            </S.ThemeToggleIcon>
          </S.ThemeToggle>

          <HeaderIconButton label="Mensagens" hasNotification>
            <MessageCircle size={18} strokeWidth={1.7} />
          </HeaderIconButton>

          <HeaderIconButton label="Notificações" hasNotification>
            <Bell size={18} strokeWidth={1.7} />
          </HeaderIconButton>

          <S.UserArea>
            <S.UserMeta>
              <S.UserName>Lucas Eduardo</S.UserName>
              <S.UserRole>Secretário</S.UserRole>
            </S.UserMeta>

            <S.UserAvatar>LE</S.UserAvatar>
            <ChevronDown size={18} strokeWidth={1.8} color="#637381" />
          </S.UserArea>

          <S.MobileAvatar>LE</S.MobileAvatar>
        </S.HeaderActions>
      </S.HeaderInner>
    </S.HeaderRoot>
  );
}
