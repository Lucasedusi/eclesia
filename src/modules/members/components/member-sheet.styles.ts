"use client";

import styled from "styled-components";

export const Content = styled.div`
  display: grid;
  gap: 20px;
  color: ${({ theme }) => theme.colors.text.body};
`;
export const MemberName = styled.p`
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  overflow-wrap: anywhere;
  color: ${({ theme }) => theme.colors.text.title};
`;
export const Included = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.colors.brand.primarySoft};
  > svg { flex-shrink: 0; color: ${({ theme }) => theme.colors.brand.primary}; }
  strong { font-size: 14px; }
  p { margin: 6px 0 10px; font-size: 13px; line-height: 1.5; }
  small { color: ${({ theme }) => theme.colors.brand.primary}; font-weight: 600; }
`;
export const Options = styled.fieldset`
  display: grid;
  gap: 10px;
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
  legend { padding: 0 0 12px; font-size: 14px; font-weight: 600; }
  &:disabled { opacity: 0.65; }
`;
export const Option = styled.div<{ $selected: boolean }>`
  padding: 14px 16px;
  border: 1px solid ${({ theme, $selected }) => $selected ? theme.colors.brand.primary : theme.colors.border.soft};
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme, $selected }) => $selected ? theme.colors.brand.primarySoft : theme.colors.surface.card};
  > label { width: 100%; }
  p { margin: 6px 0 0 30px; color: ${({ theme }) => theme.colors.text.muted}; font-size: 13px; line-height: 1.5; }
`;
export const Hint = styled.p`
  margin: 0;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.text.muted};
`;
export const Feedback = styled.p<{ $error: boolean }>`
  margin: 0;
  padding: 12px 14px;
  border-radius: ${({ theme }) => theme.radius.md};
  font-size: 13px;
  line-height: 1.5;
  color: ${({ theme }) => theme.colors.text.body};
  background: ${({ theme, $error }) => $error ? theme.colors.state.dangerSoft : theme.colors.state.successSoft};
`;
export const Footer = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
  width: 100%;
  @media (max-width: 480px) { > button { flex: 1; } }
`;
