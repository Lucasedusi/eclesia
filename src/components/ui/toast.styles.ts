"use client";

import styled, { css, keyframes } from "styled-components";

export type StyledToastVariant = "success" | "danger" | "warning" | "neutral";

type ToastRootProps = {
  $variant: StyledToastVariant;
  $filled: boolean;
};

const toastBackground = {
  success: css`
    background: ${({ theme }) => theme.colors.state.success};
  `,
  danger: css`
    background: ${({ theme }) => theme.colors.state.dangerHover};
  `,
  warning: css`
    background: ${({ theme }) => theme.colors.state.warning};
  `,
  neutral: css`
    background: ${({ theme }) => theme.colors.brand.primary};
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
  grid-template-columns: 22px minmax(0, 1fr) 28px;
  align-items: start;
  width: 100%;
  column-gap: 10px;
  overflow: hidden;
  border: 0;
  border-radius: 12px;
  padding: 14px;
  color: ${({ theme, $variant }) =>
    $variant === "warning"
      ? theme.colors.text.title
      : theme.colors.text.inverse};
  box-shadow: 0 18px 48px rgba(16, 24, 40, 0.2);
  ${({ $variant }) => toastBackground[$variant]}
  animation: ${toastIn} 180ms cubic-bezier(0.22, 1, 0.36, 1) both;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

export const IconSlot = styled.span<ToastRootProps>`
  display: grid;
  grid-column: 1;
  grid-row: 1;
  align-self: center;
  width: 22px;
  height: 22px;
  place-items: center;
  flex-shrink: 0;
  color: currentColor;

  svg {
    width: 19px;
    height: 19px;
    stroke-width: 2;
  }
`;

export const CloseButton = styled.button`
  display: inline-flex;
  grid-column: 3;
  grid-row: 1;
  align-self: start;
  justify-self: end;
  align-items: center;
  justify-content: center;
  border: 0;
  background: transparent;
  color: currentColor;
  cursor: pointer;
  opacity: 0.72;
  margin: -4px -4px 0 0;
  border-radius: 8px;
  padding: 5px;
  transition:
    background ${({ theme }) => theme.transitions.fast},
    opacity ${({ theme }) => theme.transitions.fast};

  &:hover {
    background: rgba(255, 255, 255, 0.16);
    opacity: 1;
  }

  svg {
    width: 18px;
    height: 18px;
    stroke-width: 1.8;
  }
`;

export const ToastContent = styled.div`
  display: contents;
`;

export const ToastTitle = styled.p`
  grid-column: 2;
  grid-row: 1;
  align-self: center;
  min-width: 0;
  margin: 0;
  font-size: 14px;
  font-weight: 800;
  letter-spacing: -0.01em;
  line-height: 1.35;
`;

export const ToastDescription = styled.p`
  grid-column: 1 / -1;
  grid-row: 2;
  margin: 12px -14px -1px;
  border-top: 1px solid rgba(255, 255, 255, 0.22);
  padding: 12px 14px 0;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.5;
  opacity: 0.94;
`;
