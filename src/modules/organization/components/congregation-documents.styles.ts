"use client";

import styled from "styled-components";

export const Content = styled.div`
  display: grid;
  gap: 22px;
  margin: 10px;
`;

export const UploadPanel = styled.section`
  border: 1px solid #e4e8f0;
  border-radius: 14px;
  background: #fafbfc;
  padding: 16px;
`;

export const SectionHeading = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;

  h3 {
    margin: 0;
    color: #344054;
    font-size: 13px;
    font-weight: 900;
  }

  p {
    margin: 4px 0 0;
    color: #98a2b3;
    font-size: 10px;
    font-weight: 650;
    line-height: 1.5;
  }
`;

export const UploadForm = styled.form`
  display: grid;
  gap: 14px;
  margin-top: 15px;
`;

export const FormGrid = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(170px, 0.8fr);
  gap: 12px;

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`;

export const Field = styled.label`
  display: grid;
  gap: 7px;

  > span {
    color: #475467;
    font-size: 10px;
    font-weight: 850;
  }
`;

const controlStyles = `
  width: 100%;
  min-height: 44px;
  border: 1px solid #d9deea;
  border-radius: 10px;
  outline: 0;
  background: #fff;
  padding: 0 13px;
  color: #344054;
  font-size: 12px;
  font-weight: 650;
`;

export const Input = styled.input<{ $invalid?: boolean }>`
  ${controlStyles}
  border-color: ${({ $invalid }) => ($invalid ? "#ef7770" : "#d9deea")};

  &:focus {
    border-color: ${({ theme }) => theme.colors.brand.primary};
    box-shadow: ${({ theme }) => theme.shadows.focus};
  }
`;

export const Select = styled.select<{ $invalid?: boolean }>`
  ${controlStyles}
  border-color: ${({ $invalid }) => ($invalid ? "#ef7770" : "#d9deea")};

  &:focus {
    border-color: ${({ theme }) => theme.colors.brand.primary};
    box-shadow: ${({ theme }) => theme.shadows.focus};
  }
`;

export const FileDrop = styled.label<{ $invalid?: boolean }>`
  position: relative;
  display: grid;
  min-height: 104px;
  place-items: center;
  border: 1.5px dashed ${({ $invalid }) => ($invalid ? "#ef7770" : "#cfd6e3")};
  border-radius: 12px;
  background: #fff;
  padding: 16px;
  color: #667085;
  cursor: pointer;
  text-align: center;
  transition:
    border-color 150ms ease,
    background 150ms ease;

  &:hover {
    border-color: ${({ theme }) => theme.colors.brand.primary};
    background: #f8faff;
  }

  &:focus-within {
    border-color: ${({ theme }) => theme.colors.brand.primary};
    box-shadow: ${({ theme }) => theme.shadows.focus};
  }

  input {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    opacity: 0;
  }

  > div {
    display: grid;
    justify-items: center;
    gap: 5px;
  }

  svg {
    width: 23px;
    height: 23px;
    color: ${({ theme }) => theme.colors.brand.primary};
  }

  strong {
    color: #475467;
    font-size: 11px;
    font-weight: 850;
  }

  small {
    color: #98a2b3;
    font-size: 9px;
    font-weight: 650;
    line-height: 1.45;
  }
`;

export const SelectedFile = styled.span`
  display: inline-flex;
  max-width: 100%;
  align-items: center;
  gap: 7px;
  border-radius: 8px;
  background: #eef2ff;
  color: ${({ theme }) => theme.colors.brand.primary};
  padding: 6px 9px;
  font-size: 9px;
  font-weight: 800;

  svg {
    width: 13px;
    height: 13px;
  }
`;

export const FieldError = styled.small`
  color: #c84a44;
  font-size: 9px;
  font-weight: 750;
`;

export const UploadFooter = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;

  > small {
    color: #98a2b3;
    font-size: 9px;
    font-weight: 650;
  }

  @media (max-width: 520px) {
    align-items: stretch;
    flex-direction: column;
  }
`;

export const DocumentsSection = styled.section`
  display: grid;
  gap: 13px;
`;

export const CountBadge = styled.span`
  display: inline-flex;
  min-height: 25px;
  align-items: center;
  border-radius: 999px;
  background: #eef2ff;
  color: ${({ theme }) => theme.colors.brand.primary};
  padding: 0 9px;
  font-size: 9px;
  font-weight: 850;
