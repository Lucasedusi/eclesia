"use client";

import styled from "styled-components";

export const FieldWrapper = styled.div`
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

export const FieldLabel = styled.label`
  font-size: 12px;
  font-weight: 400;
  color: ${({ theme }) => theme.colors.text.label};
  line-height: 1.2;
`;

export const InputControl = styled.input<{ $hasError?: boolean }>`
  width: 100%;
  height: 52px;
  border-radius: ${({ theme }) => theme.radius.sm};
  border: 1px solid
    ${({ theme, $hasError }) =>
      $hasError ? "#F57E77" : theme.colors.border.default};
  background: #ffffff;
  padding: 0 14px;
  font-size: 14px;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.text.title};
  outline: none;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    background 0.2s ease;

  &::placeholder {
    color: ${({ theme }) => theme.colors.text.soft};
    font-weight: 300;
  }

  &:focus {
    border-color: ${({ theme, $hasError }) =>
      $hasError ? "#F57E77" : theme.colors.brand.primary};
    background: #ffffff;
    box-shadow: 0 0 0 3px
      ${({ theme, $hasError }) =>
        $hasError ? "rgba(245, 126, 119, 0.14)" : "rgba(65, 91, 165, 0.14)"};
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.65;
    background: #f3f4f6;
  }
`;

export const ErrorText = styled.p`
  margin: 0;
  font-size: 12px;
  font-weight: 500;
  color: #f57e77;
  line-height: 1.4;
`;
