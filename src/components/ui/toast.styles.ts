"use client";

import styled, { css, keyframes } from "styled-components";

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

const iconBackground = {
  success: css`
    background: ${({ theme }) => theme.colors.state.successSoft};
  `,
  danger: css`
    background: ${({ theme }) => theme.colors.state.dangerSoft};
  `,
  warning: css`
    background: ${({ theme }) => theme.colors.state.warningSoft};
  `,
  neutral: css`
    background: ${({ theme }) => theme.colors.state.infoSoft};
  `,
};

const toastIn = keyframes`
  from {
    opacity: 0;
    transform: translate3d(18px, -4px, 0);
  }
  to {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
`;

export const Viewport = styled.div`
  position: fixed;
  z-index: 1200;
  top: 20px;
  right: 20px;
  display: grid;
  width: min(400px, calc(100vw - 40px));
  gap: 12px;
  pointer-events: none;

  > * {
    pointer-events: auto;
  }

  @media (max-width: 640px) {
    top: 12px;
    right: 12px;
    left: 12px;
    width: auto;
  }
`;

export const ToastRoot = styled.div<ToastRootProps>`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: start;
  width: 100%;
  gap: 12px;
  overflow: hidden;
  border-radius: 13px;
  padding: 14px;
  box-shadow: 0 18px 48px rgba(16, 24, 40, 0.18);
  animation: ${toastIn} 180ms cubic-bezier(0.22, 1, 0.36, 1) both;

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

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

export const IconSlot = styled.span<ToastRootProps>`
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  flex-shrink: 0;
  border-radius: 11px;
  color: ${({ theme, $filled }) =>
    $filled ? theme.colors.text.inverse : undefined};

  ${({ $filled, $variant }) =>
    $filled
      ? css`
          background: rgba(255, 255, 255, 0.16);
        `
      : css`
          ${iconColor[$variant]}
          ${iconBackground[$variant]}
        `}

  svg {
    width: 20px;
    height: 20px;
    stroke-width: 2;
  }
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
  margin: -4px -4px 0 0;
  border-radius: 8px;
  padding: 5px;
  transition:
    background ${({ theme }) => theme.transitions.fast},
    opacity ${({ theme }) => theme.transitions.fast};

  &:hover {
    background: rgba(127, 127, 127, 0.11);
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
  min-width: 0;
  align-self: center;
  gap: 3px;
`;

export const ToastTitle = styled.p`
  margin: 0;
  font-size: 14px;
  font-weight: 850;
  letter-spacing: -0.01em;
  line-height: 1.35;
`;

export const ToastDescription = styled.p`
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.45;
  opacity: 0.82;
`;
