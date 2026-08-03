"use client";

import styled, { keyframes } from "styled-components";
import Link from "next/link";

const enter = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
`;

const shimmer = keyframes`
  from { background-position: 100% 0; }
  to { background-position: -100% 0; }
`;

export const Module = styled.div`
  display: grid;
  gap: 20px;
  animation: ${enter} 240ms ease both;
`;

export const Tabs = styled.nav`
  display: flex;
  width: fit-content;
  max-width: 100%;
  gap: 5px;
  margin-bottom: 20px;
  overflow-x: auto;
  border: 1px solid ${({ theme }) => theme.colors.border.soft};
  border-radius: 14px;
  background: #fff;
  padding: 5px;
  box-shadow: ${({ theme }) => theme.shadows.card};
`;

export const Tab = styled(Link)<{ $active: boolean }>`
  display: inline-flex;
  min-height: 42px;
  align-items: center;
  gap: 8px;
  border-radius: 10px;
  background: ${({ $active, theme }) => ($active ? theme.colors.brand.primary : "transparent")};
  color: ${({ $active, theme }) => ($active ? "#fff" : theme.colors.text.body)};
  padding: 0 16px;
  font-size: 11px;
  font-weight: 850;
  white-space: nowrap;
  transition: 160ms ease;

  &:hover { background: ${({ $active }) => ($active ? "#354f9d" : "#f5f7fb")}; }
