"use client";

import styled from "styled-components";

type StepStateProps = {
  $active: boolean;
  $completed: boolean;
};

export const ProgressRoot = styled.aside`
  border: 1px solid ${({ theme }) => theme.colors.border.soft};
  border-radius: 8px;
  background: ${({ theme }) => theme.colors.surface.card};
  padding: 26px;
  box-shadow: ${({ theme }) => theme.shadows.card};
`;

export const ProgressSummary = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
`;

export const ProgressLabel = styled.p`
  color: ${({ theme }) => theme.colors.text.muted};
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
`;

export const ProgressTitle = styled.h2`
  color: ${({ theme }) => theme.colors.text.title};
  font-size: 16px;
  font-weight: 600;
  letter-spacing: -0.03em;
`;

export const ProgressPercent = styled.span`
  display: inline-flex;
  min-width: 58px;
  min-height: 36px;
  align-items: center;
  justify-content: center;
  border-radius: ${({ theme }) => theme.radius.sm};
  background: ${({ theme }) => theme.colors.brand.primarySoft};
  color: ${({ theme }) => theme.colors.brand.primary};
  font-size: 13px;
  font-weight: 800;
`;

export const ProgressTrack = styled.div`
  height: 8px;
  overflow: hidden;
  border-radius: ${({ theme }) => theme.radius.full};
  background: rgba(65, 91, 165, 0.12);
  margin-top: 18px;
`;

export const ProgressBar = styled.div<{ $progress: number }>`
  width: ${({ $progress }) => `${$progress}%`};
  height: 100%;
  border-radius: ${({ theme }) => theme.radius.full};
  background: ${({ theme }) => theme.colors.brand.primary};
  transition: width ${({ theme }) => theme.transitions.default};
`;

export const StepList = styled.ol`
  display: grid;
  gap: 10px;
  margin-top: 20px;
`;

export const StepItem = styled.li<StepStateProps>`
  display: grid;
  grid-template-columns: 42px 1fr;
  gap: 12px;
  align-items: flex-start;
  border-radius: 8px;
  background: ${({ $active, $completed }) =>
    $active ? "rgba(65, 91, 165, 0.08)" : $completed ? "#F8FAFC" : "#FFFFFF"};
  padding: 12px;
  transition:
    background ${({ theme }) => theme.transitions.default},
    border-color ${({ theme }) => theme.transitions.default},
    transform ${({ theme }) => theme.transitions.fast};
`;

export const StepIcon = styled.span<StepStateProps>`
  display: inline-flex;
  width: 42px;
  height: 42px;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: ${({ theme, $active, $completed }) =>
    $active || $completed
      ? theme.colors.brand.primary
      : theme.colors.surface.muted};
  color: ${({ theme, $active, $completed }) =>
    $active || $completed
      ? theme.colors.text.inverse
      : theme.colors.text.muted};

  svg {
    width: 20px;
    height: 20px;
    stroke-width: 1.8;
  }
`;

export const StepContent = styled.div`
  min-width: 0;
`;

export const StepTitle = styled.h3`
  color: ${({ theme }) => theme.colors.text.title};
  font-size: 13px;
  font-weight: 600;
  letter-spacing: -0.02em;
`;

export const StepDescription = styled.p`
  margin-top: 3px;
  color: ${({ theme }) => theme.colors.text.muted};
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
`;
