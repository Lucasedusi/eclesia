"use client";

import styled from "styled-components";

export const ShellRoot = styled.div`
  min-height: 100vh;
  background: ${({ theme }) => theme.colors.surface.background};
`;

export const DesktopSidebarSlot = styled.div`
  position: fixed;
  inset: 0 auto 0 0;
  z-index: 40;
  display: none;

  @media (min-width: 1024px) {
    display: block;
  }
`;

export const Content = styled.div<{ $collapsed: boolean }>`
  min-height: 100vh;
  transition: padding-left ${({ theme }) => theme.transitions.default};

  @media (min-width: 1024px) {
    padding-left: ${({ $collapsed, theme }) =>
      $collapsed ? theme.layout.sidebarCollapsed : theme.layout.sidebarExpanded};
  }
`;

export const Main = styled.main`
  padding: 24px 16px;

  @media (min-width: 640px) {
    padding: 24px;
  }

  @media (min-width: 1024px) {
    padding: 28px;
  }
`;

export const MainInner = styled.div`
  width: 100%;
  max-width: ${({ theme }) => theme.layout.contentMaxWidth};
  margin: 0 auto;
`;
