"use client";

import styled from "styled-components";

export const HeaderCard = styled.section`display: flex; align-items: center; justify-content: space-between; gap: 16px; border: 1px solid #e8ebf0; border-radius: 15px; background: linear-gradient(135deg, #f7f9ff, #fff); padding: 16px;`;
export const Identity = styled.div`display: flex; align-items: center; gap: 13px; > span { display: grid; width: 48px; height: 48px; place-items: center; border-radius: 15px; background: #415ba5; color: #fff; font-weight: 900; } h3 { margin: 0; color: #101828; font-size: 16px; font-weight: 900; } p { margin: 4px 0 0; color: #667085; font-size: 10px; font-weight: 650; }`;
export const Tabs = styled.nav`display: flex; gap: 5px; margin: 16px 0; overflow-x: auto; border-bottom: 1px solid #e9ecf1;`;
export const Tab = styled.button<{ $active: boolean }>`display: inline-flex; min-height: 42px; align-items: center; gap: 7px; border: 0; border-bottom: 2px solid ${({ $active }) => $active ? "#415ba5" : "transparent"}; background: transparent; padding: 0 13px; color: ${({ $active }) => $active ? "#415ba5" : "#667085"}; font-size: 10px; font-weight: 850; white-space: nowrap; cursor: pointer; svg { width: 15px; }`;
export const Section = styled.section`display: grid; gap: 13px; h4 { margin: 2px 0 0; color: #101828; font-size: 12px; font-weight: 900; }`;
export const Grid = styled.dl`display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin: 0; @media (max-width: 780px) { grid-template-columns: 1fr 1fr; } @media (max-width: 520px) { grid-template-columns: 1fr; }`;
export const Field = styled.div`border: 1px solid #e8ebf0; border-radius: 11px; background: #fbfcfd; padding: 11px 12px; dt { color: #98a2b3; font-size: 8px; font-weight: 850; text-transform: uppercase; } dd { margin: 4px 0 0; color: #344054; font-size: 11px; font-weight: 700; line-height: 1.45; word-break: break-word; }`;
export const WhatsAppValue = styled.span`
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  > span { min-width: 0; }
`;
export const WhatsAppLink = styled.a`
  display: inline-flex; min-height: 27px; align-items: center; gap: 5px; flex: 0 0 auto;
  border-radius: 8px; background: #e9f8ef; padding: 0 8px; color: #168447;
  font-size: 8px; font-weight: 850; text-decoration: none;
  svg { width: 13px; height: 13px; }
  &:hover { background: #d9f3e4; color: #0c6d38; }
`;
export const Divider = styled.hr`width: 100%; height: 1px; border: 0; background: #edf0f4;`;
export const Timeline = styled.ol`display: grid; gap: 10px; margin: 0; padding: 0; list-style: none;`;
export const Event = styled.li`display: grid; grid-template-columns: 11px 1fr; gap: 12px; &:before { content: ""; width: 10px; height: 10px; margin-top: 5px; border: 3px solid #dce4ff; border-radius: 50%; background: #415ba5; } article { border: 1px solid #e8ebf0; border-radius: 12px; padding: 12px; } h5 { margin: 0; color: #101828; font-size: 11px; font-weight: 850; } time { color: #98a2b3; font-size: 9px; font-weight: 700; } p { margin: 6px 0 0; color: #667085; font-size: 10px; line-height: 1.55; }`;
export const HistoryChange = styled.div`
  display: inline-flex; align-items: center; gap: 8px; margin-top: 8px; border-radius: 9px; background: #eef2ff; padding: 7px 9px;
  color: #344054; font-size: 10px; font-weight: 750;
  strong { color: #415ba5; }
  svg { width: 13px; height: 13px; color: #98a2b3; }
`;
export const TabHeader = styled.header`display: flex; align-items: center; justify-content: space-between; gap: 12px; h4 { margin: 0; } p { margin: 3px 0 0; color: #667085; font-size: 10px; }`;
export const FinanceSummary = styled.div`display: grid; grid-template-columns: 1fr 1fr; gap: 10px; article { border: 1px solid #e8ebf0; border-radius: 12px; background: #fbfcfd; padding: 13px; } small { color: #98a2b3; font-size: 8px; font-weight: 850; text-transform: uppercase; } strong { display: block; margin-top: 4px; color: #101828; font-size: 15px; }`;
export const SimpleTable = styled.div`overflow-x: auto; table { width: 100%; border-collapse: collapse; } th { background: #f8f9fb; color: #98a2b3; font-size: 8px; text-align: left; text-transform: uppercase; } th, td { border-bottom: 1px solid #edf0f4; padding: 10px; } td { color: #475467; font-size: 10px; font-weight: 650; }`;
export const Documents = styled.div`display: grid; gap: 9px;`;
export const Document = styled.article`display: flex; align-items: center; justify-content: space-between; gap: 12px; border: 1px solid #e8ebf0; border-radius: 12px; padding: 12px; h5 { margin: 0; color: #101828; font-size: 11px; font-weight: 850; } p { margin: 3px 0 0; color: #98a2b3; font-size: 9px; } > div:last-child { display: flex; gap: 6px; }`;
export const CurrentBadge = styled.span`
  display: inline-flex; min-height: 20px; align-items: center; margin-left: 7px; border-radius: 999px; background: #eef2ff; padding: 0 7px;
  color: #415ba5; font-size: 8px; font-weight: 900; vertical-align: middle;
`;
export const UploadForm = styled.form`
  display: grid; grid-template-columns: 1fr 1fr; gap: 15px; border: 1px solid #dfe5f2; border-radius: 13px; background: #f8faff; padding: 15px;
  @media (max-width: 600px) { grid-template-columns: 1fr; }
`;
export const FormField = styled.label<{ $span?: number }>`
  display: grid; grid-column: span ${({ $span = 1 }) => $span}; gap: 7px;
  > span { color: #475467; font-size: 10px; font-weight: 850; }
  @media (max-width: 600px) { grid-column: auto; }
`;
export const FormControl = styled.input`
  width: 100%; min-height: 44px; border: 1px solid #d9deea; border-radius: 10px; outline: 0; background: #f8f9fc; padding: 0 13px;
  color: #344054; font-size: 12px; font-weight: 650;
  &:focus { border-color: #415ba5; background: #fff; box-shadow: 0 0 0 3px rgba(65, 91, 165, .12); }
  &[type="file"] { padding: 9px 11px; }
`;
export const SelectControl = styled.select`
  width: 100%; min-height: 44px; border: 1px solid #d9deea; border-radius: 10px; outline: 0; background: #f8f9fc; padding: 0 12px;
  color: #344054; font-size: 11px; font-weight: 750;
  &:focus { border-color: #415ba5; background: #fff; box-shadow: 0 0 0 3px rgba(65, 91, 165, .12); }
`;
export const CheckField = styled.div<{ $span?: number }>`
  grid-column: span ${({ $span = 1 }) => $span}; border: 1px solid #e2e6ed; border-radius: 10px; background: #fff; padding: 12px 13px;
  @media (max-width: 600px) { grid-column: auto; }
`;
export const FormActions = styled.div`
  grid-column: 1 / -1; display: flex; justify-content: flex-end;
`;
export const RoleForm = styled.form`
  display: grid;
  gap: 15px;
`;
export const RoleNotice = styled.div`
  border: 1px solid #dfe5f2;
  border-radius: 12px;
  background: #f8faff;
  padding: 12px 13px;
  color: #667085;
  font-size: 10px;
  font-weight: 650;
  line-height: 1.55;
`;
export const RoleSuccess = styled.div`
  border-radius: 13px;
  background: #eaf8f1;
  padding: 13px;
  color: #227055;
  font-size: 11px;
  font-weight: 750;
  line-height: 1.55;
`;
export const Empty = styled.div`display: grid; min-height: 180px; place-items: center; color: #667085; font-size: 11px; text-align: center;`;
export const Loading = styled(Empty)`svg { animation: spin 800ms linear infinite; color: #415ba5; } @keyframes spin { to { transform: rotate(360deg); } }`;
export const Error = styled.div`border: 1px solid #f2cbc8; border-radius: 11px; background: #fff5f4; padding: 13px; color: #a63f3a; font-size: 10px; font-weight: 700;`;
export const Pager = styled.div`display: flex; justify-content: flex-end; gap: 7px; margin-top: 10px;`;
