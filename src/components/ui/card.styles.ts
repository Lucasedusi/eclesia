"use client";

import styled, { css } from "styled-components";

type CardRootProps = {
  $padded: boolean;
};

type CardHeaderProps = {
  $dark: boolean;
};

export const CardRoot = styled.div<CardRootProps>`
  border: 1px solid ${({ theme }) => theme.colors.border.soft};
  border-radius: ${({ theme }) => theme.radius.lg};
  background: ${({ theme }) => theme.colors.surface.card};
  box-shadow: ${({ theme }) => theme.shadows.card};

  ${({ $padded }) =>
    $padded &&
    css`
      padding: 24px;
    `}
`;

export const CardHeader = styled.div<CardHeaderProps>`
  ${({ $dark, theme }) =>
    $dark
      ? css`
          margin: -24px -24px 24px;
          border-radius: ${theme.radius.lg} ${theme.radius.lg} 0 0;
          background: ${theme.colors.brand.primary};
          color: ${theme.colors.text.inverse};
          padding: 20px 24px;
        `
      : css`
          margin-bottom: 20px;
        `}
`;

export const CardTitle = styled.h2`
  color: ${({ theme }) => theme.colors.text.title};
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.02em;
`;

export const CardDescription = styled.p`
  margin-top: 4px;
  color: ${({ theme }) => theme.colors.text.body};
  font-size: 14px;
  font-weight: 500;
  line-height: 24px;
`;

export const CardContent = styled.div`
  width: 100%;
`;
