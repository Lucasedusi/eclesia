"use client";

import { HTMLAttributes } from "react";
import * as S from "./card.styles";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  padded?: boolean;
};

export function Card({ padded = true, children, ...props }: CardProps) {
  return (
    <S.CardRoot $padded={padded} {...props}>
      {children}
    </S.CardRoot>
  );
}

export function CardHeader({
  children,
  dark = false,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  dark?: boolean;
}) {
  return (
    <S.CardHeader $dark={dark} {...props}>
      {children}
    </S.CardHeader>
  );
}

export function CardTitle({ children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <S.CardTitle {...props}>{children}</S.CardTitle>;
}

export function CardDescription({
  children,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return <S.CardDescription {...props}>{children}</S.CardDescription>;
}

export function CardContent({ children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <S.CardContent {...props}>{children}</S.CardContent>;
}
