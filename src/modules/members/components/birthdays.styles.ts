"use client";
import styled from "styled-components";
import { Tab, Tabs } from "@/modules/organization/components/organization.styles";
import { HeaderActionButton, PanelHeader, Toolbar } from "./members.styles";

export const Header = styled(PanelHeader)`
  align-items: center;
  flex-wrap: wrap;
  @media (max-width: 720px) { align-items: stretch; }
`;

export const PeriodActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  @media (max-width: 540px) {
    display: grid;
    width: 100%;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 6px;
  }
`;

export const PeriodTabs = styled(Tabs)`
  && {
    margin: 0;
    padding: 3px;
    gap: 2px;
    box-shadow: none;
    @media (max-width: 540px) { width: 100%; }
  }
`;

export const PeriodTab = styled(Tab)`
  && {
    min-height: 40px;
    justify-content: center;
    padding: 0 12px;
    @media (max-width: 540px) { flex: 1; padding: 0 4px; }
    @media (max-width: 360px) { padding: 0 2px; }
  }
`;

export const ExportButton = styled(HeaderActionButton)`
  &:disabled { opacity: .55; cursor: default; }
  @media (max-width: 540px) {
    && { gap: 4px; padding: 0 7px; }
    .export-verb { display: none; }
  }
`;

export const Filters = styled(Toolbar)<{ $selectCount: number }>`
  && {
    grid-template-columns: minmax(245px, 1.5fr)
      ${({ $selectCount }) => $selectCount ? `repeat(${$selectCount}, minmax(125px, 1fr))` : ""} 44px;

    @media (max-width: 1100px) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      > div:first-child { grid-area: 1 / 1 / 2 / -1; margin-right: 53px; }
      > button { grid-area: 1 / 2 / 2 / -1; }
    }
    @media (max-width: 620px) {
      grid-template-columns: minmax(0, 1fr) 44px;
      > div:first-child { grid-column: 1; margin-right: 0; }
      > button { grid-column: 2; }
      > select { grid-column: 1 / -1; }
    }
  }
`;

export const Contact = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 32px;
  color: ${({ theme }) => theme.colors.brand.primary};
  white-space: nowrap;
  &:hover, &:focus-visible { text-decoration: underline; }
`;
