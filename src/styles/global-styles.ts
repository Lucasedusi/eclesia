"use client";

import { createGlobalStyle } from "styled-components";

export const GlobalStyles = createGlobalStyle`
  :root {
    --eclesia-primary: ${({ theme }) => theme.colors.brand.primary};
    --eclesia-primary-hover: ${({ theme }) => theme.colors.brand.primaryHover};
    --eclesia-primary-soft: ${({ theme }) => theme.colors.brand.primarySoft};
    --eclesia-sidebar: ${({ theme }) => theme.colors.sidebar.background};
    --eclesia-sidebar-muted: ${({ theme }) => theme.colors.sidebar.item};
    --eclesia-sidebar-hover: ${({ theme }) => theme.colors.sidebar.hoverBackground};

    --background: ${({ theme }) => theme.colors.surface.background};
    --foreground: ${({ theme }) => theme.colors.text.title};
    --card: ${({ theme }) => theme.colors.surface.card};
    --white: #ffffff;

    --text-title: ${({ theme }) => theme.colors.text.title};
    --text-body: ${({ theme }) => theme.colors.text.body};
    --text-muted: ${({ theme }) => theme.colors.text.muted};
    --text-soft: ${({ theme }) => theme.colors.text.soft};
    --border: ${({ theme }) => theme.colors.border.default};
    --border-soft: ${({ theme }) => theme.colors.border.soft};
    --surface-soft: ${({ theme }) => theme.colors.surface.muted};
    --surface-muted: ${({ theme }) => theme.colors.surface.soft};

    --success: ${({ theme }) => theme.colors.state.success};
    --success-soft: ${({ theme }) => theme.colors.state.successSoft};
    --warning: ${({ theme }) => theme.colors.state.warning};
    --warning-soft: ${({ theme }) => theme.colors.state.warningSoft};
    --danger: ${({ theme }) => theme.colors.state.danger};
    --danger-hover: ${({ theme }) => theme.colors.state.dangerHover};
    --danger-soft: ${({ theme }) => theme.colors.state.dangerSoft};
    --info: ${({ theme }) => theme.colors.state.info};
    --info-soft: ${({ theme }) => theme.colors.state.infoSoft};

    --radius-control: ${({ theme }) => theme.radius.sm};
    --radius-card: ${({ theme }) => theme.radius.lg};
    --radius-modal: ${({ theme }) => theme.radius.sm};

    --shadow-soft: ${({ theme }) => theme.shadows.soft};
    --shadow-card: ${({ theme }) => theme.shadows.card};
    --shadow-modal: ${({ theme }) => theme.shadows.modal};
  }

  * {
    box-sizing: border-box;
  }

  html {
    scroll-behavior: smooth;
  }

  body {
    min-height: 100vh;
    background: ${({ theme }) => theme.colors.surface.background};
    color: ${({ theme }) => theme.colors.text.title};
    font-family: ${({ theme }) => theme.font.family};
    font-feature-settings: "cv02", "cv03", "cv04", "cv11";
    text-rendering: optimizeLegibility;
  }

  button,
  input,
  select,
  textarea {
    font: inherit;
  }

  button {
    cursor: pointer;
  }

  button:disabled {
    cursor: not-allowed;
  }

  a {
    color: inherit;
    text-decoration: none;
  }

  ::selection {
    background: rgba(65, 91, 165, 0.16);
    color: ${({ theme }) => theme.colors.brand.primary};
  }
`;
