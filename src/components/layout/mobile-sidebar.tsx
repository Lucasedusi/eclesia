"use client";

import { X } from "lucide-react";
import { AppSidebar } from "./app-sidebar";
import * as S from "./mobile-sidebar.styles";
import type { AuthContext } from "@/modules/auth/types/auth.types";

type MobileSidebarProps = {
  open: boolean;
  onClose: () => void;
  authContext: AuthContext;
};

export function MobileSidebar({ open, onClose, authContext }: MobileSidebarProps) {
  return (
    <S.OverlayRoot $open={open}>
      <S.Backdrop
        type="button"
        $open={open}
        onClick={onClose}
        aria-label="Fechar menu"
      />

      <S.Panel $open={open}>
        <S.PanelInner>
          <S.CloseButton type="button" onClick={onClose} aria-label="Fechar menu">
            <X size={20} strokeWidth={1.8} />
          </S.CloseButton>

          <AppSidebar onNavigate={onClose} mobile authContext={authContext} />
        </S.PanelInner>
      </S.Panel>
    </S.OverlayRoot>
  );
}
