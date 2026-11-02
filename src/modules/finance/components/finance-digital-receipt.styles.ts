"use client";
import styled from "styled-components";

export const DigitalReceiptContent = styled.div`
  display: grid;
  gap: 22px;
  color: ${({ theme }) => theme.colors.text.body};
  font-size: 13px;
  .digital-summary { display: flex; gap: 12px; align-items: flex-start; padding: 17px; border: 1px solid ${({ theme }) => theme.colors.border.default}; border-radius: 14px; background: ${({ theme }) => theme.colors.surface.soft}; }
  .digital-summary-icon { display: grid; place-items: center; width: 36px; height: 40px; flex: 0 0 36px; border-radius: 9px; color: #176348; background: #edf5ef; }
  .digital-summary strong { display: block; margin: 1px 0 6px; font-size: 13px; font-weight: 500; color: ${({ theme }) => theme.colors.text.title}; }
  .digital-summary small { display: block; color: ${({ theme }) => theme.colors.text.muted}; font-size: 10px; line-height: 1.6; overflow-wrap: anywhere; }
  .digital-links { display: flex; flex-wrap: wrap; gap: 14px 20px; }
  .digital-links a { display: inline-flex; align-items: center; gap: 6px; color: #176348; text-decoration: none; font-size: 12px; font-weight: 500; }
  .digital-links a:hover { text-decoration: underline; }
  .digital-phone { display: grid; gap: 8px; font-size: 12px; font-weight: 500; }
  .digital-phone input { width: 100%; min-height: 46px; border: 1px solid ${({ theme }) => theme.colors.border.default}; border-radius: 10px; padding: 11px 13px; color: ${({ theme }) => theme.colors.text.title}; background: ${({ theme }) => theme.colors.surface.card}; font: inherit; font-size: 14px; }
  .digital-phone input:focus-visible { outline: 2px solid #a3c8b2; outline-offset: 2px; }
  .digital-hint { color: ${({ theme }) => theme.colors.text.muted}; font-size: 11px; line-height: 1.6; margin: 8px 0 0; }
  .digital-note { display: flex; align-items: flex-start; gap: 8px; font-size: 11px; line-height: 1.65; color: ${({ theme }) => theme.colors.text.muted}; padding-top: 17px; border-top: 1px solid ${({ theme }) => theme.colors.border.soft}; }
  .digital-note svg { flex-shrink: 0; margin-top: 2px; }
  .digital-error { color: ${({ theme }) => theme.colors.state.danger}; font-size: 12px; margin: 9px 0 0; }
`;

export const ReceiptActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 18px;
  & > button { font-size: 12px; min-height: 36px; gap: 6px; }
  & + & { padding-top: 12px; border-top: 1px solid ${({ theme }) => theme.colors.border.soft}; }
`;

export const DigitalReceiptFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  width: 100%;
  gap: 8px;
  & > button { min-height: 44px; padding: 11px 14px; font-size: 12px; font-weight: 500; gap: 6px; white-space: nowrap; }
  @media (max-width: 480px) { & > button { flex: 1; } }
`;
