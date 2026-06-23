"use client";

import { CheckCircle2, Info, TriangleAlert, X, XCircle } from "lucide-react";
import * as S from "./toast.styles";

type ToastVariant = S.StyledToastVariant;

type ToastProps = {
  title: string;
  variant?: ToastVariant;
  filled?: boolean;
  className?: string;
};

const icons = {
  success: CheckCircle2,
  danger: XCircle,
  warning: TriangleAlert,
  neutral: Info,
};

export function Toast({
  title,
  variant = "success",
  filled = false,
  className,
}: ToastProps) {
  const Icon = icons[variant];

  return (
    <S.ToastRoot $variant={variant} $filled={filled} className={className}>
      <S.IconSlot $variant={variant} $filled={filled}>
        <Icon />
      </S.IconSlot>
      <S.ToastTitle>{title}</S.ToastTitle>
      <S.CloseIcon>
        <X />
      </S.CloseIcon>
    </S.ToastRoot>
  );
}