`;

export const Stats = styled.section`
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;

  @media (max-width: 1120px) { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  @media (max-width: 700px) { grid-template-columns: 1fr 1fr; }
  @media (max-width: 430px) { grid-template-columns: 1fr; }
`;

export const Stat = styled.article<{ $tone?: "primary" | "success" | "warning" | "neutral" }>`
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 12px;
  border: 1px solid ${({ theme }) => theme.colors.border.soft};
  border-radius: 15px;
  background: #fff;
  padding: 15px;
  box-shadow: ${({ theme }) => theme.shadows.card};

  > span {
    display: grid;
    width: 40px;
    height: 40px;
    flex: 0 0 auto;
    place-items: center;
    border-radius: 12px;
    background: ${({ $tone }) =>
      $tone === "success" ? "#eaf8f1" : $tone === "warning" ? "#fff5e8" : $tone === "neutral" ? "#f2f4f7" : "#eef2ff"};
    color: ${({ $tone, theme }) =>
      $tone === "success" ? "#25805d" : $tone === "warning" ? "#b76b1a" : $tone === "neutral" ? "#667085" : theme.colors.brand.primary};
  }

  strong { display: block; color: #101828; font-size: 19px; font-weight: 900; }
  small { display: block; margin-top: 2px; color: #7c879b; font-size: 9px; font-weight: 750; line-height: 1.35; }
`;

export const Panel = styled.section`
  overflow: hidden;
  border: 1px solid ${({ theme }) => theme.colors.border.soft};
  border-radius: 19px;
  background: #fff;
  box-shadow: ${({ theme }) => theme.shadows.card};
`;

export const PanelHeader = styled.header`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  border-bottom: 1px solid #edf0f4;
  padding: 20px 22px;

  h2 { margin: 0; color: #101828; font-size: 16px; font-weight: 900; }
  p { max-width: 720px; margin: 5px 0 0; color: #667085; font-size: 11px; font-weight: 600; line-height: 1.55; }

  @media (max-width: 620px) { flex-direction: column; }
`;

export const Toolbar = styled.div`
  display: grid;
  grid-template-columns: minmax(230px, 1fr) repeat(4, minmax(135px, 175px));
  gap: 10px;
  border-bottom: 1px solid #edf0f4;
  background: #fbfcfd;
  padding: 14px 22px;

  @media (max-width: 960px) { grid-template-columns: 1fr 1fr; }
  @media (max-width: 560px) { grid-template-columns: 1fr; }
`;

export const Search = styled.label`
  position: relative;
  display: block;

  svg {
    position: absolute;
    top: 50%;
    left: 13px;
    width: 16px;
    color: #98a2b3;
    transform: translateY(-50%);
    pointer-events: none;
  }

  input { padding-left: 39px; }
`;

export const Control = styled.input<{ $invalid?: boolean }>`
  width: 100%;
  min-height: 44px;
  border: 1px solid ${({ $invalid }) => ($invalid ? "#ef7770" : "#d9deea")};
  border-radius: 10px;
  outline: 0;
  background: #f8f9fc;
  padding: 0 13px;
  color: #344054;
  font-size: 12px;
  font-weight: 650;
  transition: 150ms ease;

  &:focus { border-color: ${({ theme }) => theme.colors.brand.primary}; background: #fff; box-shadow: ${({ theme }) => theme.shadows.focus}; }
  &:disabled { color: #98a2b3; cursor: not-allowed; }
`;

export const SelectControl = styled.select<{ $invalid?: boolean }>`
  width: 100%;
  min-height: 44px;
  border: 1px solid ${({ $invalid }) => ($invalid ? "#ef7770" : "#d9deea")};
  border-radius: 10px;
  outline: 0;
  background: #f8f9fc;
  padding: 0 12px;
  color: #344054;
  font-size: 11px;
  font-weight: 750;

  &:focus { border-color: ${({ theme }) => theme.colors.brand.primary}; background: #fff; box-shadow: ${({ theme }) => theme.shadows.focus}; }
  &:disabled { color: #98a2b3; cursor: not-allowed; }
`;

export const TableWrap = styled.div`
  overflow-x: auto;
  @media (max-width: 820px) { display: none; }
`;

export const Table = styled.table`
  width: 100%;
  border-collapse: collapse;

  th {
    border-bottom: 1px solid #edf0f4;
    background: #f9fafb;
    padding: 12px 15px;
    color: #98a2b3;
    font-size: 9px;
    font-weight: 850;
    letter-spacing: .035em;
    text-align: left;
    text-transform: uppercase;
    white-space: nowrap;
  }

  td {
    border-bottom: 1px solid #f0f2f5;
    padding: 14px 15px;
    color: #667085;
    font-size: 10px;
    font-weight: 650;
    line-height: 1.45;
    vertical-align: middle;
  }

  tbody tr:last-child td { border-bottom: 0; }
  tbody tr { transition: background 140ms ease; }
  tbody tr:hover { background: #fbfcff; }
`;

export const PrimaryCell = styled.div`
  min-width: 155px;
  strong { display: flex; align-items: center; gap: 7px; color: #344054; font-size: 11px; font-weight: 850; }
  small { display: block; max-width: 250px; overflow: hidden; margin-top: 4px; color: #98a2b3; font-size: 9px; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
`;

export const HeadquartersBadge = styled.span`
  display: inline-flex;
  min-height: 21px;
  align-items: center;
  border-radius: 999px;
  background: #eef2ff;
  color: ${({ theme }) => theme.colors.brand.primary};
  padding: 0 7px;
  font-size: 8px;
  font-weight: 900;
`;

export const StatusBadge = styled.span<{ $status: "ACTIVE" | "INACTIVE" }>`
  display: inline-flex;
  min-height: 25px;
  align-items: center;
  gap: 6px;
  border-radius: 999px;
  background: ${({ $status }) => ($status === "ACTIVE" ? "#e9f8f0" : "#f2f4f7")};
  color: ${({ $status }) => ($status === "ACTIVE" ? "#267c5b" : "#667085")};
  padding: 0 9px;
  font-size: 9px;
  font-weight: 850;

  &::before { content: ""; width: 5px; height: 5px; border-radius: 50%; background: currentColor; }
`;

export const RowActions = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
`;

export const IconButton = styled.button<{ $danger?: boolean; $warning?: boolean }>`
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border: 1px solid #e2e6ed;
  border-radius: 9px;
  background: #fff;
  color: ${({ $danger, $warning }) => ($danger ? "#c84a44" : $warning ? "#b76b1a" : "#667085")};
  transition: 140ms ease;

  &:hover:not(:disabled) { border-color: ${({ theme }) => theme.colors.brand.primary}; background: #f6f8ff; color: ${({ theme }) => theme.colors.brand.primary}; }
  &:disabled { opacity: .52; cursor: wait; }
  svg { width: 15px; height: 15px; }
`;

export const InlineSpinner = styled.span`
  width: 14px;
  height: 14px;
  border: 2px solid #d7ddea;
  border-top-color: ${({ theme }) => theme.colors.brand.primary};
  border-radius: 50%;
  animation: spin .7s linear infinite;
  @keyframes spin { to { transform: rotate(360deg); } }
`;

export const MobileList = styled.div`
  display: none;
  gap: 10px;
  padding: 14px;
  @media (max-width: 820px) { display: grid; }
`;

export const MobileCard = styled.article`
  border: 1px solid #e8ebf1;
  border-radius: 14px;
  background: #fff;
  padding: 15px;
`;

export const MobileCardTop = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
`;

export const MobileMeta = styled.dl`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 11px;
  margin: 14px 0 0;

  div { min-width: 0; }
  dt { color: #98a2b3; font-size: 8px; font-weight: 850; text-transform: uppercase; }
  dd { overflow: hidden; margin: 4px 0 0; color: #475467; font-size: 10px; font-weight: 750; text-overflow: ellipsis; white-space: nowrap; }
`;

export const MobileActions = styled(RowActions)`
  justify-content: flex-start;
  margin-top: 14px;
  border-top: 1px solid #edf0f4;
  padding-top: 12px;
`;

export const Empty = styled.div`
  display: grid;
  place-items: center;
  padding: 60px 22px;
  text-align: center;

  > span { display: grid; width: 52px; height: 52px; place-items: center; border-radius: 16px; background: #f2f5fb; color: ${({ theme }) => theme.colors.brand.primary}; }
  h3 { margin: 14px 0 0; color: #344054; font-size: 14px; font-weight: 900; }
  p { max-width: 430px; margin: 7px 0 18px; color: #98a2b3; font-size: 11px; font-weight: 650; line-height: 1.6; }
`;

export const Pagination = styled.footer`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-top: 1px solid #edf0f4;
  padding: 13px 18px;
  color: #98a2b3;
  font-size: 9px;
  font-weight: 750;

  div { display: flex; gap: 6px; }
  button { display: grid; width: 32px; height: 32px; place-items: center; border: 1px solid #e1e5ec; border-radius: 8px; background: #fff; color: #667085; }
  button:disabled { opacity: .4; }
  svg { width: 14px; }
`;

export const Form = styled.form`
  display: grid;
  gap: 18px;
`;

export const FormIntro = styled.div`
  border: 1px solid #e4e8f0;
  border-radius: 13px;
  background: #f8faff;
  padding: 13px 15px;
  color: #667085;
  font-size: 10px;
  font-weight: 650;
  line-height: 1.55;
`;

export const FieldGrid = styled.div<{ $columns?: number }>`
  display: grid;
  grid-template-columns: repeat(${({ $columns = 2 }) => $columns}, minmax(0, 1fr));
  gap: 15px;
  @media (max-width: 650px) { grid-template-columns: 1fr; }
`;

export const Field = styled.label<{ $span?: number }>`
  display: grid;
  grid-column: span ${({ $span = 1 }) => $span};
  gap: 7px;

  > span { color: #475467; font-size: 10px; font-weight: 850; }
  > small { color: #98a2b3; font-size: 9px; font-weight: 600; }

  @media (max-width: 650px) { grid-column: auto; }
`;

export const Textarea = styled.textarea<{ $invalid?: boolean }>`
  width: 100%;
  min-height: 92px;
  border: 1px solid ${({ $invalid }) => ($invalid ? "#ef7770" : "#d9deea")};
  border-radius: 10px;
  outline: 0;
  background: #f8f9fc;
  padding: 12px 13px;
  color: #344054;
  font-size: 12px;
  font-weight: 650;
  line-height: 1.55;
  resize: vertical;
  &:focus { border-color: ${({ theme }) => theme.colors.brand.primary}; background: #fff; box-shadow: ${({ theme }) => theme.shadows.focus}; }
`;

export const FieldError = styled.small`
  color: #c84a44 !important;
  font-weight: 750 !important;
`;

export const FormAlert = styled.div`
  border: 1px solid #ffd0ce;
  border-radius: 10px;
  background: #fff4f3;
  color: #a9413c;
  padding: 11px 13px;
  font-size: 10px;
  font-weight: 750;
  line-height: 1.55;
`;

export const StepHeader = styled.div`
  display: grid;
  gap: 12px;
`;

export const StepProgress = styled.ol`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 7px;
  margin: 0;
  padding: 0;
  list-style: none;

  @media (max-width: 680px) { grid-template-columns: 1fr 1fr; }
`;

export const Step = styled.li<{ $active: boolean; $complete: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid ${({ $active }) => ($active ? "#bdc9ef" : "#e6e9ef")};
  border-radius: 10px;
  background: ${({ $active }) => ($active ? "#f3f6ff" : "#fff")};
  padding: 9px;
  color: ${({ $active, $complete }) => ($active || $complete ? "#415ba5" : "#98a2b3")};
  font-size: 9px;
  font-weight: 850;

  span { display: grid; width: 23px; height: 23px; flex: 0 0 auto; place-items: center; border-radius: 7px; background: ${({ $active, $complete }) => ($active || $complete ? "#415ba5" : "#eef0f4")}; color: ${({ $active, $complete }) => ($active || $complete ? "#fff" : "#98a2b3")}; }
`;

export const SectionTitle = styled.div`
  h3 { margin: 0; color: #344054; font-size: 14px; font-weight: 900; }
  p { margin: 5px 0 0; color: #98a2b3; font-size: 10px; font-weight: 650; line-height: 1.5; }
`;

export const ReviewGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  @media (max-width: 620px) { grid-template-columns: 1fr; }
`;

export const ReviewCard = styled.div`
  border: 1px solid #e5e9f0;
  border-radius: 12px;
  background: #fafbfc;
  padding: 13px;
  strong { display: block; color: #344054; font-size: 10px; font-weight: 850; }
  p { margin: 6px 0 0; color: #667085; font-size: 10px; font-weight: 650; line-height: 1.6; }
`;

export const ModalFooter = styled.div`
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  > div { display: flex; gap: 10px; }
  @media (max-width: 480px) { align-items: stretch; flex-direction: column; > div { display: grid; grid-template-columns: 1fr 1fr; } }
`;

export const DeleteName = styled.strong`
  color: #344054;
`;

export const Skeleton = styled.div<{ $height?: string }>`
  height: ${({ $height = "54px" }) => $height};
  border-radius: 13px;
  background: linear-gradient(90deg, #eef1f5 25%, #f8f9fb 50%, #eef1f5 75%);
  background-size: 200% 100%;
  animation: ${shimmer} 1.25s linear infinite;
`;

export const SkeletonGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
  @media (max-width: 850px) { grid-template-columns: 1fr 1fr; }
`;

export const ErrorState = styled.div`
  display: grid;
  place-items: center;
  border: 1px solid #ffd9d5;
  border-radius: 17px;
  background: #fff;
  padding: 55px 22px;
  text-align: center;
  box-shadow: ${({ theme }) => theme.shadows.card};
  > span { display: grid; width: 52px; height: 52px; place-items: center; border-radius: 16px; background: #fff1f0; color: #c84a44; }
  h2 { margin: 14px 0 0; color: #344054; font-size: 15px; font-weight: 900; }
  p { max-width: 470px; margin: 7px 0 18px; color: #98a2b3; font-size: 11px; font-weight: 650; line-height: 1.6; }
`;
