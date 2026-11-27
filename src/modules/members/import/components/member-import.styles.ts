"use client";

import { PickerSelect } from "@/components/form/pickers/picker-select";
import styled, { css, keyframes } from "styled-components";
import * as P from "../../components/member-create-form/member-form-progress.styles";

const enter = keyframes`
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
`;

export const Module = styled.div`
  display: grid;
  gap: 18px;
  animation: ${enter} 220ms ease both;
`;

export const Tabs = styled.div`
  display: inline-flex;
  width: fit-content;
  gap: 4px;
  border: 1px solid #e4e8ef;
  border-radius: 6px;
  background: #fff;
  padding: 4px;
`;

export const Tab = styled.button<{ $active?: boolean }>`
  display: inline-flex;
  min-height: 38px;
  align-items: center;
  gap: 8px;
  border: 0;
  border-radius: 6px;
  background: ${({ $active, theme }) =>
    $active ? theme.colors.brand.primary : "transparent"};
  padding: 0 14px;
  color: ${({ $active }) => ($active ? "#fff" : "#667085")};
  font-size: calc(11px + var(--eclesia-font-size-adjustment, 0px));
  font-weight: 700;
  cursor: pointer;
  &:hover {
    background: ${({ $active }) => ($active ? undefined : "#f4f6fa")};
  }
  &:focus-visible {
    outline: 0;
    box-shadow: ${({ theme }) => theme.shadows.focus};
  }
`;

export const WorkflowLayout = styled.div<{ $review: boolean }>`
  display: grid;
  gap: 20px;

  @media (min-width: 1180px) {
    grid-template-columns: ${({ $review }) => $review ? "minmax(0, 1fr)" : "minmax(280px, 360px) minmax(0, 1fr)"};
    align-items: flex-start;
  }

  ${({ $review }) => $review && css`
    @media (min-width: 850px) {
      ${P.StepList} { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    }
  `}
`;

export const WorkflowContent = styled.div`
  min-width: 0;
`;

export const StepIndicator = styled(P.StepButton)`
  cursor: default;
  pointer-events: none;
`;

export const Card = styled.section`
  min-width: 0;
  container-type: inline-size;
  overflow: hidden;
  border: 1px solid ${({ theme }) => theme.colors.border.soft};
  border-radius: 6px;
  background: #fff;
  box-shadow: ${({ theme }) => theme.shadows.card};
`;

export const CardHeader = styled.header`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  border-bottom: 1px solid #edf0f4;
  padding: 20px 22px;
  h2 {
    margin: 0;
    color: #101828;
    font-size: calc(16px + var(--eclesia-font-size-adjustment, 0px));
    font-weight: 700;
  }
  p {
    margin: 5px 0 0;
    color: #667085;
    font-size: calc(11px + var(--eclesia-font-size-adjustment, 0px));
    line-height: 1.55;
  }
  > div:last-child {
    display: flex;
    gap: 8px;
  }
  @media (max-width: 700px) {
    flex-direction: column;
    > div:last-child {
      width: 100%;
      flex-wrap: wrap;
    }
  }
`;

export const CardBody = styled.div`
  display: grid;
  gap: 18px;
  padding: 22px;
`;

export const Field = styled.label`
  display: grid;
  gap: 7px;
  > span {
    color: #475467;
    font-size: calc(10px + var(--eclesia-font-size-adjustment, 0px));
    font-weight: 700;
  }
  > small {
    color: #98a2b3;
    font-size: calc(9px + var(--eclesia-font-size-adjustment, 0px));
    line-height: 1.5;
  }
`;

export const Select = styled(PickerSelect)`
  width: 100%;
  min-height: 44px;
  border: 1px solid #d7dde8;
  border-radius: 6px;
  outline: 0;
  background: #f8f9fc;
  padding: 0 12px;
  color: #344054;
  font-size: calc(11px + var(--eclesia-font-size-adjustment, 0px));
  font-weight: 600;
  &:focus {
    border-color: ${({ theme }) => theme.colors.brand.primary};
    background: #fff;
    box-shadow: ${({ theme }) => theme.shadows.focus};
  }
`;

export const Dropzone = styled.label<{ $dragging?: boolean }>`
  display: grid;
  min-height: 220px;
  place-items: center;
  border: 2px dashed
    ${({ $dragging, theme }) =>
      $dragging ? theme.colors.brand.primary : "#cfd6e2"};
  border-radius: 6px;
  background: ${({ $dragging }) => ($dragging ? "#f2f5ff" : "#fafbfc")};
  padding: 30px;
  text-align: center;
  cursor: pointer;
  transition: 160ms ease;
  &:hover {
    border-color: ${({ theme }) => theme.colors.brand.primary};
    background: #f7f8ff;
  }
  &:focus-within {
    box-shadow: ${({ theme }) => theme.shadows.focus};
  }
  input {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    opacity: 0;
  }
  div {
    display: grid;
    justify-items: center;
    gap: 6px;
  }
  svg {
    width: 34px;
    height: 34px;
    color: ${({ theme }) => theme.colors.brand.primary};
  }
  strong {
    display: block;
    margin-top: 13px;
    color: #101828;
    font-size: calc(13px + var(--eclesia-font-size-adjustment, 0px));
  }
  p {
    margin: 6px 0 0;
    color: #667085;
    font-size: calc(10px + var(--eclesia-font-size-adjustment, 0px));
  }
  small {
    display: block;
    margin-top: 9px;
    color: #98a2b3;
    font-size: calc(9px + var(--eclesia-font-size-adjustment, 0px));
  }
`;

export const FileSelected = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border: 1px solid #dce2eb;
  border-radius: 6px;
  background: #fff;
  padding: 12px 14px;
  > div {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 10px;
  }
  svg {
    flex: 0 0 auto;
    color: #25805d;
  }
  strong {
    display: block;
    overflow: hidden;
    color: #344054;
    font-size: calc(10px + var(--eclesia-font-size-adjustment, 0px));
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  small {
    display: block;
    margin-top: 3px;
    color: #98a2b3;
    font-size: calc(9px + var(--eclesia-font-size-adjustment, 0px));
  }
  button {
    border: 0;
    background: transparent;
    color: #98a2b3;
    cursor: pointer;
  }
`;

export const InlineActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 9px;
`;

export const Footer = styled.footer`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  border-top: 1px solid #edf0f4;
  background: #fbfcfd;
  padding: 15px 22px;
  > div {
    display: flex;
    align-items: center;
    gap: 9px;
  }
  @container (max-width: 620px) {
    align-items: stretch;
    flex-direction: column;
    > div {
      width: 100%;
      flex-wrap: wrap;
    }
    > div > * {
      flex: 1;
    }
  }
`;

export const Stats = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(126px, 100%), 1fr));
  gap: 10px;
  @container (min-width: 640px) {
    grid-template-columns: none;
    grid-auto-flow: column;
    grid-auto-columns: minmax(0, 1fr);
  }
