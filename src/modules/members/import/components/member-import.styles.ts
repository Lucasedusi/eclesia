"use client";

import styled, { keyframes } from "styled-components";

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
  border-radius: 12px;
  background: #fff;
  padding: 4px;
`;

export const Tab = styled.button<{ $active?: boolean }>`
  display: inline-flex;
  min-height: 38px;
  align-items: center;
  gap: 8px;
  border: 0;
  border-radius: 9px;
  background: ${({ $active, theme }) => $active ? theme.colors.brand.primary : "transparent"};
  padding: 0 14px;
  color: ${({ $active }) => $active ? "#fff" : "#667085"};
  font-size: 11px;
  font-weight: 850;
  cursor: pointer;
  &:hover { background: ${({ $active }) => $active ? undefined : "#f4f6fa"}; }
  &:focus-visible { outline: 0; box-shadow: ${({ theme }) => theme.shadows.focus}; }
`;

export const Progress = styled.ol`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0;
  margin: 0;
  border-radius: 14px;
  background: #fff;
  padding: 14px 16px;
  list-style: none;
  box-shadow: ${({ theme }) => theme.shadows.card};
  @media (max-width: 780px) { grid-template-columns: repeat(2, 1fr); gap: 10px; }
  @media (max-width: 480px) { grid-template-columns: 1fr; }
