"use client";

import styled from "styled-components";

export type StyledModalSize = "sm" | "md" | "lg";

const modalSizes = {
  sm: "560px",
  md: "640px",
  lg: "760px",
};

type DialogProps = {
  $size: StyledModalSize;
};

type ConfirmIconProps = {
  $destructive: boolean;
};

export const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(16, 24, 40, 0.4);
  padding: 16px;
  backdrop-filter: blur(2px);
`;

export const Dialog = styled.section<DialogProps>`
  width: 100%;
  max-width: ${({ $size }) => modalSizes[$size]};
  border-radius: ${({ theme }) => theme.radius.sm};
  background: ${({ theme }) => theme.colors.surface.card};
  padding: 24px;
  box-shadow: ${({ theme }) => theme.shadows.modal};
`;

export const Header = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 16px;
`;

export const IconSlot = styled.div`
  flex-shrink: 0;
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
  margin-top: 4px;
  color: ${({ theme }) => theme.colors.text.body};
  font-size: 14px;
  font-weight: 500;
  line-height: 24px;
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
  margin-top: 24px;
`;

export const Footer = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
`;

export const ConfirmIconOuter = styled.span<ConfirmIconProps>`
  display: flex;
  width: 56px;
  height: 56px;
  align-items: center;
  justify-content: center;
  border-radius: ${({ theme }) => theme.radius.full};
  background: ${({ theme, $destructive }) =>
    $destructive ? theme.colors.state.dangerSoft : theme.colors.state.successSoft};
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
