"use client";

import { ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";
import * as S from "./button.styles";

type ButtonVariant = S.StyledButtonVariant;
type ButtonSize = S.StyledButtonSize;

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
};

export function Button({
  variant = "primary",
  size = "md",
  fullWidth = false,
  loading = false,
  disabled,
  type = "button",
  children,
  ...props
}: ButtonProps) {
  return (
    <S.ButtonRoot
      type={type}
      disabled={disabled || loading}
      $variant={variant}
      $size={size}
      $fullWidth={fullWidth}
      {...props}
    >
      {loading && (
        <S.LoadingIcon aria-hidden="true">
          <Loader2 />
        </S.LoadingIcon>
      )}
      {children}
    </S.ButtonRoot>
  );
}
