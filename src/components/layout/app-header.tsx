"use client";

import {
  Bell,
  Building2,
  ChevronDown,
  LogOut,
  Menu,
  MessageCircle,
  Moon,
  SunMedium,
  UserRound,
} from "lucide-react";
import { logoutAction, switchChurchAction } from "@/modules/auth/actions/auth.actions";
import { LinkPendingIndicator } from "@/components/navigation/navigation-feedback";
import { ROLE_LABELS, type AuthContext } from "@/modules/auth/types/auth.types";
import * as S from "./app-header.styles";

type AppHeaderProps = {
  title?: string;
  subtitle?: string;
  onOpenSidebar?: () => void;
  authContext: AuthContext;
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

export function AppHeader({ onOpenSidebar, authContext }: AppHeaderProps) {
  const initials =
    authContext.profile.fullName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "US";

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
            Paz do Senhor, <strong>{authContext.profile.displayName}</strong> 👋
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

          <S.UserMenu>
            <summary>
              <S.UserArea>
                <S.UserMeta>
                  <S.UserName>{authContext.profile.displayName}</S.UserName>
                  <S.UserRole>{ROLE_LABELS[authContext.access.role]}</S.UserRole>
                </S.UserMeta>

                <S.UserAvatar>{initials}</S.UserAvatar>
                <ChevronDown size={18} strokeWidth={1.8} color="#637381" />
              </S.UserArea>
            </summary>

            <S.UserDropdown>
              <S.DropdownIdentity>
                <S.UserAvatar>{initials}</S.UserAvatar>
                <div><strong>{authContext.profile.fullName}</strong><span>{authContext.profile.email}</span></div>
              </S.DropdownIdentity>
              <S.DropdownItem href="/perfil"><UserRound size={16} /> Meu perfil <LinkPendingIndicator /></S.DropdownItem>
              {authContext.availableChurches.length > 1 ? (
                <S.ChurchList>
                  <span><Building2 size={14} /> Trocar igreja</span>
                  {authContext.availableChurches.map((church) => (
                    <form key={church.id} action={switchChurchAction} data-navigation-form="true">
                      <input type="hidden" name="churchId" value={church.id} />
                      <button type="submit" data-active={church.id === authContext.church.id}>{church.name}</button>
                    </form>
                  ))}
                </S.ChurchList>
              ) : null}
              <form action={logoutAction} data-navigation-form="true">
                <S.LogoutButton type="submit"><LogOut size={16} /> Encerrar sessão</S.LogoutButton>
              </form>
            </S.UserDropdown>
          </S.UserMenu>

          <S.MobileAvatar>{initials}</S.MobileAvatar>
        </S.HeaderActions>
      </S.HeaderInner>
    </S.HeaderRoot>
  );
}
