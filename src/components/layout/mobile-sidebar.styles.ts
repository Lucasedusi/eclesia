"use client";

import styled, { css } from "styled-components";

export const OverlayRoot = styled.div<{ $open: boolean }>`
  position: fixed;
  inset: 0;
  z-index: 50;
  display: block;
  pointer-events: ${({ $open }) => ($open ? "auto" : "none")};

  @media (min-width: 1024px) {
    display: none;
  }
`;

export const Backdrop = styled.button<{ $open: boolean }>`
  position: absolute;
  inset: 0;
  border: 0;
  background: rgba(2, 6, 23, 0.55);
  cursor: pointer;
  opacity: ${({ $open }) => ($open ? 1 : 0)};
  transition: opacity ${({ theme }) => theme.transitions.default};
`;

export const Panel = styled.div<{ $open: boolean }>`
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  transition: transform ${({ theme }) => theme.transitions.default};

  ${({ $open }) =>
    $open
      ? css`
          transform: translateX(0);
        `
      : css`
          transform: translateX(-100%);
        `}
`;

export const PanelInner = styled.div`
  position: relative;
  height: 100%;
`;

export const CloseButton = styled.button`
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 10;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: ${({ theme }) => theme.radius.full};
  color: #ffffff;
  background: #111b31;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
  cursor: pointer;
  transition: background ${({ theme }) => theme.transitions.fast};

  &:hover {
    background: #182643;
  }
`;