`;

export const LoadingState = styled.div`
  display: grid;
  min-height: 150px;
  place-items: center;
  color: #98a2b3;
  font-size: 10px;
  font-weight: 700;

  span {
    display: grid;
    justify-items: center;
    gap: 10px;
  }

  svg {
    width: 24px;
    height: 24px;
    color: ${({ theme }) => theme.colors.brand.primary};
    animation: spin 0.75s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`;

export const EmptyState = styled.div`
  display: grid;
  min-height: 150px;
  place-items: center;
  border: 1px dashed #dce1e9;
  border-radius: 13px;
  background: #fbfcfd;
  padding: 22px;
  text-align: center;

  > div {
    place-items: center;
  }

  span {
    display: grid;
    width: 44px;
    height: 44px;
    place-items: center;
    border-radius: 12px;
    background: #eef2ff;
    color: ${({ theme }) => theme.colors.brand.primary};
  }

  h4 {
    margin: 10px 0 0;
    color: #475467;
    font-size: 12px;
    font-weight: 900;
  }

  p {
    margin: 5px 0 0;
    color: #98a2b3;
    font-size: 10px;
    font-weight: 650;
  }
`;

export const ErrorState = styled(EmptyState)`
  border-color: #ffd5d2;
  background: #fff8f7;

  span {
    background: #fff0ef;
    color: #c84a44;
  }
`;

export const DocumentList = styled.div`
  display: grid;
  gap: 9px;
`;

export const DocumentRow = styled.article`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  border: 1px solid #e7eaf0;
  border-radius: 12px;
  background: #fff;
  padding: 12px;

  @media (max-width: 620px) {
    grid-template-columns: auto minmax(0, 1fr);
  }
`;

export const DocumentIcon = styled.span<{ $image?: boolean }>`
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  border-radius: 11px;
  background: ${({ $image }) => ($image ? "#eaf8f1" : "#eef2ff")};
  color: ${({ $image, theme }) =>
    $image ? "#25805d" : theme.colors.brand.primary};

  svg {
    width: 19px;
    height: 19px;
  }
`;

export const DocumentInfo = styled.div`
  min-width: 0;

  strong {
    display: block;
    overflow: hidden;
    color: #344054;
    font-size: 11px;
    font-weight: 850;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  > span {
    display: flex;
    flex-wrap: wrap;
    gap: 5px 9px;
    margin-top: 5px;
    color: #98a2b3;
    font-size: 9px;
    font-weight: 650;
  }
`;

export const DocumentActions = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 5px;

  @media (max-width: 620px) {
    grid-column: 1 / -1;
    justify-content: flex-start;
    border-top: 1px solid #eef0f4;
    padding-top: 10px;
  }
`;

export const DocumentAction = styled.button<{ $danger?: boolean }>`
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border: 1px solid #e1e5ec;
  border-radius: 8px;
  background: #fff;
  color: ${({ $danger }) => ($danger ? "#c84a44" : "#667085")};
  transition: 140ms ease;

  &:hover:not(:disabled) {
    border-color: ${({ $danger, theme }) =>
      $danger ? "#ef7770" : theme.colors.brand.primary};
    background: ${({ $danger }) => ($danger ? "#fff4f3" : "#f6f8ff")};
    color: ${({ $danger, theme }) =>
      $danger ? "#c84a44" : theme.colors.brand.primary};
  }

  &:disabled {
    opacity: 0.5;
    cursor: wait;
  }

  svg {
    width: 14px;
    height: 14px;
  }

  &[data-loading="true"] svg {
    animation: spin 0.75s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`;

export const EditForm = styled.form`
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: minmax(0, 1.3fr) minmax(160px, 0.7fr) auto;
  align-items: end;
  gap: 9px;
  border-top: 1px solid #eef0f4;
  padding-top: 12px;

  @media (max-width: 700px) {
    grid-template-columns: 1fr;
  }
`;

export const EditActions = styled.div`
  display: flex;
  gap: 7px;
`;

export const DeleteText = styled.div`
  border: 1px solid #ffe0dd;
  border-radius: 12px;
  background: #fff8f7;
  padding: 13px;
  color: #667085;
  font-size: 11px;
  font-weight: 650;
  line-height: 1.6;

  strong {
    color: #344054;
  }
`;
