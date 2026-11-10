"use client";
import styled, { css } from "styled-components";

// Opt-in: financial components retain their independent visual identity.
export const administrativeControl = css`
  width: 100%;
  height: 52px;
  min-height: 52px;
  border-radius: 6px;
  border: 1px solid #66708596;
  background-color: #fff;
  padding: 0 14px;
  color: #101828;
  font-size: calc(13px + var(--eclesia-font-size-adjustment, 0px));
  font-weight: 400;
  outline: none;
  cursor: text;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    background 0.2s ease;
  &::placeholder {
    color: #98a2b3;
    font-weight: 400;
  }
  &:focus-visible,
  &:focus {
    border-color: #415ba5;
    box-shadow: 0 0 0 3px rgb(65 91 165 / 12%);
  }
  &:disabled {
    background-color: #f3f4f6;
    color: #667085;
    cursor: not-allowed;
    opacity: 0.7;
  }
  &[aria-invalid="true"] {
    border-color: #ef7770;
  }
`;
export const administrativeSelect = css`
  ${administrativeControl}
  cursor: pointer;
  appearance: none;
  padding-right: 42px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23667085' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 14px center;
`;
export const administrativeTextarea = css`
  ${administrativeControl}
  height: auto;
  min-height: 120px;
  padding: 12px 14px;
  resize: vertical;
  line-height: 1.55;
`;
export const AdministrativeInput = styled.input`
  ${administrativeControl}
`;
