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

  .app-navigation-progress {
    position: fixed;
    inset: 0 0 auto;
    z-index: 10000;
    height: 3px;
    overflow: hidden;
    opacity: 0;
    pointer-events: none;
  }

  .app-navigation-progress[data-visible="true"] {
    animation: eclesia-navigation-reveal 1ms linear 120ms forwards;
  }

  .app-navigation-progress > span {
    display: block;
    width: 38%;
    height: 100%;
    border-radius: 0 999px 999px 0;
    background: linear-gradient(90deg, #6c82da, ${({ theme }) => theme.colors.brand.primary}, #8ea0f2);
    box-shadow: 0 1px 8px rgba(65, 91, 165, 0.34);
    transform: translateX(-110%);
  }

  .app-navigation-progress[data-visible="true"] > span {
    animation: eclesia-navigation-run 1.15s ease-in-out 120ms infinite;
  }

  .app-link-pending {
    width: 16px;
    height: 16px;
    flex: 0 0 16px;
    display: inline-grid;
    place-items: center;
    opacity: 0;
    visibility: hidden;
  }

  .app-link-pending svg {
    width: 14px;
    height: 14px;
  }

  .app-link-pending[data-pending="true"] {
    visibility: visible;
    animation: eclesia-pending-reveal 160ms ease 100ms forwards;
  }

  .app-link-pending[data-pending="true"] svg {
    animation: eclesia-spin 720ms linear infinite;
  }

  .app-page-skeleton {
    display: grid;
    gap: 18px;
  }

  .app-skeleton-block {
    position: relative;
    display: block;
    overflow: hidden;
    border-radius: 12px;
    background: #e9edf3;
  }

  .app-skeleton-block::after {
    position: absolute;
    inset: 0;
    content: "";
    background: linear-gradient(100deg, transparent 20%, rgba(255, 255, 255, 0.72) 50%, transparent 80%);
    transform: translateX(-100%);
    animation: eclesia-skeleton 1.35s ease-in-out infinite;
  }

  .app-skeleton-heading {
    min-height: 88px;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 20px;
    padding: 10px 0;
  }

  .app-skeleton-heading > div { flex: 1; }
  .app-skeleton-title { width: min(260px, 70%); height: 24px; }
  .app-skeleton-subtitle { width: min(520px, 90%); height: 13px; margin-top: 12px; }
  .app-skeleton-action { width: 148px; height: 46px; }

  .app-skeleton-stats {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 12px;
  }

  .app-skeleton-stat { height: 72px; }
  .app-skeleton-panel { display: grid; gap: 1px; overflow: hidden; border: 1px solid #e2e6ed; border-radius: 18px; background: #fff; padding: 18px; }
  .app-skeleton-toolbar { height: 48px; margin-bottom: 8px; }
  .app-skeleton-row { height: 52px; border-radius: 8px; }

  .app-skeleton-form {
    display: grid;
    grid-template-columns: 250px minmax(0, 1fr);
    gap: 20px;
  }

  .app-skeleton-form > aside,
  .app-skeleton-fields {
    display: grid;
    align-content: start;
    gap: 14px;
    border: 1px solid #e2e6ed;
    border-radius: 18px;
    background: #fff;
    padding: 22px;
  }

  .app-skeleton-step { height: 44px; }
  .app-skeleton-fields { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .app-skeleton-section-title { grid-column: 1 / -1; width: 180px; height: 21px; }
  .app-skeleton-field { height: 66px; }

  .app-skeleton-dashboard-grid { display: grid; grid-template-columns: 1.35fr .65fr; gap: 18px; }
  .app-skeleton-chart { height: 330px; }
  .app-skeleton-details { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
  .app-skeleton-details > span { height: 210px; }

  .app-shell-skeleton {
    min-height: 100vh;
    display: grid;
    grid-template-columns: ${({ theme }) => theme.layout.sidebarExpanded} minmax(0, 1fr);
    background: ${({ theme }) => theme.colors.surface.background};
  }

  .app-shell-skeleton > aside {
    display: grid;
    align-content: start;
    gap: 13px;
    background: ${({ theme }) => theme.colors.sidebar.background};
    padding: 30px 24px;
  }

  .app-shell-skeleton-logo { width: 126px; height: 42px; margin-bottom: 28px; background: rgba(255, 255, 255, .14); }
  .app-shell-skeleton-link { height: 43px; background: rgba(255, 255, 255, .08); }
  .app-shell-skeleton > div > header { height: 78px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #eaecf0; background: #fff; padding: 0 28px; }
  .app-shell-skeleton-greeting { width: 190px; height: 16px; }
  .app-shell-skeleton-avatar { width: 40px; height: 40px; border-radius: 50%; }
  .app-shell-skeleton main { padding: 28px; }

  @keyframes eclesia-navigation-reveal { to { opacity: 1; } }
  @keyframes eclesia-navigation-run {
    0% { transform: translateX(-110%); }
    55% { transform: translateX(135%); }
    100% { transform: translateX(310%); }
  }
  @keyframes eclesia-pending-reveal { to { opacity: .82; } }
  @keyframes eclesia-spin { to { transform: rotate(360deg); } }
  @keyframes eclesia-skeleton { to { transform: translateX(100%); } }

  @media (max-width: 1050px) {
    .app-skeleton-stats { grid-template-columns: repeat(3, 1fr); }
  }

  @media (max-width: 1023px) {
    .app-shell-skeleton { grid-template-columns: 1fr; }
    .app-shell-skeleton > aside { display: none; }
  }

  @media (max-width: 720px) {
    .app-skeleton-heading { min-height: 72px; }
    .app-skeleton-action { width: 46px; }
    .app-skeleton-stats { grid-template-columns: repeat(2, 1fr); }
    .app-skeleton-form { grid-template-columns: 1fr; }
    .app-skeleton-form > aside { display: none; }
    .app-skeleton-fields { grid-template-columns: 1fr; }
    .app-skeleton-dashboard-grid,
    .app-skeleton-details { grid-template-columns: 1fr; }
    .app-skeleton-chart { height: 230px; }
    .app-shell-skeleton main { padding: 20px 16px; }
  }

  @media (prefers-reduced-motion: reduce) {
    html { scroll-behavior: auto; }
    .app-navigation-progress[data-visible="true"] { animation-delay: 0ms; }
    .app-navigation-progress[data-visible="true"] > span,
    .app-link-pending[data-pending="true"] svg,
    .app-skeleton-block::after { animation: none; }
    .app-navigation-progress[data-visible="true"] > span { transform: translateX(65%); }
    .app-link-pending[data-pending="true"] { opacity: .82; animation: none; }
  }
`;
