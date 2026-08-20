"use client";

import { type ReactNode, useEffect, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Info, TriangleAlert, X, XCircle } from "lucide-react";
import * as S from "./toast.styles";

type ToastVariant = S.StyledToastVariant;

type ToastProps = {
  title: string;
  description?: string;
  variant?: ToastVariant;
  filled?: boolean;
  className?: string;
  onClose?: () => void;
  duration?: number;
};

type ToastViewportProps = {
  children: ReactNode;
  className?: string;
};

const subscribeToClient = () => () => undefined;
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

const icons = {
  success: CheckCircle2,
  danger: XCircle,
  warning: TriangleAlert,
  neutral: Info,
};

export function Toast({
  title,
  description,
  variant = "success",
  filled = false,
  className,
  onClose,
  duration = 5000,
}: ToastProps) {
  const Icon = icons[variant];
  const closeRef = useRef(onClose);
  const closable = Boolean(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!closable || duration <= 0) return;
    const timer = window.setTimeout(() => closeRef.current?.(), duration);
    return () => window.clearTimeout(timer);
  }, [closable, duration]);

  return (
    <S.ToastRoot
      $variant={variant}
      $filled={filled}
      className={className}
      role={variant === "danger" ? "alert" : "status"}
      aria-live={variant === "danger" ? "assertive" : "polite"}
    >
      <S.IconSlot $variant={variant} $filled={filled} aria-hidden="true">
        <Icon />
      </S.IconSlot>
      <S.ToastContent>
        <S.ToastTitle>{title}</S.ToastTitle>
        {description ? (
          <S.ToastDescription>{description}</S.ToastDescription>
        ) : null}
      </S.ToastContent>
      <S.CloseButton
        type="button"
        aria-label="Fechar notificação"
        onClick={onClose}
      >
        <X />
      </S.CloseButton>
    </S.ToastRoot>
  );
}

export function ToastViewport({ children, className }: ToastViewportProps) {
  const mounted = useSyncExternalStore(
    subscribeToClient,
    getClientSnapshot,
    getServerSnapshot,
  );

  if (!mounted) return null;

  return createPortal(
    <S.Viewport className={className}>{children}</S.Viewport>,
    document.body,
  );
}
