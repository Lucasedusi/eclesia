"use client";

import styled, { keyframes } from "styled-components";

const enter = keyframes`from { opacity: 0; transform: translateY(7px); } to { opacity: 1; transform: translateY(0); }`;

export const Module = styled.div`display: grid; gap: 18px; animation: ${enter} 220ms ease both;`;
export const Stats = styled.section`
  display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px;
  @media (max-width: 1050px) { grid-template-columns: repeat(3, 1fr); }
  @media (max-width: 620px) { grid-template-columns: repeat(2, 1fr); }
`;
export const Stat = styled.article<{ $tone?: string }>`
  display: flex; align-items: center; gap: 12px; min-width: 0; border: 1px solid ${({ theme }) => theme.colors.border.soft};
  border-radius: 15px; background: #fff; padding: 15px; box-shadow: ${({ theme }) => theme.shadows.card};
  > span { display: grid; width: 40px; height: 40px; place-items: center; flex: 0 0 auto; border-radius: 12px;
    background: ${({ $tone }) => $tone === "success" ? "#eaf8f1" : $tone === "warning" ? "#fff5e8" : $tone === "danger" ? "#fff0ef" : "#eef2ff"};
    color: ${({ $tone, theme }) => $tone === "success" ? "#25805d" : $tone === "warning" ? "#b76b1a" : $tone === "danger" ? "#c44d48" : theme.colors.brand.primary}; }
  strong { display: block; color: #101828; font-size: 19px; font-weight: 900; }
  small { display: block; margin-top: 2px; color: #7c879b; font-size: 9px; font-weight: 750; }
`;
export const Panel = styled.section`overflow: hidden; border: 1px solid ${({ theme }) => theme.colors.border.soft}; border-radius: 19px; background: #fff; box-shadow: ${({ theme }) => theme.shadows.card};`;
export const PanelHeader = styled.header`
  display: flex; align-items: center; justify-content: space-between; gap: 20px; border-bottom: 1px solid #edf0f4; padding: 20px 22px;
  h2 { margin: 0; color: #101828; font-size: 16px; font-weight: 900; }
  p { margin: 5px 0 0; color: #667085; font-size: 11px; font-weight: 600; }
  @media (max-width: 720px) { align-items: stretch; flex-direction: column; }
`;
export const HeaderSearch = styled.div`
  width: min(380px, 42vw); flex: 0 1 380px;
  @media (max-width: 720px) { width: 100%; flex-basis: auto; }
`;
export const Toolbar = styled.div`
  display: grid; grid-template-columns: repeat(7, minmax(105px, 1fr)); align-items: start; gap: 9px; border-bottom: 1px solid #edf0f4; background: #fbfcfd; padding: 14px 22px;
  @media (max-width: 1050px) { grid-template-columns: repeat(4, 1fr); }
  @media (max-width: 720px) { grid-template-columns: repeat(2, 1fr); }
  @media (max-width: 440px) { grid-template-columns: 1fr; }
`;
export const Search = styled.label`
  position: relative; display: block;
  > svg { position: absolute; top: 50%; left: 13px; width: 16px; color: #98a2b3; transform: translateY(-50%); }
  input { padding-left: 39px; }
`;
export const SearchField = styled.div`min-width: 0;`;
export const SearchInlineStatus = styled.small`
  position: absolute; top: 50%; right: 42px; display: inline-flex; max-width: 145px; align-items: center; gap: 5px;
  overflow: hidden; color: #8a5d13; font-size: 8px; font-weight: 800; text-overflow: ellipsis; white-space: nowrap; transform: translateY(-50%);
  svg { position: static; width: 12px; height: 12px; flex: 0 0 auto; color: ${({ theme }) => theme.colors.brand.primary}; transform: none; animation: spin 800ms linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
`;
export const Control = styled.input<{ $withInlineStatus?: boolean; $withClear?: boolean }>`
  width: 100%; min-height: 44px; border: 1px solid #d9deea; border-radius: 10px; outline: 0; background: #f8f9fc; padding: 0 13px; color: #344054; font-size: 12px; font-weight: 650;
  padding-right: ${({ $withInlineStatus, $withClear }) => $withInlineStatus ? "190px" : $withClear ? "45px" : "13px"};
  &:focus { border-color: ${({ theme }) => theme.colors.brand.primary}; background: #fff; box-shadow: ${({ theme }) => theme.shadows.focus}; }
`;
export const ClearSearchButton = styled.button`
  position: absolute; top: 50%; right: 8px; display: grid; width: 28px; height: 28px; place-items: center;
  border: 0; border-radius: 8px; background: transparent; color: #98a2b3; cursor: pointer; transform: translateY(-50%);
  svg { position: static; width: 14px; height: 14px; transform: none; }
  &:hover { background: #eef1f5; color: #475467; }
  &:focus-visible { outline: 0; box-shadow: ${({ theme }) => theme.shadows.focus}; }
`;
export const Select = styled.select`
  width: 100%; min-height: 44px; border: 1px solid #d9deea; border-radius: 10px; outline: 0; background: #f8f9fc; padding: 0 12px; color: #344054; font-size: 11px; font-weight: 750;
  &:focus { border-color: ${({ theme }) => theme.colors.brand.primary}; background: #fff; box-shadow: ${({ theme }) => theme.shadows.focus}; }
`;
export const TableWrap = styled.div`overflow-x: auto; @media (max-width: 850px) { display: none; }`;
export const Table = styled.table`
  width: 100%; border-collapse: collapse;
  th { border-bottom: 1px solid #edf0f4; background: #f9fafb; padding: 12px 14px; color: #98a2b3; font-size: 9px; font-weight: 850; text-align: left; text-transform: uppercase; }
  td { border-bottom: 1px solid #f0f2f5; padding: 13px 14px; color: #475467; font-size: 11px; font-weight: 650; vertical-align: middle; }
  tr:last-child td { border-bottom: 0; } tr:hover td { background: #fcfcfd; }
`;
export const Person = styled.div`
  display: flex; align-items: center; gap: 10px; min-width: 210px;
  > span { display: grid; width: 36px; height: 36px; flex: 0 0 auto; place-items: center; border-radius: 11px; background: #eef2ff; color: ${({ theme }) => theme.colors.brand.primary}; font-size: 11px; font-weight: 900; }
  strong { display: block; color: #101828; font-size: 11px; font-weight: 850; text-transform: uppercase; } small { display: block; margin-top: 2px; color: #98a2b3; font-size: 9px; }
`;
export const Status = styled.span<{ $status: string }>`
  display: inline-flex; align-items: center; border-radius: 999px; padding: 5px 8px; font-size: 8px; font-weight: 900; text-transform: uppercase;
  background: ${({ $status }) => $status === "ACTIVE" ? "#eaf8f1" : $status === "INACTIVE" ? "#fff5e8" : $status === "DISCIPLINED" ? "#fff0ef" : "#f1f3f6"};
  color: ${({ $status }) => $status === "ACTIVE" ? "#25805d" : $status === "INACTIVE" ? "#a96318" : $status === "DISCIPLINED" ? "#b6423e" : "#667085"};
`;
export const Actions = styled.div`display: flex; justify-content: flex-end; gap: 5px;`;
export const IconButton = styled.button`
  display: grid; width: 33px; height: 33px; place-items: center; border: 1px solid #e2e6ed; border-radius: 9px; background: #fff; color: #667085; cursor: pointer;
  svg { width: 15px; } &:hover { border-color: #b9c3dc; background: #f6f8ff; color: ${({ theme }) => theme.colors.brand.primary}; } &:disabled { opacity: .5; cursor: wait; }
`;
export const MobileList = styled.div`display: none; padding: 12px; gap: 10px; @media (max-width: 850px) { display: grid; }`;
export const MobileCard = styled.article`border: 1px solid #e8ebf0; border-radius: 14px; background: #fff; padding: 14px;`;
export const MobileMeta = styled.div`display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 13px; color: #667085; font-size: 10px; span { display: block; color: #98a2b3; font-size: 8px; font-weight: 850; text-transform: uppercase; } strong { display: block; margin-top: 3px; color: #344054; }`;
export const Pagination = styled.footer`
  display: flex; align-items: center; justify-content: space-between; gap: 12px; border-top: 1px solid #edf0f4; padding: 14px 20px; color: #667085; font-size: 10px; font-weight: 700;
  > div { display: flex; align-items: center; gap: 7px; }
`;
export const Empty = styled.div`display: grid; min-height: 250px; place-items: center; padding: 30px; text-align: center; color: #667085; h3 { margin: 10px 0 4px; color: #101828; font-size: 15px; } p { margin: 0; font-size: 11px; }`;
export const Loading = styled.div`display: grid; min-height: 250px; place-items: center; color: ${({ theme }) => theme.colors.brand.primary}; svg { animation: spin 800ms linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`;
export const Menu = styled.div`display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 9px;`;
export const MenuButton = styled.button`display: flex; min-height: 45px; align-items: center; gap: 9px; border: 1px solid #e2e6ed; border-radius: 10px; background: #fff; padding: 10px 12px; color: #475467; font-size: 10px; font-weight: 750; cursor: pointer; svg { width: 15px; } &:hover { background: #f7f8fc; color: ${({ theme }) => theme.colors.brand.primary}; }`;
export const ActionForm = styled.form`display: grid; gap: 18px;`;
export const FormIntro = styled.div`
  border-radius: 13px; background: ${({ theme }) => theme.colors.state.infoSolfSecundary}; padding: 13px 15px;
  color: ${({ theme }) => theme.colors.brand.primary}; font-size: 10px; font-weight: 650; line-height: 1.55;
`;
export const FieldGrid = styled.div`
  display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 15px;
  @media (max-width: 650px) { grid-template-columns: 1fr; }
`;
export const Field = styled.label<{ $span?: number }>`
  display: grid; grid-column: span ${({ $span = 1 }) => $span}; gap: 7px;
  > span { color: #475467; font-size: 10px; font-weight: 850; }
  @media (max-width: 650px) { grid-column: auto; }
`;
export const CheckField = styled.div<{ $span?: number }>`
  grid-column: span ${({ $span = 1 }) => $span}; border: 1px solid #e2e6ed; border-radius: 10px; background: #f8f9fc; padding: 12px 13px;
  @media (max-width: 650px) { grid-column: auto; }
`;
export const Textarea = styled.textarea`
  width: 100%; min-height: 92px; resize: vertical; border: 1px solid #d9deea; border-radius: 10px; outline: 0;
  background: #f8f9fc; padding: 12px 13px; color: #344054; font-size: 12px; font-weight: 650; line-height: 1.55;
  &:focus { border-color: ${({ theme }) => theme.colors.brand.primary}; background: #fff; box-shadow: ${({ theme }) => theme.shadows.focus}; }
`;
export const ModalFooter = styled.div`
  display: flex; width: 100%; align-items: center; justify-content: space-between; gap: 12px;
  > div { display: flex; justify-content: flex-end; gap: 10px; }
  @media (max-width: 520px) { > span { display: none; } > div { width: 100%; } > div > * { flex: 1; } }
`;
