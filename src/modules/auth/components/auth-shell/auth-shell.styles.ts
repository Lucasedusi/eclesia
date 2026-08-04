"use client";

import styled, { keyframes } from "styled-components";

const rise = keyframes`
  from { opacity: 0; transform: translateY(14px); }
  to { opacity: 1; transform: translateY(0); }
`;

export const Page = styled.main`
  min-height: 100svh;
  display: grid;
  grid-template-columns: minmax(430px, 0.75fr) minmax(620px, 1.25fr);
  gap: 18px;
  padding: 20px;
  background:
    radial-gradient(circle at 8% 5%, rgba(65, 91, 165, 0.1), transparent 30%),
    #f3f5fa;

  @media (max-width: 1040px) {
    grid-template-columns: minmax(360px, 520px);
    place-content: center;
    padding: 16px;
  }
`;

export const FormPanel = styled.section`
  display: flex;
  min-height: calc(100svh - 40px);
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(207, 211, 212, 0.75);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.96);
  padding: clamp(28px, 5vw, 66px);
  box-shadow: 0 22px 65px rgba(16, 24, 40, 0.06);

  @media (max-width: 1040px) {
    min-height: calc(100svh - 32px);
  }
`;

export const FormContent = styled.div`
  width: 100%;
  max-width: 430px;
  animation: ${rise} 420ms ease both;
`;

export const Brand = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 13px;
  margin-bottom: 54px;
`;

export const BrandMark = styled.span`
  display: grid;
  width: 48px;
  height: 48px;
  place-items: center;
  border-radius: 15px;
  color: #fff;
  background: linear-gradient(
    145deg,
    #6c82da,
    ${({ theme }) => theme.colors.brand.primary}
  );
  box-shadow: 0 13px 28px rgba(65, 91, 165, 0.25);

  svg {
    width: 25px;
    height: 25px;
  }
`;

export const BrandText = styled.div`
  strong {
    display: block;
    color: ${({ theme }) => theme.colors.text.title};
    font-size: 18px;
    font-weight: 850;
  }
  span {
    display: block;
    margin-top: 2px;
    color: ${({ theme }) => theme.colors.text.soft};
    font-size: 12px;
    font-weight: 700;
  }
`;

export const Eyebrow = styled.p`
  margin: 0 0 10px;
  color: ${({ theme }) => theme.colors.brand.primary};
  font-size: 13px;
  font-weight: 850;
`;

export const Title = styled.h1`
  margin: 0;
  color: ${({ theme }) => theme.colors.text.title};
  font-size: clamp(30px, 4vw, 42px);
  font-weight: 900;
  letter-spacing: -0.045em;
  line-height: 1.06;
`;

export const Description = styled.p`
  margin: 13px 0 30px;
  color: ${({ theme }) => theme.colors.text.muted};
  font-size: 14px;
  font-weight: 550;
  line-height: 1.7;
`;

export const Form = styled.form`
  display: grid;
  gap: 18px;
`;

export const Field = styled.div`
  display: grid;
  gap: 8px;
`;

export const FieldTop = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
`;

export const Label = styled.label`
  color: ${({ theme }) => theme.colors.text.title};
  font-size: 13px;
  font-weight: 800;
`;

export const FieldLink = styled.a`
  color: ${({ theme }) => theme.colors.brand.primary};
  font-size: 12px;
  font-weight: 800;

  &:hover {
    text-decoration: underline;
  }
`;

export const InputWrap = styled.div`
  position: relative;
`;

export const Input = styled.input<{ $invalid?: boolean }>`
  width: 100%;
  min-height: 54px;
  border: 1px solid ${({ $invalid }) => ($invalid ? "#f57e77" : "#d9deea")};
  border-radius: 12px;
  outline: none;
  background: #f6f8fc;
  color: ${({ theme }) => theme.colors.text.title};
  padding: 0 48px 0 16px;
  font-size: 14px;
  font-weight: 650;
  transition: 160ms ease;

  &::placeholder {
    color: #a5adbd;
    font-weight: 550;
  }
  &:hover {
    border-color: #b7c0d5;
  }
  &:focus {
    border-color: ${({ theme }) => theme.colors.brand.primary};
    background: #fff;
    box-shadow: ${({ theme }) => theme.shadows.focus};
  }
`;

export const PasswordButton = styled.button`
  position: absolute;
  top: 50%;
  right: 14px;
  display: grid;
  width: 32px;
  height: 32px;
  transform: translateY(-50%);
  place-items: center;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #8c97aa;
  &:hover {
    color: ${({ theme }) => theme.colors.brand.primary};
    background: rgba(65, 91, 165, 0.08);
  }
`;

export const FieldError = styled.p`
  margin: 0;
  color: #d74f49;
  font-size: 12px;
  font-weight: 700;
`;