`;

const metricColors = {
  neutral: { ink: "#415ba5", background: "#edf1fa" },
  success: { ink: "#237458", background: "#eaf6f0" },
  warning: { ink: "#956018", background: "#fff3dd" },
  danger: { ink: "#aa4741", background: "#fbeceb" },
  muted: { ink: "#596579", background: "#eef1f5" },
};
export type MetricTone = keyof typeof metricColors;

export const Stat = styled.article<{ $tone: MetricTone }>`
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
  border: 1px solid #cccccc96;
  border-radius: 6px;
  background: #fff;
  padding: 12px;
  @container (min-width: 640px) and (max-width: 760px) {
    gap: 7px;
    padding: 10px 8px;
  }
  > span {
    display: grid;
    flex: 0 0 32px;
    height: 32px;
    place-items: center;
    border-radius: 8px;
    color: ${({ $tone }) => metricColors[$tone].ink};
    background: ${({ $tone }) => metricColors[$tone].background};
  }
  svg { width: 17px; height: 17px; }
  strong, small { display: block; }
  strong {
    color: #344054;
    line-height: 1.15;
    font-size: calc(19px + var(--eclesia-font-size-adjustment, 0px));
    font-variant-numeric: tabular-nums;
  }
  small {
    margin-top: 3px;
    color: #596579;
    font-size: calc(11px + var(--eclesia-font-size-adjustment, 0px));
    line-height: 1.3;
  }
`;

export const InfoGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  @media (max-width: 700px) {
    grid-template-columns: 1fr;
  }
`;

export const InfoBox = styled.div<{
  $tone?: "info" | "warning" | "danger" | "success";
}>`
  border: 1px solid
    ${({ $tone }) =>
      $tone === "danger"
        ? "#f1c5c2"
        : $tone === "warning"
          ? "#eed9b9"
          : $tone === "success"
            ? "#bfe2d2"
            : "#d9e0ee"};
  border-radius: 6px;
  background: ${({ $tone }) =>
    $tone === "danger"
      ? "#fff7f6"
      : $tone === "warning"
        ? "#fffbf4"
        : $tone === "success"
          ? "#f4fbf8"
          : "#f8faff"};
  padding: 14px;
  color: #475467;
  font-size: calc(10px + var(--eclesia-font-size-adjustment, 0px));
  line-height: 1.55;
  h3 {
    margin: 0 0 7px;
    color: #344054;
    font-size: calc(11px + var(--eclesia-font-size-adjustment, 0px));
  }
  ul {
    margin: 0;
    padding-left: 17px;
  }
`;

