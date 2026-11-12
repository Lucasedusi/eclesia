"use client";

import styled, { keyframes } from "styled-components";

const headerActionSpin = keyframes`
  to { transform: rotate(360deg); }
`;

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
  font-size: calc(14px + var(--eclesia-font-size-adjustment, 0px));
  font-weight: 400;
  line-height: 1;

  strong {
    color: #667085;
    font-weight: 700;
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

export const BellTrigger = styled.summary`
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
  font-size: calc(13px + var(--eclesia-font-size-adjustment, 0px));
  font-weight: 500;
`;

export const UserRole = styled.p`
  margin: 3px 0 0;
  color: #637381;
  font-size: calc(12px + var(--eclesia-font-size-adjustment, 0px));
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
  font-size: calc(13px + var(--eclesia-font-size-adjustment, 0px));
  font-weight: 700;
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

  > summary { cursor: pointer; list-style: none; }
  > summary::-webkit-details-marker { display: none; }
  &[open] > summary .lucide-chevron-down { transform: rotate(180deg); }

`;

export const UserDropdown = styled.div`
  position: absolute;
  top: calc(100% + 13px);
  right: 0;
  z-index: 80;
  width: 290px;
  overflow: hidden;
  border: 1px solid ${({ theme }) => theme.colors.border.soft};
  border-radius: 6px;
  background: #fff;
  padding: 9px;
  box-shadow: 0 20px 55px rgba(16, 24, 40, 0.16);
`;

export const NotificationPanel = styled(UserDropdown)`
  width: min(392px, calc(100vw - 32px));
  padding: 0;
  color: ${({ theme }) => theme.colors.text.body};
  @media (max-width: 640px) { right: -48px; }
  @media (min-width: 641px) and (max-width: 820px) { width: min(392px, 55vw); }

  .notice-heading, li { display: flex; align-items: center; gap: 12px; }
  .notice-heading {
    justify-content: space-between;
    border-bottom: 1px solid var(--border-soft);
    padding: 10px 14px 10px 18px;
  }
  h2 { margin: 0; color: var(--text-title); font-size: 16px; font-weight: 600; }
  .notice-heading button, .notice-whatsapp {
    display: inline-grid;
    flex: none;
    place-items: center;
    width: 40px;
    height: 40px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    cursor: pointer;
  }
  .notice-heading button { color: ${({ theme }) => theme.colors.text.muted}; }
  .notice-heading button:hover:enabled { background: var(--eclesia-primary-soft); }
  .notice-heading button:disabled { opacity: .4; cursor: default; }
  .notice-body { max-height: min(340px, 50dvh); overflow-y: auto; overscroll-behavior: contain; }
  ul { margin: 0; padding: 0; list-style: none; }
  li { padding: 12px 14px 12px 18px; }
  li + li { border-top: 1px solid var(--border-soft); }
  .notice-cake {
    display: grid;
    flex: none;
    place-items: center;
    width: 38px;
    height: 38px;
    border-radius: 50%;
    background: var(--eclesia-primary-soft);
    color: var(--eclesia-primary);
  }
  .notice-person { flex: 1; min-width: 0; overflow-wrap: anywhere; }
  strong, small { display: block; }
  strong { font-size: 14px; font-weight: 600; line-height: 1.35; }
  small, p { color: ${({ theme }) => theme.colors.text.muted}; font-size: 12px; }
  small { margin-top: 3px; }
  p { margin: 0; padding: 18px; }
  .notice-whatsapp { color: #18754e; }
  .notice-whatsapp svg { grid-area: 1 / 1; }
  .notice-whatsapp:hover { background: ${({ theme }) => theme.colors.state.successSoft}; }
  .notice-footer {
    display: block;
    padding: 14px;
    border-top: 1px solid var(--border-soft);
    color: var(--eclesia-primary);
    font-size: 13px;
    font-weight: 600;
    text-align: center;
  }
  .notice-footer:hover { background: var(--eclesia-primary-soft); }
`;

export const DropdownIdentity = styled.div`
  display: flex;
  align-items: center;
  gap: 11px;
  border-bottom: 1px solid #edf0f4;
  padding: 9px 9px 14px;

  > div:last-child { min-width: 0; }
  strong { display: block; overflow: hidden; color: #344054; font-size: calc(12px + var(--eclesia-font-size-adjustment, 0px)); font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
  span { display: block; overflow: hidden; margin-top: 3px; color: #98a2b3; font-size: calc(10px + var(--eclesia-font-size-adjustment, 0px)); font-weight: 500; text-overflow: ellipsis; white-space: nowrap; }
`;

export const DropdownItem = styled.a`
  display: flex;
  min-height: 42px;
  align-items: center;
  gap: 10px;
  border-radius: 6px;
  color: #475467;
  padding: 0 10px;
  font-size: calc(11px + var(--eclesia-font-size-adjustment, 0px));
  font-weight: 600;

  &:hover { background: #f6f8fc; color: ${({ theme }) => theme.colors.brand.primary}; }
`;

export const ChurchList = styled.div`
  border-top: 1px solid #edf0f4;
  border-bottom: 1px solid #edf0f4;
  padding: 9px 0;

  > span { display: flex; align-items: center; gap: 7px; padding: 5px 10px 8px; color: #98a2b3; font-size: calc(9px + var(--eclesia-font-size-adjustment, 0px)); font-weight: 700; text-transform: uppercase; }
  button { display: flex; width: 100%; align-items: center; gap: 7px; border: 0; border-radius: 6px; background: transparent; color: #475467; padding: 8px 10px; text-align: left; font-size: calc(10px + var(--eclesia-font-size-adjustment, 0px)); font-weight: 600; }
  button:hover, button[data-active="true"] { background: #eef2ff; color: ${({ theme }) => theme.colors.brand.primary}; }
  button:disabled { cursor: wait; opacity: .72; }
  button[data-loading="true"] svg { width: 13px; height: 13px; animation: ${headerActionSpin} 720ms linear infinite; }
`;

export const LogoutButton = styled.button`
  display: flex;
  width: 100%;
  min-height: 42px;
  align-items: center;
  gap: 10px;
  margin-top: 5px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #b5423c;
  padding: 0 10px;
  font-size: calc(11px + var(--eclesia-font-size-adjustment, 0px));
  font-weight: 700;

  &:hover { background: #fff0ef; }
  &:disabled { cursor: wait; opacity: .72; }
  &[data-loading="true"] svg { animation: ${headerActionSpin} 720ms linear infinite; }
`;
