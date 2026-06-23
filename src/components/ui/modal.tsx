"use client";

import { ReactNode } from "react";
import { CheckCircle2, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import * as S from "./modal.styles";

type ModalSize = S.StyledModalSize;

type ModalProps = {
  open?: boolean;
  title: string;
  description?: string;
  icon?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  onClose?: () => void;
  size?: ModalSize;
  className?: string;
};

export function Modal({
  open = true,
  title,
  description,
  icon,
  children,
  footer,
  onClose,
  size = "md",
  className,
}: ModalProps) {
  if (!open) return null;

  return (
    <S.Overlay>
      <S.Dialog role="dialog" aria-modal="true" $size={size} className={className}>
        <S.Header>
          {icon && <S.IconSlot>{icon}</S.IconSlot>}

          <S.TitleArea>
            <S.Title>{title}</S.Title>
            {description && <S.Description>{description}</S.Description>}
          </S.TitleArea>

          <S.CloseButton type="button" onClick={onClose} aria-label="Fechar modal">
            <X />
          </S.CloseButton>
        </S.Header>

        {children && <S.Body>{children}</S.Body>}
        {footer && <S.Footer>{footer}</S.Footer>}
      </S.Dialog>
    </S.Overlay>
  );
}

type ConfirmModalProps = {
  open?: boolean;
  variant?: "confirm" | "danger";
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onClose?: () => void;
  onConfirm?: () => void;
};

export function ConfirmModal({
  open = true,
  variant = "confirm",
  title = variant === "danger" ? "Confirmação de Delete" : "Confirmação",
  description =
    variant === "danger"
      ? "Tem certeza que deseja excluir, essa ação apagará tudo."
      : "Tem certeza que deseja confirmar esta ação?",
  confirmLabel = variant === "danger" ? "Delete" : "Confirm",
  cancelLabel = "Cancel",
  onClose,
  onConfirm,
}: ConfirmModalProps) {
  const destructive = variant === "danger";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      icon={
        <S.ConfirmIconOuter $destructive={destructive}>
          <S.ConfirmIconInner $destructive={destructive}>
            {destructive ? <Trash2 /> : <CheckCircle2 />}
          </S.ConfirmIconInner>
        </S.ConfirmIconOuter>
      }
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button variant={destructive ? "danger" : "primary"} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}

export function ModalIcon({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <S.ModalIconRoot className={className}>{children}</S.ModalIconRoot>;
}
