"use client";

import styled, { css } from "styled-components";

export const Module = styled.section`
  display: grid;
  gap: 18px;
`;

export const HeaderActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
`;

export const Stats = styled.div`
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;

  @media (max-width: 1050px) { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  @media (max-width: 620px) { grid-template-columns: repeat(2, minmax(0, 1fr)); }
`;

export const Stat = styled.button<{ $active?: boolean; $tone?: "success" | "warning" | "danger" }>`
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 11px;
  border: 1px solid ${({ $active }) => ($active ? "#A8B4E8" : "#e6e9ef")};
  border-radius: 15px;
  background: ${({ $active }) => ($active ? "#f6f7ff" : "#fff")};
  padding: 13px 14px;
  box-shadow: 0 7px 22px -18px rgb(27 42 74 / 35%);
  color: inherit;
  cursor: pointer;
  text-align: left;
  transition: 150ms ease;

  &:hover { border-color: #cbd2e4; transform: translateY(-1px); }
  &:focus-visible { outline: 3px solid rgb(65 91 165 / 18%); outline-offset: 2px; }

  > span {
    display: grid;
    width: 38px;
    height: 38px;
    flex: 0 0 auto;
    place-items: center;
    border-radius: 11px;
    background: ${({ $tone }) =>
      $tone === "success" ? "#eaf8f1" : $tone === "warning" ? "#fff6df" : $tone === "danger" ? "#fff0ef" : "#eef2ff"};
    color: ${({ $tone, theme }) =>
      $tone === "success" ? "#25805d" : $tone === "warning" ? "#a86d14" : $tone === "danger" ? "#c84a44" : theme.colors.brand.primary};
  }

  strong { display: block; color: #344054; font-size: 18px; font-weight: 900; line-height: 1; }
  small { display: block; margin-top: 5px; color: #98a2b3; font-size: 9px; font-weight: 750; }
`;

export const Workspace = styled.div`
  display: grid;
  grid-template-columns: 225px 255px minmax(0, 1fr);
  min-height: 560px;
  overflow: hidden;
  border: 1px solid #e5e8ef;
  border-radius: 18px;
  background: #fff;
  box-shadow: 0 12px 30px -26px rgb(27 42 74 / 40%);

  @media (max-width: 1120px) { grid-template-columns: 210px minmax(0, 1fr); }
  @media (max-width: 760px) { display: block; overflow: visible; }
`;

const rail = css`
  min-width: 0;
  border-right: 1px solid #eaecf0;
  background: #fbfcfe;
  padding: 16px 13px;

  @media (max-width: 760px) {
    border-right: 0;
    border-bottom: 1px solid #eaecf0;
  }
`;

export const CategoryRail = styled.aside`
  ${rail}
`;

export const FolderRail = styled.aside`
  ${rail}
  background: #fdfdfe;

  @media (max-width: 1120px) {
    grid-column: 1;
    border-top: 1px solid #eaecf0;
  }
`;

export const RailHeading = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 12px;

  div { min-width: 0; }
  strong { display: block; color: #344054; font-size: 11px; font-weight: 900; }
  small { display: block; margin-top: 3px; color: #98a2b3; font-size: 8px; font-weight: 700; }
`;

export const TinyButton = styled.button`
  display: inline-grid;
  min-width: 28px;
  height: 28px;
  place-items: center;
  border: 1px solid #dfe3eb;
  border-radius: 8px;
  background: #fff;
  color: #667085;
  cursor: pointer;

  &:hover { border-color: #bfc8df; color: ${({ theme }) => theme.colors.brand.primary}; }
  &:focus-visible { outline: 3px solid rgb(65 91 165 / 18%); }
  &:disabled { cursor: not-allowed; opacity: .55; }
  svg { width: 14px; height: 14px; }
`;

export const RailList = styled.div`
  display: grid;
  max-height: 440px;
  gap: 6px;
  overflow: auto;

  @media (max-width: 760px) {
    display: flex;
    max-height: none;
    padding-bottom: 3px;
  }
`;

export const RailItem = styled.button<{ $active?: boolean }>`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  min-width: 0;
  align-items: center;
  gap: 9px;
  border: 1px solid ${({ $active }) => ($active ? "#c4ccef" : "transparent")};
  border-radius: 11px;
  background: ${({ $active }) => ($active ? "#f1f3ff" : "transparent")};
  padding: 9px;
  color: ${({ $active }) => ($active ? "#344054" : "#667085")};
  cursor: pointer;
  text-align: left;

  &:hover { background: ${({ $active }) => ($active ? "#f1f3ff" : "#f5f7fa")}; }
  &:focus-visible { outline: 3px solid rgb(65 91 165 / 18%); }

  @media (max-width: 760px) { min-width: 170px; }
`;

export const RailIcon = styled.span<{ $color?: string }>`
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  border-radius: 9px;
  background: ${({ $color }) => `${$color ?? "#415BA5"}16`};
  color: ${({ $color }) => $color ?? "#415BA5"};
  svg { width: 15px; height: 15px; }
`;

export const RailText = styled.span`
  min-width: 0;
  strong { display: block; overflow: hidden; font-size: 10px; font-weight: 850; text-overflow: ellipsis; white-space: nowrap; }
  small { display: block; overflow: hidden; margin-top: 3px; color: #98a2b3; font-size: 8px; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
`;

export const RailCount = styled.span`
  border-radius: 999px;
  background: #fff;
  padding: 3px 6px;
  color: #98a2b3;
  font-size: 8px;
  font-weight: 850;
`;

export const RailEmpty = styled.p`
  margin: 14px 4px;
  color: #98a2b3;
  font-size: 9px;
  font-weight: 650;
  line-height: 1.6;
`;

export const Main = styled.main`
  min-width: 0;
  padding: 17px;

  @media (max-width: 1120px) { grid-column: 2; grid-row: 1 / span 2; }
  @media (max-width: 760px) { padding: 14px; }
`;

export const Breadcrumb = styled.nav`
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 6px;
  margin-bottom: 13px;
  color: #98a2b3;
  font-size: 9px;
  font-weight: 750;

  button { border: 0; background: transparent; padding: 0; color: inherit; cursor: pointer; }
  button:hover { color: ${({ theme }) => theme.colors.brand.primary}; }
  strong { overflow: hidden; color: #475467; text-overflow: ellipsis; white-space: nowrap; }
  svg { width: 12px; height: 12px; flex: 0 0 auto; }
`;

export const Toolbar = styled.div`
  display: grid;
  grid-template-columns: minmax(190px, 1.4fr) repeat(2, minmax(130px, .65fr)) auto;
  gap: 8px;
  margin-bottom: 9px;

  @media (max-width: 1000px) { grid-template-columns: 1fr 1fr; }
  @media (max-width: 560px) { grid-template-columns: 1fr; }
`;

export const SearchField = styled.label`
  position: relative;
  display: block;

  > svg { position: absolute; top: 50%; left: 11px; width: 15px; height: 15px; color: #98a2b3; transform: translateY(-50%); }
  input { padding-left: 34px; padding-right: 34px; }
  button { position: absolute; top: 50%; right: 7px; display: grid; width: 25px; height: 25px; place-items: center; border: 0; background: transparent; color: #98a2b3; transform: translateY(-50%); cursor: pointer; }
`;

const control = css`
  width: 100%;
  min-height: 39px;
  border: 1px solid #dfe3eb;
  border-radius: 10px;
  outline: none;
  background: #fff;
  padding: 0 11px;
  color: #475467;
  font: inherit;
  font-size: 10px;
  font-weight: 700;

  &:focus { border-color: ${({ theme }) => theme.colors.brand.primary}; box-shadow: ${({ theme }) => theme.shadows.focus}; }
  &:disabled { background: #f6f7f9; cursor: not-allowed; }
`;

export const Input = styled.input`
  ${control}
`;

export const Select = styled.select`
  ${control}
`;

export const Textarea = styled.textarea`
  ${control}
  min-height: 92px;
  resize: vertical;
  padding-top: 10px;
  line-height: 1.5;
`;

export const Filters = styled.div<{ $open?: boolean }>`
  display: ${({ $open }) => ($open ? "grid" : "none")};
  grid-template-columns: repeat(4, minmax(120px, 1fr));
  gap: 8px;
  margin-bottom: 14px;
  border: 1px solid #edf0f4;
  border-radius: 12px;
  background: #fafbfc;
  padding: 11px;

  @media (max-width: 920px) { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  @media (max-width: 520px) { grid-template-columns: 1fr; }
`;

export const Field = styled.label`
  display: grid;
  gap: 6px;
  min-width: 0;

  > span { color: #667085; font-size: 9px; font-weight: 850; }
  > small { color: #c84a44; font-size: 8px; font-weight: 700; }
`;

export const FilterButton = styled.button<{ $active?: boolean }>`
  display: inline-flex;
  min-height: 39px;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border: 1px solid ${({ $active }) => ($active ? "#aebae6" : "#dfe3eb")};
  border-radius: 10px;
  background: ${({ $active }) => ($active ? "#f1f3ff" : "#fff")};
  padding: 0 12px;
  color: ${({ $active }) => ($active ? "#415BA5" : "#667085")};
  font-size: 10px;
  font-weight: 800;
  cursor: pointer;
  svg { width: 14px; height: 14px; }
`;

export const ListHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin: 13px 0 9px;
  strong { color: #344054; font-size: 11px; font-weight: 900; }
  span { color: #98a2b3; font-size: 9px; font-weight: 700; }
`;

export const TableWrap = styled.div`
  position: relative;
  min-height: 260px;
  overflow: auto;
  border: 1px solid #e8ebf0;
  border-radius: 13px;
`;

export const Table = styled.table`
  width: 100%;
  min-width: 780px;
  border-collapse: collapse;

  th { background: #fafbfc; padding: 10px; color: #98a2b3; font-size: 8px; font-weight: 900; letter-spacing: .03em; text-align: left; text-transform: uppercase; }
  td { border-top: 1px solid #edf0f4; padding: 11px 10px; color: #667085; font-size: 9px; font-weight: 650; vertical-align: middle; }
  tbody tr:hover { background: #fcfcfe; }
`;

export const DocumentCell = styled.div`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 9px;
  min-width: 220px;
  strong { display: block; overflow: hidden; max-width: 270px; color: #344054; font-size: 10px; font-weight: 850; text-overflow: ellipsis; white-space: nowrap; }
  small { display: block; overflow: hidden; max-width: 270px; margin-top: 3px; color: #98a2b3; font-size: 8px; text-overflow: ellipsis; white-space: nowrap; }
`;

export const FileIcon = styled.span<{ $kind?: "pdf" | "image" | "sheet" | "word" }>`
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border-radius: 10px;
  background: ${({ $kind }) => $kind === "pdf" ? "#fff0ef" : $kind === "image" ? "#eaf8f1" : $kind === "sheet" ? "#eaf8f1" : "#eef2ff"};
  color: ${({ $kind, theme }) => $kind === "pdf" ? "#c84a44" : $kind === "image" || $kind === "sheet" ? "#25805d" : theme.colors.brand.primary};
  svg { width: 16px; height: 16px; }
`;

export const PathCell = styled.div`
  strong { display: block; color: #475467; font-size: 9px; font-weight: 800; }
  small { display: block; margin-top: 3px; color: #98a2b3; font-size: 8px; }
`;

export const Tags = styled.div`
  display: flex;
  max-width: 180px;
  flex-wrap: wrap;
  gap: 4px;
`;

export const Tag = styled.span`
  display: inline-flex;
  min-height: 20px;
  align-items: center;
  border-radius: 999px;
  background: #f1f3ff;
  padding: 0 7px;
  color: #5267ad;
  font-size: 8px;
  font-weight: 800;
`;

export const Status = styled.span<{ $status: "ACTIVE" | "ARCHIVED" | "DELETED" }>`
  display: inline-flex;
  min-height: 23px;
  align-items: center;
  border-radius: 999px;
  background: ${({ $status }) => $status === "ACTIVE" ? "#eaf8f1" : $status === "ARCHIVED" ? "#fff6df" : "#fff0ef"};
  padding: 0 8px;
  color: ${({ $status }) => $status === "ACTIVE" ? "#25805d" : $status === "ARCHIVED" ? "#9b6414" : "#c84a44"};
  font-size: 8px;
  font-weight: 850;
`;

export const RowActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 4px;
`;

export const IconButton = styled.button<{ $danger?: boolean }>`
  display: grid;
  width: 29px;
  height: 29px;
  place-items: center;
  border: 1px solid #e1e5ec;
  border-radius: 8px;
  background: #fff;
  color: ${({ $danger }) => ($danger ? "#c84a44" : "#667085")};
  cursor: pointer;
  &:hover { border-color: ${({ $danger }) => ($danger ? "#efb7b3" : "#bcc5dc")}; background: ${({ $danger }) => ($danger ? "#fff8f7" : "#f8faff")}; }
  &:disabled { cursor: not-allowed; opacity: .45; }
  svg { width: 14px; height: 14px; }
`;

export const BusyOverlay = styled.div`
  position: absolute;
  inset: 0;
  z-index: 3;
  display: grid;
  place-items: center;
  background: rgb(255 255 255 / 72%);
  color: ${({ theme }) => theme.colors.brand.primary};
  backdrop-filter: blur(1px);
  svg { width: 25px; height: 25px; animation: spin .75s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
`;

export const Empty = styled.div`
  display: grid;
  min-height: 250px;
  place-items: center;
  border: 1px dashed #dce1e9;
  border-radius: 13px;
  background: #fcfdfe;
  padding: 28px;
  text-align: center;
  > div { display: grid; justify-items: center; max-width: 420px; }
  > div > span { display: grid; width: 50px; height: 50px; place-items: center; border-radius: 14px; background: #eef2ff; color: ${({ theme }) => theme.colors.brand.primary}; }
  h3 { margin: 13px 0 0; color: #344054; font-size: 14px; font-weight: 900; }
  p { margin: 7px 0 15px; color: #98a2b3; font-size: 10px; font-weight: 650; line-height: 1.6; }
`;

export const Pagination = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 12px;
  color: #98a2b3;
  font-size: 9px;
  font-weight: 700;
  > div { display: flex; gap: 6px; }
`;

export const ModalContent = styled.div`
  display: grid;
  gap: 15px;
  padding: 2px;
`;

export const FormGrid = styled.div<{ $columns?: number }>`
  display: grid;
  grid-template-columns: repeat(${({ $columns }) => $columns ?? 2}, minmax(0, 1fr));
  gap: 12px;
  @media (max-width: 640px) { grid-template-columns: 1fr; }
`;

export const SpanAll = styled.div`
  grid-column: 1 / -1;
`;

export const ModalFooter = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
`;

export const ManagerToolbar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  border-bottom: 1px solid #edf0f4;
  padding-bottom: 12px;
`;

export const Segmented = styled.div`
  display: inline-flex;
  border: 1px solid #dfe3eb;
  border-radius: 10px;
  background: #f8f9fb;
  padding: 3px;
  button { min-height: 29px; border: 0; border-radius: 7px; background: transparent; padding: 0 10px; color: #667085; font-size: 9px; font-weight: 800; cursor: pointer; }
  button[data-active="true"] { background: #fff; color: #415BA5; box-shadow: 0 2px 7px rgb(27 42 74 / 10%); }
`;

export const ManagerList = styled.div`
  display: grid;
  max-height: 390px;
  gap: 7px;
  overflow: auto;
`;

export const ManagerItem = styled.article`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  border: 1px solid #e7eaf0;
  border-radius: 11px;
  padding: 10px;
  > div { min-width: 0; }
  strong { display: block; overflow: hidden; color: #344054; font-size: 10px; font-weight: 850; text-overflow: ellipsis; white-space: nowrap; }
  p { overflow: hidden; margin: 3px 0 0; color: #98a2b3; font-size: 8px; text-overflow: ellipsis; white-space: nowrap; }
`;

export const ManagerActions = styled.div`
  display: flex;
  gap: 4px;
`;

export const ColorGrid = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
`;

export const ColorButton = styled.button<{ $color: string; $active?: boolean }>`
  width: 29px;
  height: 29px;
  border: 3px solid ${({ $active }) => ($active ? "#fff" : "transparent")};
  border-radius: 9px;
  outline: ${({ $active }) => ($active ? "2px solid #98a2b3" : "none")};
  background: ${({ $color }) => $color};
  cursor: pointer;
`;

export const DropZone = styled.label`
  position: relative;
  display: grid;
  min-height: 130px;
  place-items: center;
  border: 1.5px dashed #cfd6e3;
  border-radius: 13px;
  background: #fafbfc;
  padding: 20px;
  color: #667085;
  cursor: pointer;
  text-align: center;
  &:hover, &:focus-within { border-color: ${({ theme }) => theme.colors.brand.primary}; background: #f8faff; }
  input { position: absolute; width: 1px; height: 1px; opacity: 0; }
  div { display: grid; justify-items: center; gap: 6px; }
  svg { width: 27px; height: 27px; color: ${({ theme }) => theme.colors.brand.primary}; }
  strong { color: #475467; font-size: 11px; font-weight: 850; }
  small { max-width: 430px; color: #98a2b3; font-size: 9px; font-weight: 650; line-height: 1.5; }
`;

export const UploadList = styled.div`
  display: grid;
  max-height: 250px;
  gap: 7px;
  overflow: auto;
`;

export const UploadItem = styled.div`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 9px;
  border: 1px solid #e8ebf0;
  border-radius: 10px;
  padding: 9px;
  strong { display: block; overflow: hidden; color: #475467; font-size: 9px; font-weight: 800; text-overflow: ellipsis; white-space: nowrap; }
  small { display: block; margin-top: 3px; color: #98a2b3; font-size: 8px; }
`;

export const Progress = styled.div`
  height: 5px;
  overflow: hidden;
  border-radius: 999px;
  background: #edf0f4;
  span { display: block; height: 100%; border-radius: inherit; background: #415BA5; transition: width 200ms ease; }
`;

export const Preview = styled.div`
  display: grid;
  min-height: 300px;
  overflow: hidden;
  place-items: center;
  border: 1px solid #e5e8ef;
  border-radius: 13px;
  background: #f7f8fa;
  iframe { width: 100%; height: 420px; border: 0; background: #fff; }
  img { display: block; max-width: 100%; max-height: 420px; object-fit: contain; }
  > div { display: grid; justify-items: center; gap: 9px; padding: 25px; color: #98a2b3; font-size: 10px; font-weight: 700; text-align: center; }
`;

export const DetailGrid = styled.dl`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin: 0;
  > div { min-width: 0; border: 1px solid #edf0f4; border-radius: 10px; background: #fcfcfd; padding: 10px; }
  dt { color: #98a2b3; font-size: 8px; font-weight: 850; text-transform: uppercase; }
  dd { overflow-wrap: anywhere; margin: 5px 0 0; color: #475467; font-size: 10px; font-weight: 750; line-height: 1.5; }
  @media (max-width: 650px) { grid-template-columns: 1fr 1fr; }
  @media (max-width: 430px) { grid-template-columns: 1fr; }
`;

export const Confirmation = styled.div`
  display: grid;
  justify-items: center;
  gap: 10px;
  padding: 10px 4px;
  text-align: center;
  > span { display: grid; width: 48px; height: 48px; place-items: center; border-radius: 14px; background: #fff0ef; color: #c84a44; }
  p { max-width: 460px; margin: 0; color: #667085; font-size: 11px; font-weight: 650; line-height: 1.6; }
  strong { color: #344054; }
`;
