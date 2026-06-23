"use client";

import { X } from "lucide-react";
import { AppSidebar } from "./app-sidebar";
import * as S from "./mobile-sidebar.styles";

type MobileSidebarProps = {
  open: boolean;
  onClose: () => void;
};

export function MobileSidebar({ open, onClose }: MobileSidebarProps) {
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

          <AppSidebar onNavigate={onClose} mobile />
        </S.PanelInner>
      </S.Panel>
    </S.OverlayRoot>
  );
}