export const Status = styled.span<{ $status: string }>`
  display: inline-flex;
  width: fit-content;
  align-items: center;
  gap: 5px;
  border-radius: 6px;
  background: ${({ $status }) =>
    ["VALID", "READY", "COMPLETED", "IMPORTED"].includes($status)
      ? "#eaf8f1"
      : ["WARNING", "REVIEW", "FAILED"].includes($status)
        ? "#fff4df"
        : $status === "ERROR"
          ? "#fff0ef"
          : "#f0f2f5"};
  padding: 5px 8px;
  color: ${({ $status }) =>
    ["VALID", "READY", "COMPLETED", "IMPORTED"].includes($status)
      ? "#237458"
      : ["WARNING", "REVIEW", "FAILED"].includes($status)
        ? "#9c5c18"
        : $status === "ERROR"
          ? "#b6423e"
          : "#667085"};
  font-size: calc(8px + var(--eclesia-font-size-adjustment, 0px));
  font-weight: 700;
  text-transform: uppercase;
`;

export const Toolbar = styled.div`
  display: grid;
  grid-template-columns: minmax(160px, 300px) minmax(180px, 240px) minmax(150px, 180px);
  gap: 12px;
  border-bottom: 1px solid #edf0f4;
  background: #fbfcfd;
  padding: 14px 20px;
  @container (max-width: 620px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    > :first-child { grid-column: 1 / -1; }
  }
  @container (max-width: 420px) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

export const Search = styled.label`
  position: relative;
  display: block;
  svg {
    position: absolute;
    top: 50%;
    left: 12px;
    width: 16px;
    color: #98a2b3;
    transform: translateY(-50%);
  }
  input {
    width: 100%;
    min-height: 44px;
    border: 1px solid #d7dde8;
    border-radius: 6px;
    outline: 0;
    background: #fff;
    padding: 0 12px 0 38px;
    color: #344054;
    font-size: calc(11px + var(--eclesia-font-size-adjustment, 0px));
    &:focus {
      border-color: ${({ theme }) => theme.colors.brand.primary};
      box-shadow: ${({ theme }) => theme.shadows.focus};
    }
  }
`;

export const TableWrap = styled.div`
  width: 100%;
`;
export const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  th, td { padding: 14px 12px; text-align: left; }
  th {
    border-bottom: 1px solid #dce2ea;
    background: #f7f9fc;
    color: #526074;
    font-size: calc(11px + var(--eclesia-font-size-adjustment, 0px));
    font-weight: 650;
  }
  th:first-child { width: 10%; }
  th:nth-child(2) { width: 25%; }
  th:nth-child(3) { width: 21%; }
  th:nth-child(4) { width: 14%; }
  th:last-child { width: 8%; }
  td {
    border-bottom: 1px solid #e8ebf0;
    color: #475467;
    font-size: calc(12px + var(--eclesia-font-size-adjustment, 0px));
    line-height: 1.45;
    overflow-wrap: anywhere;
    vertical-align: top;
  }
  td:last-child, th:last-child { text-align: center; }
  td:last-child > button { margin-inline: auto; }
  tr:last-child td { border-bottom: 0; }
  strong { color: #243047; }
  small { display: block; margin-top: 3px; color: #667085; font-size: inherit; }
  td > small:first-child { margin-top: 0; }
  @container (max-width: 759px) {
    &, tbody { display: block; }
    thead {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
    }
    tbody { padding: 12px; }
    tr {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 10px 16px;
      border: 1px solid #e1e5eb;
      border-radius: 6px;
      padding: 14px;
    }
    tr + tr { margin-top: 10px; }
    td { display: block; border: 0; padding: 0; }
    td::before {
      display: block;
      margin-bottom: 3px;
      color: #536173;
      font-size: 11px;
      font-weight: 650;
      content: attr(data-label);
    }
    td:nth-child(2), td:nth-child(5) { grid-column: 1 / -1; }
    td:last-child { grid-area: 1 / 2; text-align: right; }
    td:last-child > button { margin-inline: auto 0; }
  }
`;

export const MemberDetails = styled.details`
  margin-top: 6px;
  summary {
    width: fit-content;
    color: ${({ theme }) => theme.colors.brand.primary};
    font-weight: 600;
    cursor: pointer;
  }
`;

