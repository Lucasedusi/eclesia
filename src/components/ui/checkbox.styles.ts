"use client";

import styled from "styled-components";

export const CheckboxLabel = styled.label`
  display: inline-flex;
  cursor: pointer;
  align-items: center;
  gap: 12px;
  color: #525252;
  font-size: 14px;
  font-weight: 500;
`;

export const HiddenCheckbox = styled.input`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  cursor: pointer;
  appearance: none;
  opacity: 0;
`;

export const CheckboxControl = styled.span`
  display: inline-flex;
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border: 1px solid ${({ theme }) => theme.colors.border.default};
  border-radius: 5px;
  background: ${({ theme }) => theme.colors.surface.card};
  color: transparent;
  transition:
    background ${({ theme }) => theme.transitions.default},
    border-color ${({ theme }) => theme.transitions.default},
    box-shadow ${({ theme }) => theme.transitions.default},
    color ${({ theme }) => theme.transitions.default};

  svg {
    width: 14px;
    height: 14px;
    stroke-width: 2.2;
  }
`;

export const CheckboxFrame = styled.span`
  position: relative;
  display: inline-flex;
  width: 20px;
  height: 20px;
  flex-shrink: 0;

  ${HiddenCheckbox}:checked + ${CheckboxControl} {
    border-color: ${({ theme }) => theme.colors.brand.primary};
    background: ${({ theme }) => theme.colors.brand.primary};
    color: ${({ theme }) => theme.colors.text.inverse};
  }

  ${HiddenCheckbox}:focus-visible + ${CheckboxControl} {
    box-shadow: 0 0 0 3px rgba(65, 91, 165, 0.12);
  }
`;

export const CheckboxText = styled.span``;
