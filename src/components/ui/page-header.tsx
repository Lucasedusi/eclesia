"use client";

import { ReactNode } from "react";
import * as S from "./page-header.styles";

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  badge?: string;
  action?: ReactNode;
  className?: string;
};

export function PageHeader({
  title,
  subtitle,
  badge,
  action,
  className,
}: PageHeaderProps) {
  return (
    <S.PageHeaderRoot className={className}>
      <S.TitleContent>
        <S.TitleRow>
          <S.Title>{title}</S.Title>
          {badge && <S.HeaderBadge>{badge}</S.HeaderBadge>}
        </S.TitleRow>

        {subtitle && <S.Subtitle>{subtitle}</S.Subtitle>}
      </S.TitleContent>

      {action && <S.ActionSlot>{action}</S.ActionSlot>}
    </S.PageHeaderRoot>
  );
}
