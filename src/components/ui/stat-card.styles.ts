"use client";

import styled from "styled-components";

export const StatCardRoot = styled.article`
  border: 1px solid ${({ theme }) => theme.colors.border.soft};
  border-radius: ${({ theme }) => theme.radius.lg};
  background: ${({ theme }) => theme.colors.surface.card};
  padding: 20px;
  box-shadow: ${({ theme }) => theme.shadows.card};
  transition:
    transform ${({ theme }) => theme.transitions.default},
    box-shadow ${({ theme }) => theme.transitions.default};

  &:hover {
    transform: translateY(-2px);
    box-shadow: ${({ theme }) => theme.shadows.soft};
  }
`;

export const MainRow = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
`;

export const TextArea = styled.div``;

export const StatTitle = styled.p`
  color: ${({ theme }) => theme.colors.text.muted};
  font-size: 14px;
  font-weight: 500;
`;

export const StatValue = styled.h3`
  margin-top: 12px;
  color: ${({ theme }) => theme.colors.text.title};
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.03em;
`;

export const IconBox = styled.div`
  display: flex;
  width: 44px;
  height: 44px;
  align-items: center;
  justify-content: center;
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.colors.brand.primarySoft};
  color: ${({ theme }) => theme.colors.brand.primary};

  svg {
    width: 21px;
    height: 21px;
    stroke-width: 1.7;
  }
`;

export const Footer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 20px;
  border-top: 1px solid ${({ theme }) => theme.colors.border.soft};
  padding-top: 16px;
`;

export const Description = styled.p`
  color: ${({ theme }) => theme.colors.text.muted};
  font-size: 12px;
  font-weight: 500;
`;

export const Variation = styled.span`
  border-radius: ${({ theme }) => theme.radius.full};
  background: ${({ theme }) => theme.colors.surface.muted};
  color: ${({ theme }) => theme.colors.text.muted};
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 600;
`;
