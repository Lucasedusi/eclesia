"use client";

import styled, { css } from "styled-components";

export const Landing = styled.section`
  display:grid;gap:18px;border:1px solid #e6e9ef;border-radius:15px;background:#fff;padding:20px;box-shadow:0 10px 24px -24px rgba(16,24,40,.4);
`;

export const LandingHeader = styled.header`
  display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:16px;
  >div{display:flex;align-items:flex-start;gap:12px;min-width:0;}
  >div>span{display:grid;width:42px;height:42px;flex:0 0 auto;place-items:center;border-radius:12px;background:#eef2ff;color:#415ba5;}
  svg{width:20px;height:20px;}h2{margin:0;color:#344054;font-size:16px;}p{max-width:680px;margin:5px 0 0;color:#667085;font-size:11px;line-height:1.55;}
`;

export const TypeGrid = styled.div`
  display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;
  @media(max-width:1040px){grid-template-columns:repeat(2,minmax(0,1fr));}
  @media(max-width:720px){grid-template-columns:1fr;}
`;

export const TypeCard = styled.article<{ $disabled?: boolean }>`
  position:relative;display:grid;grid-template-columns:44px minmax(0,1fr) auto;gap:13px;align-items:center;min-height:104px;border:1px solid ${({$disabled})=>$disabled?"#e8ebf1":"#dfe5f2"};border-radius:12px;background:${({$disabled})=>$disabled?"#fafbfc":"#f8faff"};padding:16px;opacity:${({$disabled})=>$disabled ? .68 : 1};
  >span:first-child{display:grid;width:44px;height:44px;place-items:center;border-radius:11px;background:${({$disabled})=>$disabled?"#eef0f3":"#415ba5"};color:${({$disabled})=>$disabled?"#98a2b3":"#fff"};}
  h3{margin:0;color:#344054;font-size:13px;}p{margin:5px 0 0;color:#7c8798;font-size:10px;line-height:1.55;}
`;

export const Badge = styled.span`
  display:inline-flex;align-items:center;border-radius:999px;background:#eef2ff;padding:5px 9px;color:#415ba5;font-size:9px;font-weight:850;white-space:nowrap;
`;

export const Wizard = styled.div`
  display:grid;grid-template-rows:auto minmax(0,1fr);min-height:500px;border:1px solid #e7eaf0;border-radius:12px;overflow:hidden;background:#fff;
`;

export const Stepper = styled.nav`
  display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px;overflow-x:auto;border-bottom:1px solid #e7eaf0;background:#f8f9fc;padding:12px 14px;
  button{position:relative;display:grid;width:100%;min-width:126px;grid-template-rows:28px auto;justify-items:center;gap:6px;align-items:center;overflow:visible;border:1px solid transparent;border-radius:9px;background:transparent;padding:8px;color:#667085;text-align:center;font-size:9px;font-weight:750;}
  button>span{position:relative;z-index:1;display:grid;width:28px;height:28px;place-items:center;border-radius:8px;background:#e9edf3;color:#667085;font-size:9px;font-weight:900;}
  button[aria-current="step"]{border-color:#cad5ef;background:#fff;color:#344e97;box-shadow:0 7px 18px -17px rgba(16,24,40,.7);}
  button[aria-current="step"]>span,button[data-completed="true"]>span{background:#415ba5;color:#fff;}
  button:disabled{cursor:not-allowed;}button:not(:disabled):hover{background:#fff;}
`;

export const StepContent = styled.div`
  display:grid;align-content:start;gap:18px;min-width:0;padding:22px;
  @media(max-width:600px){padding:17px;}
`;

export const StepHeader = styled.header`
  border-bottom:1px solid #edf0f4;padding-bottom:14px;
  small{color:#415ba5;font-size:9px;font-weight:850;letter-spacing:.06em;text-transform:uppercase;}h3{margin:6px 0 0;color:#101828;font-size:18px;letter-spacing:-.025em;}p{margin:5px 0 0;color:#667085;font-size:11px;line-height:1.55;}
`;

export const ReportTypeChoice = styled.label<{ $selected: boolean; $disabled?: boolean }>`
  position:relative;display:grid;grid-template-columns:42px minmax(0,1fr) 20px;gap:12px;align-items:center;min-height:92px;border:1px solid ${({$selected,$disabled})=>$disabled?"#e5e8ed":$selected?"#6680c4":"#dfe4ec"};border-radius:11px;background:${({$selected,$disabled})=>$disabled?"#fafbfc":$selected?"#eef3ff":"#fff"};padding:14px;cursor:${({$disabled})=>$disabled?"not-allowed":"pointer"};opacity:${({$disabled})=>$disabled ? .65 : 1};
  input{position:absolute;opacity:0;pointer-events:none;} >span{display:grid;width:42px;height:42px;place-items:center;border-radius:10px;background:${({$selected})=>$selected?"#415ba5":"#f0f2f5"};color:${({$selected})=>$selected?"#fff":"#667085"};}svg{width:19px;height:19px;}strong{display:block;color:#344054;font-size:12px;}small{display:block;margin-top:4px;color:#7c8798;font-size:9px;line-height:1.5;} >svg{color:#415ba5;}
`;

export const FilterGrid = styled.div`
  display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px;
  @media(max-width:610px){grid-template-columns:1fr;}
`;

export const Field = styled.label`
  display:grid;gap:6px;>span{color:#475467;font-size:9px;font-weight:850;}
  select,input{width:100%;min-height:42px;border:1px solid #d9deea;border-radius:6px;background:#f8f9fc;padding:0 11px;outline:0;color:#344054;font-size:11px;font-weight:650;}
  select:focus,input:focus{border-color:#415ba5;background:#fff;}select{cursor:pointer;}
`;

