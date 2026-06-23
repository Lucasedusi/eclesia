"use client";

import Link from "next/link";
import styled, { css } from "styled-components";

export const SidebarRoot = styled.aside<{ $collapsed: boolean }>`
  width: ${({ $collapsed, theme }) =>
    $collapsed ? theme.layout.sidebarCollapsed : theme.layout.sidebarExpanded};
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: ${({ theme }) => theme.colors.text.inverse};
  background: ${({ theme }) => theme.colors.sidebar.background};
  border-right: 1px solid ${({ theme }) => theme.colors.sidebar.divider};
  transition: width ${({ theme }) => theme.transitions.default};
`;

export const SidebarHeader = styled.div<{ $collapsed: boolean }>`
  position: relative;
  min-height: 104px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 24px;

  ${({ $collapsed }) =>
    $collapsed &&
    css`
      justify-content: center;
      padding: 0;
    `}
`;

export const Brand = styled.div`
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 12px;
`;

export const BrandName = styled.h1`
  min-width: 0;
  margin: 0;
  overflow: hidden;
  color: #ffffff;
  font-size: 20px;
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.02em;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export const LogoWrapper = styled.div<{ $collapsed: boolean }>`
  width: ${({ $collapsed }) => ($collapsed ? "44px" : "40px")};
  height: ${({ $collapsed }) => ($collapsed ? "44px" : "40px")};
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: ${({ theme }) => theme.radius.full};

  svg {
    width: 100%;
    height: 100%;
    display: block;
  }
`;

export const CollapseButton = styled.button`
  position: absolute;
  top: 32px;
  right: -18px;
  z-index: 20;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #e2e8f0;
  border-radius: ${({ theme }) => theme.radius.full};
  color: #ffffff;
  background: #17233b;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.22);
  cursor: pointer;
  transition:
    background ${({ theme }) => theme.transitions.fast},
    transform ${({ theme }) => theme.transitions.fast};

  &:hover {
    background: #24314e;
  }

  &:active {
    transform: scale(0.96);
  }
`;

export const SidebarScrollArea = styled.div`
  flex: 1;
  overflow-x: hidden;
  overflow-y: auto;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
`;

export const NavList = styled.nav<{ $collapsed: boolean; $secondary?: boolean }>`
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: ${({ $collapsed }) => ($collapsed ? "16px 0 0" : "0 24px")};

  ${({ $secondary, $collapsed }) =>
    $secondary &&
    css`
      padding: ${$collapsed ? "0" : "0 24px"};
    `}
`;

export const NavDivider = styled.div`
  width: 100%;
  height: 1px;
  margin: 40px 0;
  background: ${({ theme }) => theme.colors.sidebar.divider};
`;

export const NavItem = styled(Link)<{ $active: boolean; $collapsed: boolean }>`
  position: relative;
  min-width: 0;
  height: ${({ $collapsed }) => ($collapsed ? "52px" : "44px")};
  width: ${({ $collapsed }) => ($collapsed ? "52px" : "100%")};
  margin: ${({ $collapsed }) => ($collapsed ? "0 auto" : "0")};
  display: flex;
  align-items: center;
  justify-content: ${({ $collapsed }) => ($collapsed ? "center" : "flex-start")};
  gap: 16px;
  padding: ${({ $collapsed }) => ($collapsed ? "0" : "0 16px")};
  border-radius: 6px;
  color: ${({ $active, theme }) =>
    $active ? theme.colors.sidebar.itemHover : theme.colors.sidebar.item};
  background: ${({ $active, theme }) =>
    $active ? theme.colors.sidebar.hoverBackground : "transparent"};
  font-size: 15px;
  font-weight: 600;
  line-height: 1;
  text-decoration: none;
  transition:
    color ${({ theme }) => theme.transitions.fast},
    background ${({ theme }) => theme.transitions.fast},
    transform ${({ theme }) => theme.transitions.fast};

  svg {
    color: currentColor;
    transition: color ${({ theme }) => theme.transitions.fast};
  }

  &:hover {
    color: ${({ theme }) => theme.colors.sidebar.itemHover};
    background: ${({ theme }) => theme.colors.sidebar.hoverBackground};
  }

  &:active {
    transform: translateY(1px);
  }
`;

export const IconSlot = styled.span`
  position: relative;
  width: 20px;
  height: 20px;
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
`;

export const Indicator = styled.span`
  position: absolute;
  bottom: -4px;
  left: -4px;
  width: 10px;
  height: 10px;
  border-radius: ${({ theme }) => theme.radius.full};
  background: ${({ theme }) => theme.colors.icon.alert};
  box-shadow: 0 0 0 2px ${({ theme }) => theme.colors.sidebar.background};
`;

export const NavLabel = styled.span`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export const Tooltip = styled.span`
  position: absolute;
  left: calc(100% + 14px);
  z-index: 50;
  padding: 8px 12px;
  border-radius: 10px;
  color: #ffffff;
  background: #020617;
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.28);
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  transform: translateX(-4px);
  transition:
    opacity ${({ theme }) => theme.transitions.fast},
    transform ${({ theme }) => theme.transitions.fast};

  ${NavItem}:hover & {
    opacity: 1;
    transform: translateX(0);
  }
`;

export const SidebarFooter = styled.div`
  border-top: 1px solid ${({ theme }) => theme.colors.sidebar.divider};
  padding: 24px;
`;

export const FooterCollapsed = styled.div`
  display: flex;
  justify-content: center;
`;

export const FooterContent = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

export const FooterText = styled.div`
  min-width: 0;
  flex: 1;
`;

export const FooterEyebrow = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.colors.sidebar.item};
  font-size: 12px;
  font-weight: 700;
  line-height: 1.2;
`;

export const FooterName = styled.p`
  margin: 6px 0 0;
  overflow: hidden;
  color: #ffffff;
  font-size: 14px;
  font-weight: 800;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export const Avatar = styled.div`
  position: relative;
  width: 48px;
  height: 48px;
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: ${({ theme }) => theme.radius.full};
  color: ${({ theme }) => theme.colors.sidebar.background};
  background: #ffb31f;
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.18);
  font-size: 13px;
  font-weight: 900;

  &::before {
    content: "";
    position: absolute;
    top: 4px;
    left: -4px;
    width: 32px;
    height: 28px;
    border-radius: 999px;
    background: #ffe24a;
  }

  &::after {
    content: "";
    position: absolute;
    top: 0;
    right: -4px;
    width: 32px;
    height: 32px;
    border-radius: 999px;
    background: #233c8f;
  }

  span {
    position: relative;
    z-index: 2;
  }
`;
