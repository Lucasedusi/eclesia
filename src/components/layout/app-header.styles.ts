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
  // height: ${({ theme }) => theme.layout.topbarHeight};
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 28px;

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
  color: #667085;
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
  height: 30px;
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
  border-radius: ${({ theme }) => theme.radius.sm};
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
  font-size: 13px;
  font-weight: 600;
`;

export const UserRole = styled.p`
  margin: 3px 0 0;
  color: #637381;
  font-size: 12px;
  font-weight: 400;
`;

export const UserAvatar = styled.div`
  width: 32px;
  height: 32px;
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

export const UserMenu = styled.details`
  position: relative;

  > summary { list-style: none; }
  > summary::-webkit-details-marker { display: none; }
  &[open] > summary svg:last-child { transform: rotate(180deg); }

  @media (max-width: 640px) { display: none; }
`;

export const UserDropdown = styled.div`
  position: absolute;
  top: calc(100% + 13px);
  right: 0;
  z-index: 80;
  width: 290px;
  overflow: hidden;
  border: 1px solid ${({ theme }) => theme.colors.border.soft};
  border-radius: 14px;
  background: #fff;
  padding: 9px;
  box-shadow: 0 20px 55px rgba(16, 24, 40, 0.16);
`;

export const DropdownIdentity = styled.div`
  display: flex;
  align-items: center;
  gap: 11px;
  border-bottom: 1px solid #edf0f4;
  padding: 9px 9px 14px;

  > div:last-child { min-width: 0; }
  strong { display: block; overflow: hidden; color: #344054; font-size: 12px; font-weight: 850; text-overflow: ellipsis; white-space: nowrap; }
  span { display: block; overflow: hidden; margin-top: 3px; color: #98a2b3; font-size: 10px; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
`;

export const DropdownItem = styled.a`
  display: flex;
  min-height: 42px;
  align-items: center;
  gap: 10px;
  border-radius: 9px;
  color: #475467;
  padding: 0 10px;
  font-size: 11px;
  font-weight: 750;

  &:hover { background: #f6f8fc; color: ${({ theme }) => theme.colors.brand.primary}; }
`;

export const ChurchList = styled.div`
  border-top: 1px solid #edf0f4;
  border-bottom: 1px solid #edf0f4;
  padding: 9px 0;

  > span { display: flex; align-items: center; gap: 7px; padding: 5px 10px 8px; color: #98a2b3; font-size: 9px; font-weight: 800; text-transform: uppercase; }
  button { width: 100%; border: 0; border-radius: 8px; background: transparent; color: #475467; padding: 8px 10px; text-align: left; font-size: 10px; font-weight: 750; }
  button:hover, button[data-active="true"] { background: #eef2ff; color: ${({ theme }) => theme.colors.brand.primary}; }
`;

export const LogoutButton = styled.button`
  display: flex;
  width: 100%;
  min-height: 42px;
  align-items: center;
  gap: 10px;
  margin-top: 5px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: #b5423c;
  padding: 0 10px;
  font-size: 11px;
  font-weight: 800;

  &:hover { background: #fff0ef; }
`;
