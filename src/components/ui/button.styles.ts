"use client";

import styled, { css, keyframes } from "styled-components";

export type StyledButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "danger"
  | "report";

export type StyledButtonSize = "sm" | "md" | "lg";

const spin = keyframes`
  to {
    transform: rotate(360deg);
  }
`;

const buttonSizes = {
  sm: css`
    min-height: 40px;
    padding: 8px 16px;
    font-size: 13px;
  `,
  md: css`
    min-height: 48px;
    padding: 12px 24px;
    font-size: 14px;
  `,
  lg: css`
    min-height: 56px;
    padding: 16px 32px;
    font-size: 15px;
  `,
};

const buttonVariants = {
  primary: css`
    border-color: transparent;
    background: ${({ theme }) => theme.colors.brand.primary};
    color: ${({ theme }) => theme.colors.text.inverse};
    box-shadow: 0 8px 24px rgba(65, 91, 165, 0.12);

    &:hover:not(:disabled) {
      background: ${({ theme }) => theme.colors.brand.primaryHover};
      box-shadow: 0 12px 28px rgba(65, 91, 165, 0.18);
    }
  `,
  secondary: css`
    border-color: transparent;
    background: #f2f2f2;
    color: #5e6366;

    &:hover:not(:disabled) {
      background: #eaecf0;
      color: ${({ theme }) => theme.colors.text.body};
    }
  `,
  outline: css`
    border-color: ${({ theme }) => theme.colors.brand.primary};
    background: ${({ theme }) => theme.colors.surface.card};
    color: ${({ theme }) => theme.colors.brand.primary};

    &:hover:not(:disabled) {
      background: rgba(65, 91, 165, 0.06);
    }
  `,
  ghost: css`
    border-color: transparent;
    background: transparent;
    color: ${({ theme }) => theme.colors.text.muted};

    &:hover:not(:disabled) {
      background: rgba(65, 91, 165, 0.08);
      color: ${({ theme }) => theme.colors.brand.primary};
    }
  `,
  danger: css`
    border-color: transparent;
    background: ${({ theme }) => theme.colors.state.danger};
    color: ${({ theme }) => theme.colors.text.inverse};
    box-shadow: 0 8px 24px rgba(245, 126, 119, 0.14);

    &:hover:not(:disabled) {
      background: ${({ theme }) => theme.colors.state.dangerHover};
      box-shadow: 0 12px 28px rgba(245, 126, 119, 0.2);
    }
  `,
  report: css`
    border-color: transparent;
    background: #f2f2f2;
    color: #5e6366;

    &:hover:not(:disabled) {
      background: #e8e8e8;
      color: #2b2f32;
    }
  `,
};

type ButtonRootProps = {
  $variant: StyledButtonVariant;
  $size: StyledButtonSize;
  $fullWidth: boolean;
};

export const ButtonRoot = styled.button<ButtonRootProps>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  width: ${({ $fullWidth }) => ($fullWidth ? "100%" : "auto")};
  border: 1px solid transparent;
  border-radius: ${({ theme }) => theme.radius.sm};
  font-weight: 700;
  letter-spacing: -0.01em;
  line-height: 1;
  transition:
    background ${({ theme }) => theme.transitions.default},
    border-color ${({ theme }) => theme.transitions.default},
    color ${({ theme }) => theme.transitions.default},
    box-shadow ${({ theme }) => theme.transitions.default},
    transform ${({ theme }) => theme.transitions.fast};

  ${({ $size }) => buttonSizes[$size]}
  ${({ $variant }) => buttonVariants[$variant]}

  svg {
    width: 18px;
    height: 18px;
    stroke-width: 1.7;
  }

  &:active:not(:disabled) {
    transform: translateY(1px);
  }

  &:disabled {
    pointer-events: none;
    opacity: 0.6;
  }
`;

export const LoadingIcon = styled.span`
  display: inline-flex;
  animation: ${spin} 0.8s linear infinite;
`;