`;

export const ProgressItem = styled.li<{ $active?: boolean; $done?: boolean }>`
  position: relative;
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
  padding: 4px 18px 4px 0;
  &:not(:last-child)::after {
    position: absolute;
    top: 20px;
    right: 0;
    left: 34px;
    z-index: 0;
    height: 2px;
    background: ${({ $done, theme }) => $done ? theme.colors.brand.primary : "#e5e9f0"};
    content: "";
  }
  > span {
    position: relative;
    z-index: 1;
    display: grid;
    width: 34px;
    height: 34px;
    flex: 0 0 auto;
    place-items: center;
    border: 2px solid ${({ $active, $done, theme }) => $active || $done ? theme.colors.brand.primary : "#d6dce7"};
    border-radius: 50%;
    background: ${({ $done, theme }) => $done ? theme.colors.brand.primary : "#fff"};
    color: ${({ $active, $done, theme }) => $done ? "#fff" : $active ? theme.colors.brand.primary : "#98a2b3"};
    font-size: 11px;
    font-weight: 900;
  }
  > div { position: relative; z-index: 1; min-width: 0; background: #fff; padding: 0 10px 0 0; }
  strong { display: block; color: ${({ $active, $done }) => $active || $done ? "#101828" : "#667085"}; font-size: 10px; }
  small { display: block; overflow: hidden; margin-top: 2px; color: #98a2b3; font-size: 8px; text-overflow: ellipsis; white-space: nowrap; }
  @media (max-width: 780px) {
    padding-right: 0;
    &:not(:last-child)::after { display: none; }
  }
`;

export const Card = styled.section`
  overflow: hidden;
  border: 1px solid ${({ theme }) => theme.colors.border.soft};
  border-radius: 18px;
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
  h2 { margin: 0; color: #101828; font-size: 16px; font-weight: 900; }
  p { margin: 5px 0 0; color: #667085; font-size: 11px; line-height: 1.55; }
  > div:last-child { display: flex; gap: 8px; }
  @media (max-width: 700px) { flex-direction: column; > div:last-child { width: 100%; flex-wrap: wrap; } }
`;

export const CardBody = styled.div`
  display: grid;
  gap: 18px;
  padding: 22px;
`;

export const Field = styled.label`
  display: grid;
  gap: 7px;
  > span { color: #475467; font-size: 10px; font-weight: 850; }
  > small { color: #98a2b3; font-size: 9px; line-height: 1.5; }
`;

export const Select = styled.select`
  width: 100%;
  min-height: 44px;
  border: 1px solid #d7dde8;
  border-radius: 10px;
  outline: 0;
  background: #f8f9fc;
  padding: 0 12px;
  color: #344054;
  font-size: 11px;
  font-weight: 750;
  &:focus { border-color: ${({ theme }) => theme.colors.brand.primary}; background: #fff; box-shadow: ${({ theme }) => theme.shadows.focus}; }
`;

export const Dropzone = styled.label<{ $dragging?: boolean }>`
  display: grid;
  min-height: 220px;
  place-items: center;
  border: 2px dashed ${({ $dragging, theme }) => $dragging ? theme.colors.brand.primary : "#cfd6e2"};
  border-radius: 16px;
  background: ${({ $dragging }) => $dragging ? "#f2f5ff" : "#fafbfc"};
  padding: 30px;
  text-align: center;
  cursor: pointer;
  transition: 160ms ease;
  &:hover { border-color: ${({ theme }) => theme.colors.brand.primary}; background: #f7f8ff; }
  &:focus-within { box-shadow: ${({ theme }) => theme.shadows.focus}; }
  input { position: absolute; width: 1px; height: 1px; overflow: hidden; opacity: 0; }
  svg { width: 34px; height: 34px; color: ${({ theme }) => theme.colors.brand.primary}; }
  strong { display: block; margin-top: 13px; color: #101828; font-size: 13px; }
  p { margin: 6px 0 0; color: #667085; font-size: 10px; }
  small { display: block; margin-top: 9px; color: #98a2b3; font-size: 9px; }
`;

export const FileSelected = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border: 1px solid #dce2eb;
  border-radius: 12px;
  background: #fff;
  padding: 12px 14px;
  > div { display: flex; min-width: 0; align-items: center; gap: 10px; }
  svg { flex: 0 0 auto; color: #25805d; }
  strong { display: block; overflow: hidden; color: #344054; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
  small { display: block; margin-top: 3px; color: #98a2b3; font-size: 9px; }
  button { border: 0; background: transparent; color: #98a2b3; cursor: pointer; }
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
  > div { display: flex; align-items: center; gap: 9px; }
  @media (max-width: 620px) { align-items: stretch; flex-direction: column; > div { width: 100%; } > div > * { flex: 1; } }
`;

export const Stats = styled.div`
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
  @media (max-width: 900px) { grid-template-columns: repeat(3, 1fr); }
  @media (max-width: 520px) { grid-template-columns: repeat(2, 1fr); }
`;

export const Stat = styled.article<{ $tone?: "success" | "warning" | "danger" | "muted" }>`
  border-radius: 13px;
  background: #fff;
  padding: 13px;
  box-shadow: 0 5px 18px rgba(16, 24, 40, 0.07);
  strong { display: block; color: ${({ $tone }) => $tone === "success" ? "#227055" : $tone === "warning" ? "#9b5b18" : $tone === "danger" ? "#b7423e" : "#344054"}; font-size: 18px; }
  small { display: block; margin-top: 3px; color: #667085; font-size: 8px; font-weight: 800; text-transform: uppercase; }
`;

export const InfoGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  @media (max-width: 700px) { grid-template-columns: 1fr; }
`;

export const InfoBox = styled.div<{ $tone?: "info" | "warning" | "danger" | "success" }>`
  border: 1px solid ${({ $tone }) => $tone === "danger" ? "#f1c5c2" : $tone === "warning" ? "#eed9b9" : $tone === "success" ? "#bfe2d2" : "#d9e0ee"};
  border-radius: 13px;
  background: ${({ $tone }) => $tone === "danger" ? "#fff7f6" : $tone === "warning" ? "#fffbf4" : $tone === "success" ? "#f4fbf8" : "#f8faff"};
  padding: 14px;
  color: #475467;
  font-size: 10px;
  line-height: 1.55;
  h3 { margin: 0 0 7px; color: #344054; font-size: 11px; }
  ul { margin: 0; padding-left: 17px; }
`;

export const MappingList = styled.div`
  display: grid;
  gap: 9px;
`;

export const Mapping = styled.div`
  display: grid;
  grid-template-columns: minmax(130px, 1fr) minmax(190px, 1.4fr);
  align-items: center;
  gap: 12px;
  border: 1px solid #e8ebf0;
  border-radius: 11px;
  padding: 11px 12px;
  strong { display: block; color: #344054; font-size: 10px; }
  small { display: block; margin-top: 3px; color: #98a2b3; font-size: 8px; }
  @media (max-width: 600px) { grid-template-columns: 1fr; }
`;

export const Status = styled.span<{ $status: string }>`
  display: inline-flex;
  width: fit-content;
  align-items: center;
  gap: 5px;
  border-radius: 999px;
  background: ${({ $status }) => ["VALID", "READY", "COMPLETED", "IMPORTED"].includes($status) ? "#eaf8f1" : ["WARNING", "REVIEW", "FAILED"].includes($status) ? "#fff4df" : $status === "ERROR" ? "#fff0ef" : "#f0f2f5"};
  padding: 5px 8px;
  color: ${({ $status }) => ["VALID", "READY", "COMPLETED", "IMPORTED"].includes($status) ? "#237458" : ["WARNING", "REVIEW", "FAILED"].includes($status) ? "#9c5c18" : $status === "ERROR" ? "#b6423e" : "#667085"};
  font-size: 8px;
  font-weight: 900;
  text-transform: uppercase;
`;

export const Toolbar = styled.div`
  display: grid;
  grid-template-columns: minmax(240px, 1fr) minmax(150px, 210px) 110px;
  gap: 10px;
  border-bottom: 1px solid #edf0f4;
  background: #fbfcfd;
  padding: 14px 22px;
  @media (max-width: 720px) { grid-template-columns: 1fr 1fr; > :first-child { grid-column: 1 / -1; } }
`;

export const Search = styled.label`
  position: relative;
  display: block;
  svg { position: absolute; top: 50%; left: 12px; width: 16px; color: #98a2b3; transform: translateY(-50%); }
  input {
    width: 100%;
    min-height: 44px;
    border: 1px solid #d7dde8;
    border-radius: 10px;
    outline: 0;
    background: #fff;
    padding: 0 12px 0 38px;
    color: #344054;
    font-size: 11px;
    &:focus { border-color: ${({ theme }) => theme.colors.brand.primary}; box-shadow: ${({ theme }) => theme.shadows.focus}; }
  }
`;

export const TableWrap = styled.div`overflow-x: auto; @media (max-width: 850px) { display: none; }`;
export const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  th { border-bottom: 1px solid #e8ebf0; background: #f9fafb; padding: 11px 13px; color: #98a2b3; font-size: 8px; font-weight: 900; text-align: left; text-transform: uppercase; }
  td { border-bottom: 1px solid #eef1f4; padding: 12px 13px; color: #475467; font-size: 10px; vertical-align: top; }
  tr:last-child td { border-bottom: 0; }
  strong { color: #101828; }
  small { display: block; margin-top: 3px; color: #98a2b3; }
`;

export const RowActions = styled.div`
  display: flex;
  min-width: 210px;
  flex-wrap: wrap;
  gap: 5px;
`;

export const SmallButton = styled.button`
  min-height: 29px;
  border: 1px solid #dbe1ea;
  border-radius: 8px;
  background: #fff;
  padding: 0 8px;
  color: #526074;
  font-size: 8px;
  font-weight: 800;
  cursor: pointer;
  &:hover { border-color: ${({ theme }) => theme.colors.brand.primary}; color: ${({ theme }) => theme.colors.brand.primary}; }
  &:disabled { opacity: .55; cursor: wait; }
`;

export const MobileRows = styled.div`display: none; gap: 10px; padding: 12px; @media (max-width: 850px) { display: grid; }`;
export const MobileRow = styled.article`
  display: grid;
  gap: 11px;
  border: 1px solid #e6eaf0;
  border-radius: 13px;
  padding: 14px;
  header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
  h3 { margin: 0; color: #101828; font-size: 11px; }
  p { margin: 4px 0 0; color: #98a2b3; font-size: 9px; }
`;

export const Issues = styled.ul`
  display: grid;
  gap: 5px;
  margin: 0;
  padding: 0;
  list-style: none;
  li { display: flex; align-items: flex-start; gap: 6px; color: #667085; font-size: 9px; line-height: 1.45; }
  svg { width: 13px; height: 13px; flex: 0 0 auto; color: #b76b1a; }
`;

export const Pagination = styled.footer`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-top: 1px solid #edf0f4;
  padding: 14px 20px;
  color: #667085;
  font-size: 10px;
  > div { display: flex; align-items: center; gap: 7px; }
`;

export const SummaryList = styled.div`
  display: grid;
  gap: 10px;
  > div { display: flex; align-items: flex-start; gap: 10px; border-bottom: 1px solid #eef1f4; padding-bottom: 10px; color: #475467; font-size: 10px; line-height: 1.5; }
  > div:last-child { border-bottom: 0; padding-bottom: 0; }
  svg { width: 17px; flex: 0 0 auto; color: ${({ theme }) => theme.colors.brand.primary}; }
`;

export const ResultHero = styled.div<{ $rolledBack?: boolean }>`
  display: grid;
  place-items: center;
  padding: 24px 18px 5px;
  text-align: center;
  > span { display: grid; width: 62px; height: 62px; place-items: center; border-radius: 50%; background: ${({ $rolledBack }) => $rolledBack ? "#f0f2f5" : "#eaf8f1"}; color: ${({ $rolledBack }) => $rolledBack ? "#667085" : "#25805d"}; }
  svg { width: 30px; height: 30px; }
  h2 { margin: 15px 0 5px; color: #101828; font-size: 18px; }
  p { margin: 0; color: #667085; font-size: 10px; }
`;

export const HistoryStats = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  @media (max-width: 700px) { grid-template-columns: repeat(2, 1fr); }
`;

export const HistoryList = styled.div`
  display: grid;
  gap: 10px;
`;

export const HistoryItem = styled.article`
  display: grid;
  grid-template-columns: minmax(190px, 1.4fr) repeat(3, minmax(110px, .75fr)) auto;
  align-items: center;
  gap: 13px;
  border: 1px solid #e7eaf0;
  border-radius: 13px;
  padding: 13px 14px;
  strong { display: block; overflow: hidden; color: #101828; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
  small { display: block; margin-top: 3px; color: #98a2b3; font-size: 8px; }
  @media (max-width: 880px) { grid-template-columns: 1fr 1fr; > :first-child { grid-column: 1 / -1; } > :last-child { grid-column: 1 / -1; } }
`;

export const Empty = styled.div`
  display: grid;
  min-height: 220px;
  place-items: center;
  padding: 30px;
  text-align: center;
  color: #667085;
  svg { width: 32px; height: 32px; color: #98a2b3; }
  h3 { margin: 10px 0 5px; color: #101828; font-size: 14px; }
  p { margin: 0; font-size: 10px; }
`;

export const ModalContent = styled.div`
  display: grid;
  gap: 14px;
  color: #475467;
  font-size: 10px;
  line-height: 1.55;
  ul { margin: 0; padding-left: 18px; }
`;

export const ModalFooter = styled.div`
  display: flex;
  width: 100%;
  justify-content: flex-end;
  gap: 9px;
`;