export const RowActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  &:not(:empty) { margin-top: 6px; }
  button, a { max-width: 100%; min-height: 30px; padding: 4px 8px; white-space: normal; }
`;

export const Issues = styled.ul`
  display: grid;
  gap: 5px;
  margin: 0;
  padding: 0;
  list-style: none;
  li[data-severity="INFO"] > svg { color: #526074; }
  li[data-resolved] > svg { color: #237458; }
  button { display: flex; min-height: 30px; margin-top: 5px; padding: 4px 10px; }
  li {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    color: #667085;
    font-size: calc(12px + var(--eclesia-font-size-adjustment, 0px));
    line-height: 1.45;
  }
  svg {
    width: 13px;
    height: 13px;
    flex: 0 0 auto;
    color: #b76b1a;
  }
`;

export const Pagination = styled.footer`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-top: 1px solid #edf0f4;
  padding: 14px 20px;
  color: #667085;
  font-size: calc(10px + var(--eclesia-font-size-adjustment, 0px));
  > div {
    display: flex;
    align-items: center;
    gap: 7px;
  }
`;

export const SummaryList = styled.div`
  display: grid;
  gap: 10px;
  > div {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    border-bottom: 1px solid #eef1f4;
    padding-bottom: 10px;
    color: #475467;
    font-size: calc(10px + var(--eclesia-font-size-adjustment, 0px));
    line-height: 1.5;
  }
  > div:last-child {
    border-bottom: 0;
    padding-bottom: 0;
  }
  svg {
    width: 17px;
    flex: 0 0 auto;
    color: ${({ theme }) => theme.colors.brand.primary};
  }
`;

export const ResultHero = styled.div<{ $rolledBack?: boolean }>`
  display: grid;
  place-items: center;
  padding: 24px 18px 5px;
  text-align: center;
  > span {
    display: grid;
    width: 62px;
    height: 62px;
    place-items: center;
    border-radius: 50%;
    background: ${({ $rolledBack }) => ($rolledBack ? "#f0f2f5" : "#eaf8f1")};
    color: ${({ $rolledBack }) => ($rolledBack ? "#667085" : "#25805d")};
  }
  svg {
    width: 30px;
    height: 30px;
  }
  h2 {
    margin: 15px 0 5px;
    color: #101828;
    font-size: calc(18px + var(--eclesia-font-size-adjustment, 0px));
  }
  p {
    margin: 0;
    color: #667085;
    font-size: calc(10px + var(--eclesia-font-size-adjustment, 0px));
  }
`;

export const HistoryList = styled.div`
  display: grid;
  gap: 10px;
`;

export const HistoryItem = styled.article`
  display: grid;
  grid-template-columns:
    minmax(0, 1.6fr) minmax(0, 1.2fr) minmax(0, 1fr) minmax(0, 0.9fr) 136px;
  align-items: center;
  gap: 13px;
  border: 1px solid #e7eaf0;
  border-radius: 6px;
  padding: 13px 14px;
  strong {
    display: block;
    overflow: hidden;
    color: #101828;
    font-size: calc(10px + var(--eclesia-font-size-adjustment, 0px));
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  small {
    display: block;
    margin-top: 3px;
    color: #98a2b3;
    font-size: calc(8px + var(--eclesia-font-size-adjustment, 0px));
  }
  > div { min-width: 0; }
  > button { width: 100%; padding-inline: 10px; white-space: nowrap; }
  @container (max-width: 700px) {
    grid-template-columns: 1fr 1fr;
    > :first-child {
      grid-column: 1 / -1;
    }
    > :last-child {
      grid-column: 1 / -1;
    }
  }
`;

export const Empty = styled.div`
  display: grid;
  min-height: 220px;
  place-items: center;
  padding: 30px;
  text-align: center;
  color: #667085;
  svg {
    width: 32px;
    height: 32px;
    color: #98a2b3;
  }
  h3 {
    margin: 10px 0 5px;
    color: #101828;
    font-size: calc(14px + var(--eclesia-font-size-adjustment, 0px));
  }
  p {
    margin: 0;
    font-size: calc(10px + var(--eclesia-font-size-adjustment, 0px));
  }
`;

export const ModalContent = styled.div`
  display: grid;
  gap: 14px;
  color: #475467;
  font-size: calc(10px + var(--eclesia-font-size-adjustment, 0px));
  line-height: 1.55;
  ul {
    margin: 0;
    padding-left: 18px;
  }
`;

export const ModalFooter = styled.div`
  display: flex;
  width: 100%;
  justify-content: flex-end;
  gap: 9px;
`;
