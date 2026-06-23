"use client";

import styled, { css } from "styled-components";

type TableCellProps = {
  $strong?: boolean;
};

type TableCheckboxProps = {
  $checked: boolean;
};

export const TableRoot = styled.section`
  overflow: hidden;
  border: 1px solid ${({ theme }) => theme.colors.border.soft};
  border-radius: ${({ theme }) => theme.radius.lg};
  background: ${({ theme }) => theme.colors.surface.card};
  box-shadow: ${({ theme }) => theme.shadows.card};
`;

export const TableToolbar = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border.soft};
  background: ${({ theme }) => theme.colors.surface.card};
  padding: 20px;

  @media (min-width: 768px) {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
`;

export const SearchWrapper = styled.div`
  position: relative;
  width: 100%;

  @media (min-width: 768px) {
    max-width: 360px;
  }
`;

export const SearchIcon = styled.span`
  pointer-events: none;
  position: absolute;
  top: 50%;
  left: 16px;
  display: inline-flex;
  transform: translateY(-50%);
  color: #8a8f98;

  svg {
    width: 18px;
    height: 18px;
    stroke-width: 1.7;
  }
`;

export const SearchInput = styled.input`
  width: 100%;
  min-height: 48px;
  border: 1px solid ${({ theme }) => theme.colors.border.soft};
  border-radius: ${({ theme }) => theme.radius.sm};
  background: ${({ theme }) => theme.colors.surface.card};
  color: ${({ theme }) => theme.colors.text.title};
  outline: none;
  padding: 0 16px 0 44px;
  font-size: 14px;
  font-weight: 500;
  transition:
    border-color ${({ theme }) => theme.transitions.default},
    box-shadow ${({ theme }) => theme.transitions.default};

  &::placeholder {
    color: ${({ theme }) => theme.colors.text.soft};
  }

  &:focus {
    border-color: ${({ theme }) => theme.colors.brand.primary};
    box-shadow: 0 0 0 3px rgba(65, 91, 165, 0.1);
  }
`;

export const ToolbarActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
`;

export const ScrollArea = styled.div`
  overflow-x: auto;
`;

export const TableElement = styled.table`
  width: 100%;
  min-width: 980px;
  border-collapse: collapse;
`;

export const TableHeader = styled.thead`
  background: ${({ theme }) => theme.colors.border.soft};
`;

export const TableBody = styled.tbody`
  background: ${({ theme }) => theme.colors.surface.card};

  tr + tr {
    border-top: 1px solid ${({ theme }) => theme.colors.border.soft};
  }
`;

export const TableRow = styled.tr`
  transition: background ${({ theme }) => theme.transitions.default};

  &:hover {
    background: ${({ theme }) => theme.colors.surface.soft};
  }
`;

export const TableHead = styled.th`
  height: 48px;
  padding: 0 20px;
  text-align: left;
  white-space: nowrap;
  color: ${({ theme }) => theme.colors.text.muted};
  font-size: 12px;
  font-weight: 600;
`;

export const TableHeadContent = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 8px;

  svg {
    width: 14px;
    height: 14px;
    color: ${({ theme }) => theme.colors.text.muted};
    stroke-width: 1.7;
  }
`;

export const TableCell = styled.td<TableCellProps>`
  height: 48px;
  padding: 0 20px;
  white-space: nowrap;
  font-size: 13px;

  ${({ $strong, theme }) =>
    $strong
      ? css`
          color: ${theme.colors.text.title};
          font-weight: 700;
        `
      : css`
          color: ${theme.colors.text.muted};
          font-weight: 500;
        `}
`;

export const TableCheckbox = styled.span<TableCheckboxProps>`
  display: inline-flex;
  width: 20px;
  height: 20px;
  align-items: center;
  justify-content: center;
  border: 1px solid
    ${({ theme, $checked }) =>
      $checked ? theme.colors.brand.primary : theme.colors.border.default};
  border-radius: 5px;
  background: ${({ theme, $checked }) =>
    $checked ? theme.colors.brand.primary : theme.colors.surface.card};
  color: ${({ theme, $checked }) =>
    $checked ? theme.colors.text.inverse : "transparent"};
  transition:
    background ${({ theme }) => theme.transitions.default},
    border-color ${({ theme }) => theme.transitions.default},
    color ${({ theme }) => theme.transitions.default};

  svg {
    width: 13px;
    height: 13px;
    stroke-width: 2.4;
  }
`;

export const ActionButton = styled.button`
  display: inline-flex;
  width: 32px;
  height: 32px;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: ${({ theme }) => theme.radius.sm};
  background: transparent;
  color: ${({ theme }) => theme.colors.text.muted};
  transition:
    background ${({ theme }) => theme.transitions.default},
    color ${({ theme }) => theme.transitions.default};

  &:hover {
    background: ${({ theme }) => theme.colors.surface.muted};
    color: ${({ theme }) => theme.colors.text.title};
  }

  svg {
    width: 17px;
    height: 17px;
    stroke-width: 1.7;
  }
`;
