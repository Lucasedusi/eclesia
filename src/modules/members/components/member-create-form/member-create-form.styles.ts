"use client";

import styled from "styled-components";

export const FormLayout = styled.div`
  display: grid;
  gap: 20px;

  @media (min-width: 1180px) {
    grid-template-columns: minmax(280px, 360px) minmax(0, 1fr);
    align-items: flex-start;
  }
`;

export const FormCard = styled.form`
  overflow: hidden;
  border: 1px solid ${({ theme }) => theme.colors.border.soft};
  border-radius: 8px;
  background: ${({ theme }) => theme.colors.surface.card};
  box-shadow: ${({ theme }) => theme.shadows.card};
`;

export const FormHeader = styled.header`
  display: flex;
  flex-direction: column;
  gap: 14px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border.soft};
  background: #fffff;
  padding: 26px;

  @media (min-width: 768px) {
    padding: 26px;
  }
`;

export const HeaderBadge = styled.span`
  display: inline-flex;
  width: fit-content;
  align-items: center;
  gap: 8px;
  border-radius: ${({ theme }) => theme.radius.sm};
  background: ${({ theme }) => theme.colors.brand.primarySoft};
  color: ${({ theme }) => theme.colors.brand.primary};
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 800;

  svg {
    width: 15px;
    height: 15px;
    stroke-width: 2;
  }
`;

export const FormTitle = styled.h1`
  color: ${({ theme }) => theme.colors.text.title};
  font-size: 44px;
  font-weight: 700;
  letter-spacing: -0.04em;

  @media (min-width: 768px) {
    font-size: 24px;
  }
`;

export const FormDescription = styled.p`
  max-width: 760px;
  color: ${({ theme }) => theme.colors.text.muted};
  font-size: 13px;
  font-weight: 500;
  line-height: 24px;
`;

export const FormBody = styled.div`
  padding: 24px;

  @media (min-width: 768px) {
    padding: 32px;
  }
`;

export const StepHeader = styled.div`
  margin-bottom: 24px;
`;

export const StepEyebrow = styled.p`
  color: ${({ theme }) => theme.colors.brand.primary};
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  background: rgba(65, 91, 165, 0.1);
  width: fit-content;
  padding: 4px 8px;
  border-radius: ${({ theme }) => theme.radius.sm};
`;

export const StepTitle = styled.h2`
  margin-top: 8px;
  color: ${({ theme }) => theme.colors.text.title};
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -0.03em;
`;

export const StepDescription = styled.p`
  // margin-top: 6px;
  color: ${({ theme }) => theme.colors.text.muted};
  font-size: 14px;
  font-weight: 500;
  line-height: 24px;
`;

export const FieldsGrid = styled.div`
  display: grid;
  gap: 18px;

  @media (min-width: 768px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`;

export const FieldFull = styled.div`
  @media (min-width: 768px) {
    grid-column: 1 / -1;
  }
`;

export const FieldGroup = styled.div`
  display: grid;
  gap: 18px;
`;

export const GroupTitle = styled.h3`
  margin: 26px 0 14px;
  color: ${({ theme }) => theme.colors.text.title};
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.02em;
`;

export const CheckGrid = styled.div`
  display: grid;
  gap: 12px;

  @media (min-width: 768px) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
`;

export const CheckCard = styled.div`
  border: 1px solid ${({ theme }) => theme.colors.border.soft};
  border-radius: 16px;
  background: ${({ theme }) => theme.colors.surface.soft};
  padding: 14px;
`;

export const FieldBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

export const FieldLabel = styled.label`
  color: #f00;
  background: #f00;
  font-size: 22px;
  font-weight: 500;
`;

