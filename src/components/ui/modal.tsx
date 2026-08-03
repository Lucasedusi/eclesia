"use client";

import { ReactNode, useEffect, useId, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import * as S from "./modal.styles";

const FOCUSABLE_ELEMENTS = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

const subscribeToClient = () => () => undefined;
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

function getFocusableElements(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_ELEMENTS)).filter(
    (element) => element.getClientRects().length > 0 && element.getAttribute("aria-hidden") !== "true",
  );
}

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
  busy?: boolean;
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
  busy = false,
}: ModalProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeHandlerRef = useRef(onClose);
  const busyRef = useRef(busy);
  const titleId = useId();
  const descriptionId = useId();
  const mounted = useSyncExternalStore(
    subscribeToClient,
    getClientSnapshot,
    getServerSnapshot,
  );

  useEffect(() => {
    closeHandlerRef.current = onClose;
    busyRef.current = busy;
  }, [busy, onClose]);

  useEffect(() => {
    if (!open || !mounted) return;

    const appShell = document.querySelector<HTMLElement>("[data-app-shell]");
    const currentBlurCount = Number(appShell?.dataset.modalBlurCount ?? "0");

    if (appShell) {
      appShell.dataset.modalBlurCount = String(currentBlurCount + 1);
      appShell.classList.add("modal-background-blur");
    }

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const body = document.body;
    const root = document.documentElement;
    const previousBodyOverflow = body.style.overflow;
    const previousBodyPaddingRight = body.style.paddingRight;
    const previousRootOverflow = root.style.overflow;
    const scrollbarWidth = window.innerWidth - root.clientWidth;

    root.style.overflow = "hidden";
    body.style.overflow = "hidden";

    if (scrollbarWidth > 0) {
      const currentPadding = Number.parseFloat(window.getComputedStyle(body).paddingRight) || 0;
      body.style.paddingRight = `${currentPadding + scrollbarWidth}px`;
    }

    const frame = window.requestAnimationFrame(() => {
      const target = dialogRef.current?.querySelector<HTMLElement>(
        `[data-autofocus], ${FOCUSABLE_ELEMENTS}`,
      );
      (target ?? dialogRef.current)?.focus();
    });

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (!busyRef.current) closeHandlerRef.current?.();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusableElements = getFocusableElements(dialogRef.current);
      if (focusableElements.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;

      if (event.shiftKey && (activeElement === firstElement || !dialogRef.current.contains(activeElement))) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      if (appShell) {
        const nextBlurCount = Math.max(
          0,
          Number(appShell.dataset.modalBlurCount ?? "1") - 1,
        );

        if (nextBlurCount === 0) {
          delete appShell.dataset.modalBlurCount;
          appShell.classList.remove("modal-background-blur");
        } else {
          appShell.dataset.modalBlurCount = String(nextBlurCount);
        }
      }

      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown);
      root.style.overflow = previousRootOverflow;
      body.style.overflow = previousBodyOverflow;
      body.style.paddingRight = previousBodyPaddingRight;

      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [mounted, open]);

  if (!open || !mounted) return null;

  return createPortal(
    <S.Overlay
      onPointerDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose?.();
      }}
    >
      <S.Dialog
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        $size={size}
        className={className}
      >
        <S.Header>
          {icon && <S.IconSlot>{icon}</S.IconSlot>}

          <S.TitleArea>
            <S.Title id={titleId}>{title}</S.Title>
            {description && <S.Description id={descriptionId}>{description}</S.Description>}
          </S.TitleArea>

          <S.CloseButton type="button" onClick={onClose} aria-label="Fechar modal" disabled={busy}>
            <X />
          </S.CloseButton>
        </S.Header>

        {children && <S.Body>{children}</S.Body>}
        {footer && <S.Footer>{footer}</S.Footer>}
      </S.Dialog>
    </S.Overlay>,
    document.body,
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
