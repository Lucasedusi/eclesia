"use client";

import styled from "styled-components";

export const Page = styled.main`
  display: grid; min-height: 100svh; place-items: center; padding: 24px;
  background: radial-gradient(circle at 50% 0, rgba(65,91,165,.16), transparent 38%), ${({ theme }) => theme.colors.surface.background};
`;
export const Card = styled.section`
  width: min(540px,100%); border: 1px solid ${({ theme }) => theme.colors.border.soft}; border-radius: 24px;
  background: #fff; padding: clamp(28px,6vw,52px); box-shadow: 0 25px 75px rgba(16,24,40,.11); text-align: center;
`;
export const Brand = styled.div`display:flex; align-items:center; justify-content:center; gap:9px; margin-bottom:32px; color:${({theme})=>theme.colors.brand.primary}; strong{color:${({theme})=>theme.colors.text.title};font-size:16px;font-weight:900;}`;
export const Icon = styled.div<{ $danger?: boolean }>`display:grid;width:66px;height:66px;place-items:center;margin:0 auto 20px;border-radius:21px;background:${({$danger})=>$danger?"#fff0ef":"#eef2ff"};color:${({$danger,theme})=>$danger?theme.colors.state.danger:theme.colors.brand.primary};`;
export const Eyebrow = styled.p`margin:0 0 8px;color:${({theme})=>theme.colors.brand.primary};font-size:12px;font-weight:850;`;
export const Title = styled.h1`margin:0;color:${({theme})=>theme.colors.text.title};font-size:30px;font-weight:900;letter-spacing:-.04em;`;
export const Text = styled.p`margin:13px auto 24px;color:${({theme})=>theme.colors.text.muted};font-size:14px;font-weight:550;line-height:1.7;strong{color:${({theme})=>theme.colors.text.body};}`;
export const Fields = styled.div`display:grid;gap:13px;margin:0 0 18px;text-align:left;`;
export const Field = styled.label`display:grid;gap:6px;>span{color:#475467;font-size:11px;font-weight:800;}`;
export const ReadOnlyControl = styled.div`position:relative;input{width:100%;height:47px;border:1px solid #e4e7ec;border-radius:10px;background:#f6f7f9;color:#667085;padding:0 42px 0 13px;font:600 13px inherit;outline:0;}svg{position:absolute;right:13px;top:50%;transform:translateY(-50%);color:#98a2b3;}`;
export const PasswordControl = styled.div<{ $invalid?: boolean }>`position:relative;input{width:100%;height:47px;border:1px solid ${({$invalid})=>$invalid?"#e36a64":"#d9deea"};border-radius:10px;background:#fff;color:#101828;padding:0 44px 0 13px;font:600 13px inherit;outline:0;&:focus{border-color:${({theme})=>theme.colors.brand.primary};box-shadow:0 0 0 3px rgba(65,91,165,.11);}}button{position:absolute;right:6px;top:50%;display:grid;width:35px;height:35px;place-items:center;transform:translateY(-50%);border:0;background:transparent;color:#667085;cursor:pointer;}`;
export const FieldError = styled.small`color:${({theme})=>theme.colors.state.danger};font-size:11px;font-weight:700;`;
export const Details = styled.div`display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:0 0 22px;text-align:left;div{border:1px solid #e7eaf1;border-radius:13px;background:#fafbfc;padding:14px;}span{display:block;color:#98a2b3;font-size:10px;font-weight:750;}strong{display:block;margin-top:5px;color:#344054;font-size:12px;font-weight:850;}@media(max-width:480px){grid-template-columns:1fr;}`;
export const Alert = styled.div<{ $success?: boolean }>`display:flex;align-items:center;justify-content:center;gap:8px;margin:0 0 16px;border:1px solid ${({$success})=>$success?"#bfe8d4":"#ffd0ce"};border-radius:10px;background:${({$success})=>$success?"#edf9f3":"#fff4f3"};color:${({$success})=>$success?"#267c5b":"#a9413c"};padding:11px;font-size:12px;font-weight:750;`;
export const PrimaryButton = styled.button`display:inline-flex;width:100%;min-height:51px;align-items:center;justify-content:center;gap:9px;border:0;border-radius:11px;background:${({theme})=>theme.colors.brand.primary};color:#fff;font-size:13px;font-weight:850;box-shadow:0 12px 26px rgba(65,91,165,.19);&:disabled{opacity:.65;}`;
export const Actions = styled.div`display:grid;gap:10px;a{display:inline-flex;min-height:49px;align-items:center;justify-content:center;gap:9px;border:1px solid #d9deea;border-radius:11px;background:#fff;color:#344054;font-size:13px;font-weight:850;}a:first-child{border-color:transparent;background:${({theme})=>theme.colors.brand.primary};color:#fff;}`;
export const Footnote = styled.p`margin:20px 0 0;color:#98a2b3;font-size:11px;font-weight:650;line-height:1.55;`;
export const Spinner = styled.span`width:16px;height:16px;border:2px solid rgba(255,255,255,.42);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite;@keyframes spin{to{transform:rotate(360deg)}}`;
