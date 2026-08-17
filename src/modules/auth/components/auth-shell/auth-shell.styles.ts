"use client";

import styled, { keyframes } from "styled-components";

const rise = keyframes`
  from { opacity: 0; transform: translateY(14px); }
  to { opacity: 1; transform: translateY(0); }
`;

const skeletonShimmer = keyframes`
  from { transform: translateX(-100%); }
  to { transform: translateX(100%); }
`;

export const Page = styled.main`
  display: grid;
  width: 100%;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  grid-template-columns: minmax(410px, 42%) minmax(0, 58%);
  background: #f3f5fa;
  overscroll-behavior: none;

  @media (max-width: 1040px) {
    display: block;
    background:
      radial-gradient(circle at 12% 4%, rgba(65, 91, 165, 0.1), transparent 34%),
      #f3f5fa;
  }
`;

export const FormPanel = styled.section`
  display: flex;
  min-width: 0;
  height: 100%;
  overflow-x: hidden;
  overflow-y: auto;
  background: #fbfcfe;
  padding: clamp(28px, 4.4vw, 68px);
  overscroll-behavior-y: contain;

  @media (max-width: 1040px) {
    padding:
      max(28px, env(safe-area-inset-top))
      max(24px, env(safe-area-inset-right))
      max(28px, env(safe-area-inset-bottom))
      max(24px, env(safe-area-inset-left));
  }

`;

export const FormContent = styled.div`
  width: 100%;
  max-width: 410px;
  margin: auto;
  animation: ${rise} 420ms ease both;
`;

export const LoginStack = styled.div`
  display: grid;
  width: 100%;
  gap: 22px;

  @media (max-width: 420px) {
    gap: 18px;
  }
`;

export const LoginBrandSlot = styled.div`
  padding: 0 clamp(28px, 3.2vw, 42px);
`;

export const LoginCard = styled.div`
  width: 100%;
  border-radius: 14px;
  background: #fff;
  padding: clamp(28px, 3.2vw, 42px);
  box-shadow: 0 8px 32px -8px rgb(27 42 74 / 0.18);
`;

export const LoginSkeletonLine = styled.span<{
  $width: string;
  $height: string;
  $marginTop?: string;
}>`
  position: relative;
  display: block;
  width: ${({ $width }) => $width};
  height: ${({ $height }) => $height};
  overflow: hidden;
  margin-top: ${({ $marginTop }) => $marginTop ?? "0"};
  border-radius: 10px;
  background: #e9edf4;

  &::after {
    position: absolute;
    inset: 0;
    content: "";
    background: linear-gradient(100deg, transparent 20%, rgba(255, 255, 255, 0.8) 50%, transparent 80%);
    animation: ${skeletonShimmer} 1.35s ease-in-out infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    &::after { animation: none; }
  }
`;

export const LoginSkeletonForm = styled.div`
  display: grid;
  gap: 16px;
  margin-top: 28px;
`;

export const LoginSkeletonFieldTop = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

export const Brand = styled.div<{ $alwaysVisible?: boolean }>`
  display: ${({ $alwaysVisible }) => $alwaysVisible ? "inline-flex" : "none"};
  align-items: center;
  gap: 13px;

  @media (max-width: 1040px) {
    display: inline-flex;
    margin-bottom: ${({ $alwaysVisible }) => $alwaysVisible ? "0" : "clamp(28px, 5vh, 44px)"};
  }

  @media (max-width: 520px), (max-height: 720px) {
    margin-bottom: ${({ $alwaysVisible }) => $alwaysVisible ? "0" : "26px"};
  }
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
  font-size: clamp(30px, 3.4vw, 38px);
  font-weight: 900;
  letter-spacing: -0.045em;
  line-height: 1.08;
`;

export const Description = styled.p`
  margin: 12px 0 26px;
  color: ${({ theme }) => theme.colors.text.muted};
  font-size: 14px;
  font-weight: 550;
  line-height: 1.6;
`;

export const Form = styled.form`
  display: grid;
  gap: 16px;
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
  margin: 20px 0 0;
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
  display: block;
  min-width: 0;
  height: 100%;
  overflow: hidden;
  background:
    radial-gradient(
      circle at 86% 18%,
      rgba(255, 255, 255, 0.16),
      transparent 28%
    ),
    radial-gradient(circle at 12% 85%, rgba(4, 16, 38, 0.22), transparent 38%),
    linear-gradient(145deg, #354b8e 0%, #415ba5 44%, #6c82da 100%);
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

export const VisualFrame = styled.div`
  position: relative;
  z-index: 1;
  display: flex;
  width: 100%;
  max-width: 900px;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  margin: 0 auto;
  padding: clamp(30px, 4vw, 58px) clamp(34px, 5vw, 76px);

  @media (max-height: 760px) and (min-width: 1041px) {
    padding-top: 26px;
    padding-bottom: 26px;
  }
`;

export const VisualBrand = styled.div`
  display: inline-flex;
  width: fit-content;
  align-items: center;
  gap: 13px;
`;

export const VisualBrandMark = styled.span`
  display: grid;
  width: 46px;
  height: 46px;
  place-items: center;
  border: 1px solid rgba(255, 255, 255, 0.26);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.15);
  box-shadow: 0 12px 28px rgba(7, 20, 38, 0.16);

  svg {
    width: 24px;
    height: 24px;
  }
`;

export const VisualBrandText = styled.div`
  strong {
    display: block;
    color: #fff;
    font-size: 18px;
    font-weight: 850;
  }

  span {
    display: block;
    margin-top: 2px;
    color: rgba(255, 255, 255, 0.72);
    font-size: 11px;
    font-weight: 700;
  }
`;

export const VisualContent = styled.div`
  position: relative;
  display: flex;
  width: 100%;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  justify-content: center;
  padding: 22px 0 0;
  animation: ${rise} 520ms 80ms ease both;

  @media (max-height: 760px) and (min-width: 1041px) {
    padding-top: 16px;
  }
`;

export const VisualBadge = styled.span`
  display: inline-flex;
  width: fit-content;
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
  margin: 22px 0 30px;
  font-size: clamp(36px, 4.2vw, 58px);
  font-weight: 900;
  letter-spacing: -0.055em;
  line-height: 1;

  @media (max-height: 760px) and (min-width: 1041px) {
    max-width: 620px;
    margin: 16px 0 20px;
    font-size: clamp(32px, 4vw, 48px);
  }
`;

export const Preview = styled.div`
  border: 1px solid rgba(255, 255, 255, 0.32);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.95);
  color: #101828;
  padding: clamp(20px, 2.5vw, 30px);
  box-shadow: 0 28px 70px rgba(7, 20, 38, 0.22);

  @media (max-height: 760px) and (min-width: 1041px) {
    padding: 18px 22px;
  }
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

  @media (max-height: 760px) and (min-width: 1041px) {
    margin: 18px 0;
  }
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
  height: clamp(92px, 14vh, 122px);
  align-items: flex-end;
  gap: 12px;
  border-radius: 14px;
  background: #f6f8fc;
  padding: 18px;

  @media (max-height: 760px) and (min-width: 1041px) {
    height: 86px;
  }
`;

export const Bar = styled.span<{ $height: number }>`
  flex: 1;
  height: ${({ $height }) => $height}%;
  min-width: 12px;
  border-radius: 7px 7px 3px 3px;
  background: linear-gradient(180deg, #8ea0f2, #415ba5);
`;
