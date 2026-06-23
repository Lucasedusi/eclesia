"use client";

import { LucideIcon } from "lucide-react";
import * as S from "./stat-card.styles";

type StatCardProps = {
  title: string;
  value: string;
  description?: string;
  icon: LucideIcon;
  variation?: string;
  className?: string;
};

export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  variation,
  className,
}: StatCardProps) {
  return (
    <S.StatCardRoot className={className}>
      <S.MainRow>
        <S.TextArea>
          <S.StatTitle>{title}</S.StatTitle>
          <S.StatValue>{value}</S.StatValue>
        </S.TextArea>

        <S.IconBox>
          <Icon />
        </S.IconBox>
      </S.MainRow>

      {(description || variation) && (
        <S.Footer>
          {description && <S.Description>{description}</S.Description>}
          {variation && <S.Variation>{variation}</S.Variation>}
        </S.Footer>
      )}
    </S.StatCardRoot>
  );
}
