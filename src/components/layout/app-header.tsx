"use client";

import {
  Building2,
  ChevronDown,
  LoaderCircle,
  LogOut,
  Menu,
  Settings,
  UserRound,
} from "lucide-react";
import { useEffect, useRef } from "react";
import { canViewBirthdays } from "@/modules/members/utils/birthday-access";
import { BirthdayNotification } from "./birthday-notification";
import { useFormStatus } from "react-dom";
import { logoutAction, switchChurchAction } from "@/modules/auth/actions/auth.actions";
import { hasPermission, PERMISSIONS } from "@/modules/auth/constants/permissions";
import { getInitials } from "@/utils/person-name";
import { LinkPendingIndicator } from "@/components/navigation/navigation-feedback";
import { ROLE_LABELS, type AuthContext } from "@/modules/auth/types/auth.types";
import * as S from "./app-header.styles";

type AppHeaderProps = {
  title?: string;
  subtitle?: string;
  onOpenSidebar?: () => void;
  authContext: AuthContext;
};

function ChurchSwitchButton({ name, active }: { name: string; active: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      data-active={active}
      data-loading={pending}
      disabled={pending}
      aria-current={active ? "true" : undefined}
    >
      {pending ? <LoaderCircle aria-hidden="true" /> : null}
      <span>{pending ? `Abrindo ${name}...` : name}</span>
    </button>
  );
}

function LogoutButton() {
  const { pending } = useFormStatus();

  return (
    <S.LogoutButton
      type="submit"
      data-loading={pending}
      disabled={pending}
      aria-busy={pending}
    >
      {pending ? <LoaderCircle aria-hidden="true" /> : <LogOut size={16} />}
      {pending ? "Encerrando sessão..." : "Encerrar sessão"}
    </S.LogoutButton>
  );
}

export function AppHeader({ onOpenSidebar, authContext }: AppHeaderProps) {
  const initials = getInitials(authContext.profile.fullName);

  const actions = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function openMenu() {
      return actions.current?.querySelector<HTMLDetailsElement>("details[open]");
    }
    function dismissOutside(event: Event) {
      const menu = openMenu();
      if (menu && event.target instanceof Node && !menu.contains(event.target)) menu.open = false;
    }
    function onKeyDown(event: KeyboardEvent) {
      const menu = openMenu();
      if (event.key === "Escape" && menu) {
        menu.open = false;
        menu.querySelector("summary")?.focus();
      }
    }
    document.addEventListener("pointerdown", dismissOutside, true);
    document.addEventListener("focusin", dismissOutside);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside, true);
      document.removeEventListener("focusin", dismissOutside);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

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

        <S.HeaderActions ref={actions}>
          {canViewBirthdays(authContext) && <BirthdayNotification key={authContext.access.id} />}

          <S.UserMenu name="header-menu" ref={(details) => () => details?.removeAttribute("open")}>
            <summary aria-label="Menu do perfil">
              <S.UserArea>
                <S.UserMeta>
                  <S.UserName>{authContext.profile.displayName}</S.UserName>
                  <S.UserRole>{ROLE_LABELS[authContext.access.role]}</S.UserRole>
                </S.UserMeta>

                <S.UserAvatar>{initials}</S.UserAvatar>
                <ChevronDown size={18} strokeWidth={1.8} color="#637381" />
              </S.UserArea>
              <S.MobileAvatar>{initials}</S.MobileAvatar>
            </summary>

            <S.UserDropdown>
              <S.DropdownIdentity>
                <S.UserAvatar>{initials}</S.UserAvatar>
                <div><strong>{authContext.profile.fullName}</strong><span>{authContext.profile.email}</span></div>
              </S.DropdownIdentity>
              <S.DropdownItem href="/perfil"><UserRound size={16} /> Meu perfil <LinkPendingIndicator /></S.DropdownItem>
              {hasPermission(authContext.permissions, PERMISSIONS.settingsView) && (
                <S.DropdownItem href="/configuracoes">
                  <Settings size={16} aria-hidden="true" /> Configurações <LinkPendingIndicator />
                </S.DropdownItem>
              )}
              {authContext.availableChurches.length > 1 ? (
                <S.ChurchList>
                  <span><Building2 size={14} /> Trocar igreja</span>
                  {authContext.availableChurches.map((church) => (
                    <form key={church.id} action={switchChurchAction}>
                      <input type="hidden" name="churchId" value={church.id} />
                      <ChurchSwitchButton
                        name={church.name}
                        active={church.id === authContext.church.id}
                      />
                    </form>
                  ))}
                </S.ChurchList>
              ) : null}
              <form action={logoutAction}>
                <LogoutButton />
              </form>
            </S.UserDropdown>
          </S.UserMenu>
        </S.HeaderActions>
      </S.HeaderInner>
    </S.HeaderRoot>
  );
}
