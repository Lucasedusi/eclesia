"use client";

import { CheckCircle2, Info, TriangleAlert, X, XCircle } from "lucide-react";
import * as S from "./toast.styles";

type ToastVariant = S.StyledToastVariant;

type ToastProps = {
  title: string;
  description?: string;
  variant?: ToastVariant;
  filled?: boolean;
  className?: string;
  brandLabel?: string;
  timeLabel?: string;
  onClose?: () => void;
};

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
  brandLabel,
  timeLabel,
  onClose,
}: ToastProps) {
  const Icon = icons[variant];

  return (
    <S.ToastRoot $variant={variant} $filled={filled} className={className}>
      <S.ToastHeader>
        <S.ToastBrand>
          <S.IconSlot $variant={variant} $filled={filled}>
            <Icon />
          </S.IconSlot>
          {brandLabel ? <S.BrandText>{brandLabel}</S.BrandText> : null}
        </S.ToastBrand>

        <S.ToastMeta>
          {timeLabel ? <S.TimeText>{timeLabel}</S.TimeText> : null}
          <S.CloseButton
            type="button"
            aria-label="Fechar notificação"
            onClick={onClose}
          >
            <X />
          </S.CloseButton>
        </S.ToastMeta>
      </S.ToastHeader>

      <S.ToastContent>
        <S.ToastTitle>{title}</S.ToastTitle>
        {description ? (
          <S.ToastDescription>{description}</S.ToastDescription>
        ) : null}
      </S.ToastContent>
    </S.ToastRoot>
  );
}
