"use client";

import styled, { keyframes } from "styled-components";

export type StyledModalSize = "sm" | "md" | "lg" | "xl";

const modalSizes = {
  sm: "560px",
  md: "640px",
  lg: "760px",
  xl: "980px",
};

type DialogProps = {
  $size: StyledModalSize;
};

type ConfirmIconProps = {
  $destructive: boolean;
};

const overlayIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const dialogIn = keyframes`
  from { opacity: 0; transform: translateY(10px) scale(0.985); }
  to { opacity: 1; transform: translateY(0) scale(1); }
`;

export const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow-y: auto;
  overscroll-behavior: contain;
  background: rgba(7, 14, 27, 0.48);
  padding: 20px;
  animation: ${overlayIn} 180ms ease-out both;

  @media (max-width: 640px) {
    padding: 12px;
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

export const Dialog = styled.section<DialogProps>`
  display: flex;
  width: 100%;
  max-height: calc(100dvh - 40px);
  flex-direction: column;
  overflow: hidden;
  max-width: ${({ $size }) => modalSizes[$size]};
  border-radius: ${({ theme }) => theme.radius.sm};
  background: ${({ theme }) => theme.colors.surface.card};
  padding: 24px;
  box-shadow: ${({ theme }) => theme.shadows.modal};
  outline: none;
  animation: ${dialogIn} 220ms cubic-bezier(0.22, 1, 0.36, 1) both;

  @media (max-width: 640px) {
    max-height: calc(100dvh - 24px);
    padding: 18px;
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

export const Header = styled.div`
  display: flex;
  flex: 0 0 auto;
  align-items: flex-start;
  gap: 16px;
`;

export const IconSlot = styled.div`
  flex-shrink: 0;
  padding: 12px;
  background: ${({ theme }) => theme.colors.state.infoSolfSecundary};
  color: ${({ theme }) => theme.colors.brand.primary};
  border-radius: 10px;
`;

export const TitleArea = styled.div`
  min-width: 0;
  flex: 1;
`;

export const Title = styled.h2`
  color: ${({ theme }) => theme.colors.text.title};
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.02em;
`;

export const Description = styled.p`
  color: ${({ theme }) => theme.colors.text.soft};
  font-size: 13px;
  font-weight: 500;
`;

export const CloseButton = styled.button`
  display: inline-flex;
  width: 36px;
  height: 36px;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: -4px;
  margin-right: -4px;
  border: 0;
  border-radius: ${({ theme }) => theme.radius.sm};
  background: transparent;
  color: #5e6366;
  transition:
    background ${({ theme }) => theme.transitions.default},
    color ${({ theme }) => theme.transitions.default};

  &:hover {
    background: ${({ theme }) => theme.colors.surface.muted};
    color: ${({ theme }) => theme.colors.text.title};
  }

  svg {
    width: 20px;
    height: 20px;
    stroke-width: 1.8;
  }
`;

export const Body = styled.div`
  min-height: 0;
  overflow-y: auto;
  margin-top: 24px;
  padding-right: 4px;

  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-thumb {
    border-radius: 999px;
    background: #d9deea;
  }
`;

export const Footer = styled.div`
  display: flex;
  flex: 0 0 auto;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;

  @media (max-width: 480px) {
    gap: 8px;
  }
`;

export const ConfirmIconOuter = styled.span<ConfirmIconProps>`
  display: flex;
  width: 56px;
  height: 56px;
  align-items: center;
  justify-content: center;
  border-radius: ${({ theme }) => theme.radius.full};
  background: ${({ theme, $destructive }) =>
    $destructive
      ? theme.colors.state.dangerSoft
      : theme.colors.state.successSoft};
`;

export const ConfirmIconInner = styled.span<ConfirmIconProps>`
  display: flex;
  width: 36px;
  height: 36px;
  align-items: center;
  justify-content: center;
  border-radius: ${({ theme }) => theme.radius.full};
  background: ${({ theme }) => theme.colors.surface.card};
  color: ${({ theme, $destructive }) =>
    $destructive ? "#ff2f25" : theme.colors.state.success};

  svg {
    width: ${({ $destructive }) => ($destructive ? "21px" : "22px")};
    height: ${({ $destructive }) => ($destructive ? "21px" : "22px")};
    stroke-width: 1.8;
  }
`;

export const ModalIconRoot = styled.span`
  display: flex;
  width: 56px;
  height: 56px;
  align-items: center;
  justify-content: center;
  border: 1px solid ${({ theme }) => theme.colors.border.soft};
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.colors.surface.card};
  color: #5e6366;
  box-shadow: ${({ theme }) => theme.shadows.card};

  svg {
    width: 24px;
    height: 24px;
    stroke-width: 1.7;
  }
`;
