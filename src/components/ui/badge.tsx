"use client";

import { HTMLAttributes } from "react";
import * as S from "./badge.styles";

type BadgeVariant = S.StyledBadgeVariant;

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
  dot?: boolean;
};

export function Badge({
  variant = "primary",
  dot = false,
  children,
  ...props
}: BadgeProps) {
  return (
    <S.BadgeRoot $variant={variant} {...props}>
      {dot && <S.BadgeDot $variant={variant} />}
      {children}
    </S.BadgeRoot>
  );
}
