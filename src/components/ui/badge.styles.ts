"use client";

import styled, { css } from "styled-components";

export type StyledBadgeVariant = "primary" | "success" | "warning" | "danger" | "neutral";

const badgeVariants = {
  primary: css`
    background: ${({ theme }) => theme.colors.brand.primarySoft};
    color: ${({ theme }) => theme.colors.brand.primary};
  `,
  success: css`
    background: ${({ theme }) => theme.colors.state.successSoft};
    color: ${({ theme }) => theme.colors.state.success};
  `,
  warning: css`
    background: ${({ theme }) => theme.colors.state.warningSoft};
    color: #b98900;
  `,
  danger: css`
    background: ${({ theme }) => theme.colors.state.dangerSoft};
    color: ${({ theme }) => theme.colors.state.danger};
  `,
  neutral: css`
    background: ${({ theme }) => theme.colors.surface.muted};
    color: #475467;
  `,
};

const dotVariants = {
  primary: css`
    background: ${({ theme }) => theme.colors.brand.primary};
  `,
  success: css`
    background: ${({ theme }) => theme.colors.state.success};
  `,
  warning: css`
    background: ${({ theme }) => theme.colors.state.warning};
  `,
  danger: css`
    background: ${({ theme }) => theme.colors.state.danger};
  `,
  neutral: css`
    background: ${({ theme }) => theme.colors.text.muted};
  `,
};

type BadgeProps = {
  $variant: StyledBadgeVariant;
};

export const BadgeRoot = styled.span<BadgeProps>`
  display: inline-flex;
  min-height: 24px;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border-radius: ${({ theme }) => theme.radius.full};
  padding: 0 10px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1;

  ${({ $variant }) => badgeVariants[$variant]}
`;

export const BadgeDot = styled.span<BadgeProps>`
  width: 6px;
  height: 6px;
  border-radius: ${({ theme }) => theme.radius.full};

  ${({ $variant }) => dotVariants[$variant]}
`;
