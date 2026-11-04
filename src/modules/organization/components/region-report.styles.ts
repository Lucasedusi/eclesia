"use client";

import styled from "styled-components";

export const Content = styled.div`
  display: grid;
  gap: 20px;
  min-width: 0;
`;
export const Options = styled.fieldset`
  display: grid;
  gap: 12px;
  min-width: 0;
  border: 0;
  padding: 0;
  margin: 0;
  legend { margin-bottom: 10px; font-weight: 700; color: ${({ theme }) => theme.colors.text.body}; font-size: 13px; }
  &:disabled { opacity: 0.65; }
`;
export const Choice = styled.label<{ $selected: boolean }>`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 15px;
  border: 1px solid ${({ $selected, theme }) => $selected ? theme.colors.brand.primary : theme.colors.border.soft};
  border-radius: 8px;
  background: ${({ $selected }) => $selected ? "#f4f6ff" : "#fff"};
  cursor: pointer;
  input { margin-top: 4px; accent-color: ${({ theme }) => theme.colors.brand.primary}; }
  strong { display: block; color: ${({ theme }) => theme.colors.text.body}; font-size: 13px; }
  small { display: block; margin-top: 4px; color: #667085; font-size: 12px; line-height: 1.5; }
`;
export const Field = styled.label`
  display: grid;
  gap: 7px;
  font-size: 12px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text.body};
  select { width: 100%; min-width: 0; min-height: 44px; border: 1px solid #d9deea; border-radius: 6px; background: #fff; padding: 8px 10px; color: inherit; font: inherit; }
  select:focus-visible { outline: 2px solid ${({ theme }) => theme.colors.brand.primary}; outline-offset: 2px; }
`;
export const Hint = styled.p`
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  color: #667085;
  overflow-wrap: anywhere;
`;
export const Feedback = styled.p<{ $error: boolean }>`
  margin: 0;
  padding: 12px;
  border-radius: 6px;
  background: ${({ $error }) => $error ? "#fff0ef" : "#eef9f3"};
  color: ${({ $error }) => $error ? "#a62a22" : "#1b6944"};
  font-size: 13px;
`;
export const Footer = styled.div`
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 10px;
`;
