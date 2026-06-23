"use client";

import styled, { css } from "styled-components";

export type StyledToastVariant = "success" | "danger" | "warning" | "neutral";

type ToastRootProps = {
  $variant: StyledToastVariant;
  $filled: boolean;
};

const filledBackground = {
  success: css`
    background: ${({ theme }) => theme.colors.state.success};
  `,
  danger: css`
    background: ${({ theme }) => theme.colors.state.danger};
  `,
  warning: css`
    background: ${({ theme }) => theme.colors.state.warning};
  `,
  neutral: css`
    background: ${({ theme }) => theme.colors.brand.primary};
  `,
};

const iconColor = {
  success: css`
    color: ${({ theme }) => theme.colors.state.success};
  `,
  danger: css`
    color: ${({ theme }) => theme.colors.state.danger};
  `,
  warning: css`
    color: ${({ theme }) => theme.colors.state.warning};
  `,
  neutral: css`
    color: ${({ theme }) => theme.colors.brand.primary};
  `,
};

export const ToastRoot = styled.div<ToastRootProps>`
  display: flex;
  width: 100%;
  max-width: 353px;
  min-height: 72px;
  align-items: center;
  gap: 16px;
  border-radius: ${({ theme }) => theme.radius.sm};
  padding: 0 20px;
  box-shadow: 0 12px 36px rgba(16, 24, 40, 0.1);

  ${({ $variant, $filled }) =>
    $filled
      ? css`
          color: ${({ theme }) => theme.colors.text.inverse};
          ${filledBackground[$variant]}
        `
      : css`
          background: ${({ theme }) => theme.colors.surface.card};
          color: #171717;
        `}
`;

export const IconSlot = styled.span<ToastRootProps>`
  display: inline-flex;
  flex-shrink: 0;
  color: ${({ theme, $filled }) =>
    $filled ? theme.colors.text.inverse : undefined};

  ${({ $filled, $variant }) => !$filled && iconColor[$variant]}

  svg {
    width: 22px;
    height: 22px;
    stroke-width: 1.9;
  }
`;

export const ToastTitle = styled.p`
  flex: 1;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: -0.01em;
`;

export const CloseIcon = styled.span`
  display: inline-flex;
  flex-shrink: 0;
  opacity: 0.6;

  svg {
    width: 21px;
    height: 21px;
    stroke-width: 1.7;
  }
`;
