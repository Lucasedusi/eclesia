"use client";

import styled from "styled-components";

export const HeaderRoot = styled.header`
  position: sticky;
  top: 0;
  z-index: 30;
  background: #ffffff;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border.soft};
`;

export const HeaderInner = styled.div`
  height: ${({ theme }) => theme.layout.topbarHeight};
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 0 28px;

  @media (max-width: 640px) {
    padding: 0 16px;
  }
`;

export const HeaderLeft = styled.div`
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 12px;
`;

export const MobileMenuButton = styled.button`
  width: 40px;
  height: 40px;
  display: none;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: ${({ theme }) => theme.radius.sm};
  color: #637381;
  background: #f2f4f7;
  cursor: pointer;
  transition:
    color ${({ theme }) => theme.transitions.fast},
    background ${({ theme }) => theme.transitions.fast};

  &:hover {
    color: ${({ theme }) => theme.colors.brand.primary};
    background: ${({ theme }) => theme.colors.brand.primarySoft};
  }

  @media (max-width: 1023px) {
    display: flex;
  }
`;

export const Greeting = styled.p`
  margin: 0;
  color: #;
  font-size: 14px;
  font-weight: 500;
  line-height: 1;

  strong {
    color: #667085;
    font-weight: 800;
  }

  @media (max-width: 640px) {
    display: none;
  }
`;

export const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;

  @media (max-width: 640px) {
    gap: 8px;
  }
`;

export const ThemeToggle = styled.button`
  width: 56px;
  height: 34px;
  display: flex;
  align-items: center;
  padding: 4px;
  border: 0;
  border-radius: ${({ theme }) => theme.radius.full};
  color: #98a2b3;
  background: #e2e8f0;
  cursor: pointer;
  transition: background ${({ theme }) => theme.transitions.fast};

  &:hover {
    background: #d8dee8;
  }

  @media (max-width: 767px) {
    display: none;
  }
`;

export const ThemeToggleThumb = styled.span`
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: ${({ theme }) => theme.radius.full};
  color: #637381;
  background: #ffffff;
  box-shadow: 0 1px 4px rgba(16, 24, 40, 0.14);
`;

export const ThemeToggleIcon = styled.span`
  margin-left: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

export const IconButton = styled.button`
  position: relative;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: ${({ theme }) => theme.radius.full};
  color: #637381;
  background: transparent;
  cursor: pointer;
  transition:
    color ${({ theme }) => theme.transitions.fast},
    background ${({ theme }) => theme.transitions.fast};

  &:hover {
    color: ${({ theme }) => theme.colors.brand.primary};
    background: #f2f4f7;
  }
`;

export const NotificationDot = styled.span`
  position: absolute;
  top: 6px;
  right: 6px;
  width: 8px;
  height: 8px;
  border-radius: ${({ theme }) => theme.radius.full};
  background: #dc3545;
  box-shadow: 0 0 0 2px #ffffff;
`;

export const UserArea = styled.div`
  margin-left: 4px;
  padding-left: 12px;
  display: flex;
  align-items: center;
  gap: 12px;

  @media (max-width: 640px) {
    display: none;
  }
`;

export const UserMeta = styled.div`
  text-align: right;
  line-height: 1.1;

  @media (max-width: 767px) {
    display: none;
  }
`;

export const UserName = styled.p`
  margin: 0;
  color: #212b36;
  font-size: 14px;
  font-weight: 800;
`;

export const UserRole = styled.p`
  margin: 6px 0 0;
  color: #637381;
  font-size: 12px;
  font-weight: 500;
`;

export const UserAvatar = styled.div`
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: ${({ theme }) => theme.radius.full};
  color: ${({ theme }) => theme.colors.sidebar.background};
  background: #ffce34;
  box-shadow: 0 0 0 4px #f2f4f7;
  font-size: 13px;
  font-weight: 800;
`;

export const MobileAvatar = styled(UserAvatar)`
  width: 40px;
  height: 40px;
  box-shadow: none;

  @media (min-width: 641px) {
    display: none;
  }
`;
