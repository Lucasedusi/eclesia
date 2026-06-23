"use client";

import styled, { css } from "styled-components";

type HeaderProps = {
  $dark: boolean;
};

type ProgressProps = {
  $progress: number;
};

export const FormSectionRoot = styled.section`
  overflow: hidden;
  border: 1px solid ${({ theme }) => theme.colors.border.soft};
  border-radius: ${({ theme }) => theme.radius.lg};
  background: ${({ theme }) => theme.colors.surface.card};
  box-shadow: ${({ theme }) => theme.shadows.card};
`;

export const FormSectionHeader = styled.div<HeaderProps>`
  padding: 20px 24px;

  ${({ $dark, theme }) =>
    $dark
      ? css`
          background: ${theme.colors.brand.primary};
          color: ${theme.colors.text.inverse};
        `
      : css`
          background: ${theme.colors.surface.card};
          color: ${theme.colors.text.title};
        `}
`;

export const FormSectionTitle = styled.h2<HeaderProps>`
  color: ${({ theme, $dark }) => ($dark ? theme.colors.text.inverse : theme.colors.text.title)};
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.02em;
`;

export const FormSectionDescription = styled.p<HeaderProps>`
  margin-top: 4px;
  color: ${({ theme, $dark }) => ($dark ? "rgba(255, 255, 255, 0.75)" : theme.colors.text.body)};
  font-size: 14px;
  font-weight: 500;
  line-height: 24px;
`;

export const FormSectionBody = styled.div`
  padding: 24px;
`;

export const FormContainerRoot = styled.section`
  border: 1px solid ${({ theme }) => theme.colors.border.soft};
  border-radius: ${({ theme }) => theme.radius.lg};
  background: ${({ theme }) => theme.colors.surface.card};
  padding: 24px;
  box-shadow: ${({ theme }) => theme.shadows.card};

  @media (min-width: 768px) {
    padding: 32px;
  }
`;

export const FormContainerHeader = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;

  @media (min-width: 768px) {
    flex-direction: row;
    align-items: flex-start;
    justify-content: space-between;
  }
`;

export const FormContainerTitle = styled.h2`
  color: #2b2f32;
  font-size: 24px;
  font-weight: 600;
  letter-spacing: -0.02em;
`;

export const FormContainerDescription = styled.p`
  margin-top: 8px;
  color: ${({ theme }) => theme.colors.text.muted};
  font-size: 14px;
  font-weight: 500;
  line-height: 24px;
`;

export const StepText = styled.p`
  color: ${({ theme }) => theme.colors.text.muted};
  font-size: 14px;
  font-weight: 500;

  span {
    color: ${({ theme }) => theme.colors.brand.primary};
    font-weight: 600;
  }
`;

export const ProgressTrack = styled.div`
  height: 8px;
  overflow: hidden;
  border-radius: ${({ theme }) => theme.radius.full};
  background: rgba(65, 91, 165, 0.14);
  margin-top: 32px;
`;

export const ProgressBar = styled.div<ProgressProps>`
  width: ${({ $progress }) => `${$progress}%`};
  height: 100%;
  border-radius: ${({ theme }) => theme.radius.full};
  background: ${({ theme }) => theme.colors.brand.primary};
  transition: width ${({ theme }) => theme.transitions.default};
`;

export const FormContainerBody = styled.div`
  margin-top: 32px;
`;

export const FormContainerFooter = styled.div`
  display: flex;
  justify-content: center;
  gap: 16px;
  margin-top: 32px;
`;
