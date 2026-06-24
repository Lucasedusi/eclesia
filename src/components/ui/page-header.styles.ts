"use client";

import styled from "styled-components";

export const PageHeaderRoot = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;

  @media (min-width: 640px) {
    flex-direction: row;
    align-items: center;
  }
`;

export const TitleContent = styled.div``;

export const TitleRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
`;

export const Title = styled.h1`
  color: ${({ theme }) => theme.colors.text.title};
  font-size: 20px;
  font-weight: 600;
  letter-spacing: -0.03em;
`;

export const HeaderBadge = styled.span`
  border-radius: ${({ theme }) => theme.radius.sm};
  background: ${({ theme }) => theme.colors.brand.primarySoft};
  color: ${({ theme }) => theme.colors.brand.primary};
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 600;
`;

export const Subtitle = styled.p`
  color: ${({ theme }) => theme.colors.text.muted};
  margin-top: 4px;
  font-size: 13px;
  font-weight: 500;
  line-height: 24px;
`;

export const ActionSlot = styled.div`
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 8px;
`;
