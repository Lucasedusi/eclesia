"use client";

import styled, { keyframes } from "styled-components";

const enter = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
`;

export const Page = styled.main`
  min-height: 100svh;
  background:
    radial-gradient(circle at 0 0, rgba(65, 91, 165, 0.14), transparent 32%),
    ${({ theme }) => theme.colors.surface.background};
  padding: clamp(18px, 3vw, 40px);
`;

export const Shell = styled.div`
  display: grid;
  width: min(1240px, 100%);
  min-height: calc(100svh - clamp(36px, 6vw, 80px));
  grid-template-columns: minmax(260px, 0.34fr) minmax(0, 0.66fr);
  overflow: hidden;
  margin: 0 auto;
  border: 1px solid ${({ theme }) => theme.colors.border.soft};
  border-radius: 26px;
  background: #fff;
  box-shadow: 0 28px 80px rgba(16, 24, 40, 0.11);

  @media (max-width: 900px) { grid-template-columns: 1fr; }
`;

export const Aside = styled.aside`
  position: relative;
  overflow: hidden;
  background:
    radial-gradient(circle at 15% 8%, rgba(255,255,255,.17), transparent 26%),
    linear-gradient(155deg, #071426 0%, #243b87 56%, #415ba5 100%);
  padding: clamp(28px, 4vw, 52px);
  color: #fff;

  &::after {
    content: "";
    position: absolute;
    width: 360px; height: 360px; right: -220px; bottom: -180px;
    border: 1px solid rgba(255,255,255,.14); border-radius: 50%;
  }
`;

export const Brand = styled.div`
  position: relative; z-index: 1; display: flex; align-items: center; gap: 12px;
  strong { font-size: 18px; font-weight: 850; }
`;

export const BrandMark = styled.span`
  display: grid; width: 46px; height: 46px; place-items: center;
  border-radius: 14px; background: rgba(255,255,255,.13); color: #fff;
`;

export const AsideTitle = styled.h1`
  position: relative; z-index: 1; margin: 64px 0 14px;
  font-size: clamp(28px, 3vw, 42px); font-weight: 900; letter-spacing: -.045em; line-height: 1.05;
`;

export const AsideText = styled.p`
  position: relative; z-index: 1; margin: 0; color: rgba(255,255,255,.72);
  font-size: 14px; font-weight: 550; line-height: 1.75;
`;

export const Steps = styled.ol`
  position: relative; z-index: 1; display: grid; gap: 11px; margin: 42px 0 0; padding: 0; list-style: none;
`;

export const Step = styled.li<{ $active: boolean; $complete: boolean }>`
  display: grid; grid-template-columns: 34px 1fr; align-items: center; gap: 12px;
  border: 1px solid ${({ $active }) => $active ? "rgba(255,255,255,.25)" : "transparent"};
  border-radius: 13px; background: ${({ $active }) => $active ? "rgba(255,255,255,.10)" : "transparent"};
  padding: 10px;
  opacity: ${({ $active, $complete }) => $active || $complete ? 1 : .54};
  span {
    display: grid; width: 32px; height: 32px; place-items: center; border-radius: 10px;
    background: ${({ $active, $complete }) => $active || $complete ? "#fff" : "rgba(255,255,255,.12)"};
    color: ${({ $active, $complete }) => $active || $complete ? "#415ba5" : "#fff"};
    font-size: 12px; font-weight: 900;
  }
  strong { display: block; font-size: 12px; font-weight: 800; }
  small { display: block; margin-top: 3px; color: rgba(255,255,255,.62); font-size: 10px; font-weight: 650; }
`;

export const Content = styled.section`
  display: flex; min-width: 0; flex-direction: column; padding: clamp(28px, 5vw, 64px);
`;

export const Top = styled.div`
  display: flex; align-items: center; justify-content: space-between; gap: 18px;
  margin-bottom: 34px;
`;

export const Progress = styled.div`
  width: min(240px, 45%); height: 7px; overflow: hidden; border-radius: 999px; background: #edf0f7;
  span { display: block; height: 100%; border-radius: inherit; background: ${({ theme }) => theme.colors.brand.primary}; transition: width 260ms ease; }
`;

export const Counter = styled.span`
  color: ${({ theme }) => theme.colors.text.muted}; font-size: 12px; font-weight: 800;
`;

export const Stage = styled.div`
  flex: 1; animation: ${enter} 300ms ease both;
`;

export const Eyebrow = styled.p`
  margin: 0 0 8px; color: ${({ theme }) => theme.colors.brand.primary}; font-size: 12px; font-weight: 850;
`;

export const Title = styled.h2`
  margin: 0; color: ${({ theme }) => theme.colors.text.title}; font-size: clamp(25px, 3vw, 35px); font-weight: 900; letter-spacing: -.04em;
`;

export const Description = styled.p`
  max-width: 700px; margin: 11px 0 30px; color: ${({ theme }) => theme.colors.text.muted}; font-size: 14px; font-weight: 550; line-height: 1.7;
`;

export const Grid = styled.div<{ $columns?: number }>`
  display: grid; grid-template-columns: repeat(${({ $columns = 2 }) => $columns}, minmax(0, 1fr)); gap: 18px;
  @media (max-width: 680px) { grid-template-columns: 1fr; }
`;

export const Field = styled.label`
  display: grid; gap: 8px;
  > span { color: ${({ theme }) => theme.colors.text.body}; font-size: 12px; font-weight: 800; }
  > small { color: ${({ theme }) => theme.colors.text.soft}; font-size: 11px; font-weight: 600; }
`;

export const Input = styled.input<{ $invalid?: boolean }>`
  width: 100%; min-height: 51px; border: 1px solid ${({ $invalid }) => $invalid ? "#f57e77" : "#d9deea"};
  border-radius: 11px; outline: 0; background: #f8f9fc; padding: 0 15px;
  color: ${({ theme }) => theme.colors.text.title}; font-size: 13px; font-weight: 650; transition: 160ms ease;
  &:focus { border-color: ${({ theme }) => theme.colors.brand.primary}; background: #fff; box-shadow: ${({ theme }) => theme.shadows.focus}; }
`;

export const FieldError = styled.small`
  color: #cf4e48 !important; font-weight: 700 !important;
`;

export const Alert = styled.div`
  margin-bottom: 20px; border: 1px solid #ffd0ce; border-radius: 11px; background: #fff4f3;
  color: #a9413c; padding: 12px 14px; font-size: 12px; font-weight: 700; line-height: 1.55;
`;

export const Review = styled.div`
  display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 14px;
  @media (max-width: 680px) { grid-template-columns: 1fr; }
`;

export const ReviewCard = styled.article`
  border: 1px solid ${({ theme }) => theme.colors.border.soft}; border-radius: 15px; background: #fafbfc; padding: 18px;
  strong { display: block; color: ${({ theme }) => theme.colors.text.title}; font-size: 13px; font-weight: 850; }
  p { margin: 7px 0 0; color: ${({ theme }) => theme.colors.text.muted}; font-size: 12px; font-weight: 600; line-height: 1.6; }
`;

export const Footer = styled.div`
  display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 36px; padding-top: 22px; border-top: 1px solid #edf0f4;
`;

export const Button = styled.button<{ $secondary?: boolean }>`
  display: inline-flex; min-height: 48px; align-items: center; justify-content: center; gap: 9px;
  border: 1px solid ${({ $secondary }) => $secondary ? "#d9deea" : "transparent"}; border-radius: 10px;
  background: ${({ $secondary, theme }) => $secondary ? "#fff" : theme.colors.brand.primary};
  color: ${({ $secondary, theme }) => $secondary ? theme.colors.text.body : "#fff"}; padding: 0 21px;
  font-size: 13px; font-weight: 850; transition: 170ms ease;
  &:hover:not(:disabled) { transform: translateY(-1px); }
  &:disabled { opacity: .55; cursor: wait; }
`;

export const Spinner = styled.span`
  width: 16px; height: 16px; border: 2px solid rgba(255,255,255,.42); border-top-color: #fff; border-radius: 50%;
  animation: spin .7s linear infinite; @keyframes spin { to { transform: rotate(360deg); } }
`;