export const Textarea = styled.textarea<{ $hasError?: boolean }>`
  width: 100%;
  min-height: 120px;
  resize: vertical;
  border: 1px solid
    ${({ theme, $hasError }) =>
      $hasError ? theme.colors.state.danger : theme.colors.border.default};
  border-radius: ${({ theme }) => theme.radius.sm};
  background: #ffffff;
  padding: 14px;
  color: ${({ theme }) => theme.colors.text.title};
  font-size: 14px;
  font-weight: 500;
  line-height: 22px;
  outline: none;
  transition:
    border-color ${({ theme }) => theme.transitions.default},
    box-shadow ${({ theme }) => theme.transitions.default};

  &::placeholder {
    color: ${({ theme }) => theme.colors.text.soft};
    font-weight: 300;
  }

  &:focus {
    border-color: ${({ theme, $hasError }) =>
      $hasError ? theme.colors.state.danger : theme.colors.brand.primary};
    box-shadow: 0 0 0 3px
      ${({ $hasError }) =>
        $hasError ? "rgba(245, 126, 119, 0.14)" : "rgba(65, 91, 165, 0.14)"};
  }
`;

export const ErrorText = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.colors.state.danger};
  font-size: 12px;
  font-weight: 500;
  line-height: 1.4;
`;

export const InfoBox = styled.div`
  display: flex;
  gap: 12px;
  border: 1px solid rgba(65, 91, 165, 0.18);
  border-radius: 18px;
  background: rgba(65, 91, 165, 0.07);
  padding: 16px;
  color: ${({ theme }) => theme.colors.text.body};
  font-size: 13px;
  font-weight: 500;
  line-height: 21px;

  svg {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
    color: ${({ theme }) => theme.colors.brand.primary};
  }
`;

export const WarningBox = styled(InfoBox)`
  border-color: rgba(245, 126, 119, 0.22);
  background: rgba(245, 126, 119, 0.08);

  svg {
    color: ${({ theme }) => theme.colors.state.danger};
  }
`;

export const SuccessBox = styled(InfoBox)`
  border-color: rgba(47, 158, 115, 0.22);
  background: rgba(47, 158, 115, 0.08);

  svg {
    color: ${({ theme }) => theme.colors.state.success};
  }
`;

export const FormFooter = styled.footer`
  display: flex;
  flex-direction: column;
  gap: 16px;
  border-top: 1px solid ${({ theme }) => theme.colors.border.soft};
  background: ${({ theme }) => theme.colors.surface.soft};
  padding: 20px 24px;

  @media (min-width: 768px) {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    padding: 22px 32px;
  }
`;

export const FooterHint = styled.p`
  max-width: 560px;
  color: ${({ theme }) => theme.colors.text.muted};
  font-size: 13px;
  font-weight: 500;
  line-height: 21px;
`;

export const FooterActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 12px;
`;

export const ReviewGrid = styled.div`
  display: grid;
  gap: 16px;

  @media (min-width: 900px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`;

export const ReviewCard = styled.article`
  border: 1px solid ${({ theme }) => theme.colors.border.soft};
  border-radius: 18px;
  background: ${({ theme }) => theme.colors.surface.soft};
  padding: 18px;
`;

export const ReviewTitle = styled.h3`
  color: ${({ theme }) => theme.colors.text.title};
  font-size: 14px;
  font-weight: 800;
  letter-spacing: -0.02em;
`;

export const ReviewList = styled.dl`
  display: grid;
  gap: 10px;
  margin-top: 14px;
`;

export const ReviewItem = styled.div`
  display: grid;
  gap: 4px;
`;

export const ReviewLabel = styled.dt`
  color: ${({ theme }) => theme.colors.text.soft};
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
`;

export const ReviewValue = styled.dd`
  color: ${({ theme }) => theme.colors.text.body};
  font-size: 13px;
  font-weight: 600;
  line-height: 20px;
  word-break: break-word;
`;

export const ToastPosition = styled.div`
  position: fixed;
  top: 24px;
  right: 24px;
  z-index: 80;
  width: min(380px, calc(100vw - 32px));

  @media (max-width: 640px) {
    top: 16px;
    right: 16px;
    left: 16px;
    width: auto;
  }
`;
