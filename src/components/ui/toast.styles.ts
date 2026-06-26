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
  display: grid;
  width: 100%;
  max-width: 380px;
  gap: 18px;
  border-radius: ${({ theme }) => theme.radius.sm};
  padding: 18px 18px 20px;
  box-shadow: 0 16px 45px rgba(16, 24, 40, 0.16);

  ${({ $variant, $filled }) =>
    $filled
      ? css`
          color: ${({ theme }) => theme.colors.text.inverse};
          ${filledBackground[$variant]}
        `
      : css`
          border: 1px solid ${({ theme }) => theme.colors.border.soft};
          background: ${({ theme }) => theme.colors.surface.card};
          color: ${({ theme }) => theme.colors.text.title};
        `}
`;

export const ToastHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
`;

export const ToastBrand = styled.div`
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
`;

export const IconSlot = styled.span<ToastRootProps>`
  display: inline-flex;
  flex-shrink: 0;
  color: ${({ theme, $filled }) =>
    $filled ? theme.colors.text.inverse : undefined};

  ${({ $filled, $variant }) => !$filled && iconColor[$variant]}

  svg {
    width: 19px;
    height: 19px;
    stroke-width: 1.9;
  }
`;

export const BrandText = styled.strong`
  overflow: hidden;
  font-size: 13px;
  font-weight: 800;
  line-height: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export const ToastMeta = styled.div`
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 10px;
`;

export const TimeText = styled.span`
  font-size: 12px;
  font-weight: 700;
  opacity: 0.9;
`;

export const CloseButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  background: transparent;
  color: currentColor;
  cursor: pointer;
  opacity: 0.8;
  padding: 0;
  transition: opacity ${({ theme }) => theme.transitions.fast};

  &:hover {
    opacity: 1;
  }

  svg {
    width: 18px;
    height: 18px;
    stroke-width: 1.8;
  }
`;

export const ToastContent = styled.div`
  display: grid;
  gap: 6px;
`;

export const ToastTitle = styled.p`
  margin: 0;
  font-size: 14px;
  font-weight: 800;
  letter-spacing: -0.01em;
  line-height: 1.4;
`;

export const ToastDescription = styled.p`
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.5;
  opacity: 0.9;
`;

export const CloseIcon = CloseButton;
