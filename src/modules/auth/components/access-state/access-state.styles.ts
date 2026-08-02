"use client";

import styled from "styled-components";

export const Page = styled.main`
  display: grid; min-height: 100svh; place-items: center;
  background: radial-gradient(circle at 50% 0, rgba(65,91,165,.13), transparent 38%), ${({ theme }) => theme.colors.surface.background};
  padding: 24px;
`;

export const Card = styled.section`
  width: min(520px, 100%); border: 1px solid ${({ theme }) => theme.colors.border.soft}; border-radius: 22px;
  background: #fff; padding: clamp(28px, 5vw, 48px); box-shadow: ${({ theme }) => theme.shadows.soft}; text-align: center;
`;

export const Icon = styled.div<{ $danger?: boolean }>`
  display: grid; width: 64px; height: 64px; place-items: center; margin: 0 auto 22px; border-radius: 20px;
  background: ${({ $danger }) => $danger ? "#fff0ef" : "#eef2ff"}; color: ${({ $danger, theme }) => $danger ? theme.colors.state.danger : theme.colors.brand.primary};
`;

export const Title = styled.h1`
  margin: 0; color: ${({ theme }) => theme.colors.text.title}; font-size: 27px; font-weight: 900; letter-spacing: -.035em;
`;

export const Text = styled.p`
  margin: 13px 0 26px; color: ${({ theme }) => theme.colors.text.muted}; font-size: 14px; font-weight: 550; line-height: 1.7;
`;

export const Actions = styled.div`
  display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 10px;
  a, button { display: inline-flex; min-height: 46px; align-items: center; justify-content: center; gap: 8px; border: 1px solid #d9deea; border-radius: 10px; background: #fff; color: ${({ theme }) => theme.colors.text.body}; padding: 0 18px; font-size: 13px; font-weight: 800; }
  a:first-child { border-color: transparent; background: ${({ theme }) => theme.colors.brand.primary}; color: #fff; }
`;