export const FilterToolbar = styled.div`
  display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;border-radius:8px;background:#f8fafc;padding:10px 12px;
  >span{color:#667085;font-size:10px;font-weight:700;}button{display:inline-flex;align-items:center;gap:6px;border:0;background:transparent;color:#415ba5;font-size:10px;font-weight:800;}button:disabled{color:#98a2b3;}svg{width:14px;height:14px;}
`;

export const Chips = styled.div`
  display:flex;flex-wrap:wrap;gap:6px;
  span{display:inline-flex;align-items:center;border-radius:999px;background:#eef2ff;padding:6px 9px;color:#415ba5;font-size:9px;font-weight:750;}
  p{margin:0;color:#98a2b3;font-size:10px;}
`;

export const OptionSection = styled.section<{ $error?: boolean }>`
  display:grid;gap:10px;border:1px solid ${({$error})=>$error?"#ef8d87":"#e7eaf0"};border-radius:10px;background:${({$error})=>$error?"#fffafa":"#fff"};padding:13px;
  >header{display:flex;align-items:center;justify-content:space-between;gap:10px;}h4{margin:0;color:#344054;font-size:11px;}header small{color:#98a2b3;font-size:9px;}
`;

export const OptionGrid = styled.div`
  display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;
  @media(max-width:590px){grid-template-columns:1fr;}
`;

export const ToggleOption = styled.label<{ $checked: boolean; $locked?: boolean }>`
  position:relative;display:grid;grid-template-columns:28px minmax(0,1fr) 16px;gap:9px;align-items:center;min-height:54px;border:1px solid ${({$checked})=>$checked?"#cbd6ef":"#e5e8ed"};border-radius:8px;background:${({$checked})=>$checked?"#f5f7ff":"#fafbfc"};padding:9px;color:#475467;cursor:${({$locked})=>$locked?"default":"pointer"};
  input{position:absolute;opacity:0;pointer-events:none;} >span{display:grid;width:28px;height:28px;place-items:center;border-radius:7px;background:${({$checked})=>$checked?"#415ba5":"#e9edf2"};color:${({$checked})=>$checked?"#fff":"#98a2b3"};}svg{width:14px;height:14px;}strong{display:block;font-size:10px;}small{display:block;margin-top:2px;color:#98a2b3;font-size:8px;line-height:1.4;} >svg{color:${({$checked})=>$checked?"#415ba5":"#c4cad4"};}
`;

export const RadioGrid = styled.div`
  display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;
  @media(max-width:590px){grid-template-columns:1fr;}
`;

export const RadioCard = styled.label<{ $checked: boolean }>`
  position:relative;display:grid;grid-template-columns:38px minmax(0,1fr) 18px;gap:11px;align-items:center;min-height:82px;border:1px solid ${({$checked})=>$checked?"#6680c4":"#dfe4ec"};border-radius:10px;background:${({$checked})=>$checked?"#eef3ff":"#fff"};padding:13px;cursor:pointer;
  input{position:absolute;opacity:0;} >span{display:grid;width:38px;height:38px;place-items:center;border-radius:9px;background:${({$checked})=>$checked?"#415ba5":"#f0f2f5"};color:${({$checked})=>$checked?"#fff":"#667085"};}svg{width:17px;height:17px;}strong{display:block;color:#344054;font-size:11px;}small{display:block;margin-top:4px;color:#7c8798;font-size:9px;line-height:1.45;} >svg{color:#415ba5;}
`;

export const ReviewStats = styled.div`
  display:grid;grid-template-columns:repeat(auto-fit,minmax(125px,1fr));gap:8px;
  div{border:1px solid #e2e7f0;border-radius:9px;background:#f8faff;padding:11px;}small{display:block;color:#7c8798;font-size:8px;}strong{display:block;margin-top:5px;color:#344e97;font-size:16px;}
  @media(max-width:570px){grid-template-columns:1fr;}
`;

export const ReviewList = styled.dl`
  display:grid;grid-template-columns:repeat(2,minmax(0,1fr));margin:0;border:1px solid #e7eaf0;border-radius:10px;overflow:hidden;
  div{display:grid;gap:4px;border-bottom:1px solid #edf0f4;padding:11px;}div:nth-child(odd){border-right:1px solid #edf0f4;}dt{color:#98a2b3;font-size:8px;font-weight:800;}dd{margin:0;color:#475467;font-size:10px;font-weight:750;line-height:1.45;}
  @media(max-width:590px){grid-template-columns:1fr;div:nth-child(odd){border-right:0;}}
`;

export const StateBox = styled.div<{ $danger?: boolean; $loading?: boolean }>`
  display:grid;min-height:130px;place-items:center;align-content:center;gap:9px;border:1px dashed ${({$danger})=>$danger?"#ef8d87":"#cdd5e1"};border-radius:10px;background:${({$danger})=>$danger?"#fff7f6":"#fafbfc"};padding:20px;color:${({$danger})=>$danger?"#b42318":"#667085"};text-align:center;
  svg{width:25px;height:25px;${({$loading})=>$loading&&css`animation:report-spin .8s linear infinite;`}}strong{font-size:11px;}p{max-width:430px;margin:0;font-size:9px;line-height:1.55;}@keyframes report-spin{to{transform:rotate(360deg);}}
`;

export const ErrorText = styled.p`
  margin:0;color:#b42318;font-size:9px;font-weight:750;
`;

export const Footer = styled.div`
  display:flex;width:100%;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;
  >div{display:flex;flex-wrap:wrap;gap:8px;}
  @media(max-width:570px){align-items:stretch;flex-direction:column;>div{display:grid;grid-template-columns:1fr 1fr;}button{width:100%;}}
`;