export const Submit = styled.button`
  display: inline-flex;
  min-height: 54px;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-top: 4px;
  border: 0;
  border-radius: 12px;
  color: #fff;
  background: ${({ theme }) => theme.colors.brand.primary};
  box-shadow: 0 14px 28px rgba(65, 91, 165, 0.22);
  font-size: 14px;
  font-weight: 850;
  transition: 180ms ease;

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    background: ${({ theme }) => theme.colors.brand.primaryHover};
  }
  &:disabled {
    cursor: wait;
    opacity: 0.7;
  }
`;

export const Spinner = styled.span`
  width: 17px;
  height: 17px;
  border: 2px solid rgba(255, 255, 255, 0.45);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 700ms linear infinite;

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`;

export const Alert = styled.div<{ $success?: boolean }>`
  border: 1px solid ${({ $success }) => ($success ? "#bfe8d4" : "#ffd0ce")};
  border-radius: 11px;
  background: ${({ $success }) => ($success ? "#edf9f3" : "#fff4f3")};
  color: ${({ $success }) => ($success ? "#267c5b" : "#b5423c")};
  padding: 12px 14px;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.55;
`;

export const CheckRow = styled.label`
  display: flex;
  align-items: flex-start;
  gap: 10px;
  color: ${({ theme }) => theme.colors.text.muted};
  font-size: 12px;
  font-weight: 650;
  line-height: 1.55;

  input {
    width: 16px;
    height: 16px;
    margin-top: 1px;
    accent-color: ${({ theme }) => theme.colors.brand.primary};
  }
  a {
    color: ${({ theme }) => theme.colors.brand.primary};
    font-weight: 800;
  }
`;

export const SwitchText = styled.p`
  margin: 22px 0 0;
  color: ${({ theme }) => theme.colors.text.muted};
  text-align: center;
  font-size: 13px;
  font-weight: 600;

  a {
    color: ${({ theme }) => theme.colors.brand.primary};
    font-weight: 850;
  }
`;

export const SecurityNote = styled.p`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin: 28px 0 0;
  color: #98a2b3;
  font-size: 11px;
  font-weight: 700;
  svg {
    color: #2f9e73;
  }
`;

export const VisualPanel = styled.aside`
  position: relative;
  display: flex;
  min-height: calc(100svh - 40px);
  overflow: hidden;
  flex-direction: column;
  justify-content: center;
  border-radius: 24px;
  background:
    radial-gradient(
      circle at 86% 18%,
      rgba(255, 255, 255, 0.16),
      transparent 28%
    ),
    radial-gradient(circle at 12% 85%, rgba(4, 16, 38, 0.22), transparent 38%),
    linear-gradient(145deg, #354b8e 0%, #415ba5 44%, #6c82da 100%);
  padding: clamp(44px, 6vw, 90px);
  color: #fff;

  &::before,
  &::after {
    content: "";
    position: absolute;
    width: 360px;
    height: 360px;
    border: 1px solid rgba(255, 255, 255, 0.13);
    border-radius: 50%;
  }
  &::before {
    top: -180px;
    left: -90px;
  }
  &::after {
    right: -170px;
    bottom: -170px;
  }

  @media (max-width: 1040px) {
    display: none;
  }
`;

export const VisualContent = styled.div`
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 770px;
  margin: auto;
  animation: ${rise} 520ms 80ms ease both;
`;

export const VisualBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.13);
  padding: 9px 13px;
  font-size: 12px;
  font-weight: 800;
`;

export const VisualTitle = styled.h2`
  max-width: 730px;
  margin: 24px 0 34px;
  font-size: clamp(38px, 5vw, 64px);
  font-weight: 900;
  letter-spacing: -0.055em;
  line-height: 0.98;
`;

export const Preview = styled.div`
  border: 1px solid rgba(255, 255, 255, 0.32);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.95);
  color: #101828;
  padding: clamp(22px, 3vw, 34px);
  box-shadow: 0 28px 70px rgba(7, 20, 38, 0.22);
`;

export const PreviewTop = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  span {
    color: #98a2b3;
    font-size: 11px;
    font-weight: 800;
  }
  strong {
    display: block;
    margin-top: 4px;
    font-size: 16px;
  }
`;

export const Today = styled.span`
  border-radius: 999px;
  background: #eef2ff;
  color: #415ba5 !important;
  padding: 7px 10px;
`;

export const PreviewStats = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 15px;
  margin: 26px 0;
`;

export const PreviewStat = styled.div`
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 10px;
  align-items: center;
  color: #415ba5;
  strong {
    font-size: 15px;
    color: #101828;
  }
  small {
    display: block;
    margin-top: 2px;
    color: #98a2b3;
    font-size: 10px;
    font-weight: 650;
  }
`;

export const Bars = styled.div`
  display: flex;
  height: 128px;
  align-items: flex-end;
  gap: 12px;
  border-radius: 14px;
  background: #f6f8fc;
  padding: 18px;
`;

export const Bar = styled.span<{ $height: number }>`
  flex: 1;
  height: ${({ $height }) => $height}%;
  min-width: 12px;
  border-radius: 7px 7px 3px 3px;
  background: linear-gradient(180deg, #8ea0f2, #415ba5);
`;
