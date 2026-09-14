"use client";

import type { ReactNode } from "react";
import * as S from "./organization-details.styles";

type SectionTone = "primary" | "success" | "neutral" | "warning";

type DetailSectionHeadingProps = {
  icon: ReactNode;
  title: string;
  subtitle: string;
  tone?: SectionTone;
};

export function DetailSectionHeading({
  icon,
  title,
  subtitle,
  tone = "primary",
}: DetailSectionHeadingProps) {
  return (
    <S.SectionHeading>
      <S.SectionIcon $tone={tone}>{icon}</S.SectionIcon>
      <div>
        <h3>{title}</h3>
        <p>{subtitle}</p>
      </div>
    </S.SectionHeading>
  );
}
