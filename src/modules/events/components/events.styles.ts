"use client";

import styled, { css } from "styled-components";

export const Module = styled.section`display:grid;gap:18px;min-width:0;`;
export const HeaderActions = styled.div`display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px;`;
export const Stats = styled.div`display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;@media(max-width:900px){grid-template-columns:repeat(2,minmax(0,1fr));}@media(max-width:480px){grid-template-columns:1fr;}`;
export const Filters = styled.form`display:grid;grid-template-columns:minmax(220px,1fr) repeat(2,minmax(150px,.35fr)) auto;gap:10px;align-items:end;padding:14px;border:1px solid #eaecf0;border-radius:14px;background:#fff;@media(max-width:840px){grid-template-columns:1fr 1fr;}@media(max-width:520px){grid-template-columns:1fr;}`;
export const Field = styled.label`
  display:grid;gap:7px;
  >span{display:block;color:#475467;font-size:10px;font-weight:850;}
  input,select,textarea{
    width:100%;min-height:44px;border:1px solid #d9deea;border-radius:10px;background:#f8f9fc;padding:0 13px;outline:0;color:#344054;font-size:12px;font-weight:650;transition:150ms ease;
    &::placeholder{color:#98a2b3;font-weight:500;}
    &:focus{border-color:#415ba5;background:#fff;box-shadow:0 0 0 3px rgba(65,91,165,.12);}
    &:disabled{color:#98a2b3;-webkit-text-fill-color:#98a2b3;cursor:not-allowed;opacity:1;}
  }
  input:read-only,textarea:read-only{color:#667085;-webkit-text-fill-color:#667085;cursor:default;}
  select{color:#344054;-webkit-text-fill-color:#344054;font-size:11px;font-weight:750;cursor:pointer;opacity:1;option{color:#344054;background:#fff;}}
  textarea{min-height:92px;padding:12px 13px;resize:vertical;line-height:1.55;}
`;
export const Grid = styled.div`display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;@media(max-width:700px){grid-template-columns:1fr;}`;
export const Wide = styled.div`grid-column:1/-1;`;
export const Check = styled.label`display:flex;align-items:flex-start;gap:9px;padding:10px;border:1px solid #eaecf0;border-radius:9px;color:#475467;font-size:12px;line-height:1.5;input{margin-top:2px;}`;
export const Section = styled.section`display:grid;gap:14px;border:1px solid #e6e9ef;border-radius:15px;background:#fff;padding:18px;box-shadow:0 10px 24px -24px rgba(16,24,40,.4);h2{margin:0;color:#344054;font-size:16px;}p{margin:0;color:#667085;font-size:12px;line-height:1.55;}`;
export const FormActions = styled.div`position:sticky;bottom:12px;z-index:5;display:flex;justify-content:flex-end;gap:8px;border:1px solid #e2e6ef;border-radius:12px;background:rgba(255,255,255,.96);padding:12px;box-shadow:0 12px 30px rgba(16,24,40,.12);backdrop-filter:blur(8px);`;
export const TableWrap = styled.div`overflow:auto;border:1px solid #eaecf0;border-radius:14px;background:#fff;table{width:100%;border-collapse:collapse;min-width:760px;}th,td{padding:12px 14px;border-bottom:1px solid #f0f2f5;text-align:left;font-size:12px;}th{background:#fafbfc;color:#667085;font-size:10px;text-transform:uppercase;letter-spacing:.04em;}td{color:#475467;}tbody tr:last-child td{border-bottom:0;}strong{color:#344054;}`;
export const Empty = styled.div`display:grid;min-height:220px;place-items:center;border:1px dashed #cfd5df;border-radius:14px;background:#fbfcfe;padding:28px;text-align:center;color:#667085;div{max-width:380px;}svg{width:34px;height:34px;margin:0 auto 12px;color:#98a2b3;}h3{margin:0 0 6px;color:#344054;font-size:15px;}p{margin:0;font-size:12px;line-height:1.55;}`;
export const ActionButton = styled.button`display:inline-grid;width:34px;height:34px;place-items:center;border:1px solid #e0e4eb;border-radius:8px;background:#fff;color:#667085;&:hover{border-color:#b7c0d8;color:#415ba5;}&:focus-visible{outline:3px solid rgba(65,91,165,.16);}svg{width:16px;height:16px;}`;
export const Menu = styled.div`position:fixed;z-index:1000;display:grid;min-width:210px;max-height:calc(100vh - 16px);overflow-y:auto;border:1px solid #e0e4eb;border-radius:10px;background:#fff;padding:5px;box-shadow:0 18px 45px rgba(16,24,40,.18);a,button{display:flex;align-items:center;gap:9px;width:100%;border:0;border-radius:7px;background:transparent;padding:9px;color:#475467;text-align:left;font-size:12px;&:hover,&:focus-visible{background:#f2f4f7;color:#344054;outline:none;}&[data-danger]{color:#b42318;}&[data-danger]:hover{background:#fff1f0;color:#a51d14;}&:disabled{opacity:.55;cursor:wait;}svg{width:15px;height:15px;}}`;
export const EventName = styled.div`display:flex;align-items:center;gap:10px;min-width:220px;span{display:grid;width:38px;height:38px;place-items:center;border-radius:10px;background:#eef2ff;color:#415ba5;flex:0 0 auto;}small{display:block;margin-top:3px;color:#98a2b3;}`;
export const Progress = styled.div`display:grid;gap:5px;min-width:100px;span{height:6px;overflow:hidden;border-radius:999px;background:#eef0f4;}i{display:block;height:100%;border-radius:inherit;background:#415ba5;}small{color:#667085;font-size:10px;}`;
export const Tabs = styled.nav`display:flex;gap:5px;overflow:auto;border-bottom:1px solid #e4e7ec;padding-bottom:1px;a,button{flex:0 0 auto;border:0;border-bottom:2px solid transparent;background:transparent;padding:11px 12px;color:#667085;font-size:12px;font-weight:700;&[aria-current="page"]{border-color:#415ba5;color:#415ba5;}}`;
export const Summary = styled.div`display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;@media(max-width:840px){grid-template-columns:repeat(2,minmax(0,1fr));}@media(max-width:460px){grid-template-columns:1fr;}div{border:1px solid #eaecf0;border-radius:12px;background:#fff;padding:13px;}small{display:block;color:#98a2b3;font-size:10px;}strong{display:block;margin-top:5px;color:#344054;font-size:18px;}`;
export const Toolbar = styled.div`display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;h2{margin:0;color:#344054;font-size:16px;}div{display:flex;flex-wrap:wrap;gap:8px;}`;
export const Notice = styled.div<{ $danger?: boolean }>`border:1px solid ${({$danger})=>$danger?"#f7b9b5":"#b8dfcf"};border-radius:10px;background:${({$danger})=>$danger?"#fff2f1":"#eefaf5"};padding:11px 13px;color:${({$danger})=>$danger?"#b42318":"#16714f"};font-size:12px;`;
export const MobileCards = styled.div`display:none;@media(max-width:700px){display:grid;gap:10px;}`;
export const DesktopOnly = styled.div`@media(max-width:700px){display:none;}`;
export const CardRow = styled.article`display:grid;gap:9px;border:1px solid #eaecf0;border-radius:12px;background:#fff;padding:13px;header{display:flex;justify-content:space-between;gap:8px;}dl{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:0;}dt{color:#98a2b3;font-size:9px;}dd{margin:2px 0 0;color:#475467;font-size:11px;}`;
export const Scanner = styled.div`position:relative;overflow:hidden;border-radius:14px;background:#071426;aspect-ratio:16/9;color:#fff;video{width:100%;height:100%;object-fit:cover;}div{position:absolute;inset:18%;border:2px solid rgba(255,255,255,.8);border-radius:14px;box-shadow:0 0 0 999px rgba(0,0,0,.28);}`;
export const PublicShell = styled.main`min-height:100vh;background:linear-gradient(160deg,#eef2ff 0,#f6f8fb 34%,#fff 100%);padding:28px 16px;@media(max-width:560px){padding:0;}@media print{background:#fff;padding:0;}`;
export const PublicCard = styled.div`width:min(1220px,100%);margin:0 auto;overflow:hidden;border:1px solid #e1e5ec;border-radius:22px;background:#fff;box-shadow:0 22px 70px rgba(16,24,40,.12);@media(max-width:560px){border:0;border-radius:0;}@media print{width:100%;border:0;box-shadow:none;}`;
export const PublicHero = styled.div<{ $image?: string | null }>`min-height:220px;display:flex;align-items:flex-end;background:${({$image})=>$image?`linear-gradient(rgba(7,20,38,.18),rgba(7,20,38,.86)),url(${$image}) center/cover`:"linear-gradient(135deg,#415ba5,#071426)"};padding:32px;color:#fff;>div{max-width:800px;}span{display:inline-flex;border:1px solid rgba(255,255,255,.25);border-radius:999px;background:rgba(255,255,255,.13);padding:6px 10px;font-size:10px;font-weight:800;backdrop-filter:blur(8px);}h1{margin:12px 0 0;font-size:clamp(25px,5vw,42px);letter-spacing:-.04em;}p{margin:8px 0 0;color:rgba(255,255,255,.82);font-size:13px;line-height:1.6;}@media(max-width:560px){min-height:190px;padding:24px 20px;}@media print{min-height:110px;}`;
export const PublicContent = styled.div`display:grid;grid-template-columns:minmax(0,1.5fr) minmax(290px,.65fr);gap:24px;align-items:start;background:#f8fafc;padding:26px;>section{display:grid;gap:12px;min-width:0;}@media(max-width:880px){grid-template-columns:1fr;padding:18px;}@media(max-width:560px){padding:14px;}@media print{display:block;background:#fff;padding:18px;}`;
export const PublicAside = styled.aside`display:grid;gap:14px;position:sticky;top:18px;${Section}{p{display:flex;align-items:flex-start;gap:9px;}p svg{flex:0 0 auto;margin-top:1px;}}@media(max-width:820px){position:static;}`;
export const CartSummary = styled.div`display:grid;gap:10px;border:1px solid #dfe5f2;border-radius:14px;background:#f8faff;padding:15px;h3{margin:0;color:#344054;font-size:13px;}ul{display:grid;gap:8px;margin:0;padding:0;list-style:none;}li{display:flex;align-items:center;justify-content:space-between;gap:12px;border-bottom:1px solid #e5e9f2;padding-bottom:8px;color:#475467;font-size:11px;}li:last-child{border-bottom:0;padding-bottom:0;}li strong{color:#344054;font-size:11px;}footer{display:flex;align-items:center;justify-content:space-between;border-top:1px solid #d9e0ee;padding-top:11px;color:#344054;font-size:12px;font-weight:800;}footer strong{color:#2f4b98;font-size:16px;}`;
export const CheckoutStepper = styled.nav`
  position:relative;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:0;border-bottom:1px solid #e8ebf1;background:#fff;padding:20px 8%;
  &::before{content:"";position:absolute;top:40px;right:18%;left:18%;height:2px;background:#e5e9f0;}
  >div{position:relative;z-index:1;display:flex;align-items:center;justify-content:center;gap:10px;color:#98a2b3;}
  >div>span{display:grid;width:40px;height:40px;place-items:center;border:1px solid #e0e5ed;border-radius:50%;background:#fff;}svg{width:17px;height:17px;}
  >div>div{display:grid;gap:2px;}small{font-size:9px;font-weight:800;text-transform:uppercase;}strong{font-size:11px;}
  >div[aria-current="step"],>div[data-done="true"]{color:#415ba5;} >div[aria-current="step"]>span,>div[data-done="true"]>span{border-color:#415ba5;background:#415ba5;color:#fff;box-shadow:0 0 0 5px #eef2ff;}
  @media(max-width:640px){padding:16px 10px;&::before{right:18%;left:18%;top:34px;} >div{display:grid;gap:7px;text-align:center;} >div>span{width:36px;height:36px;margin:auto;} >div>div small{display:none;}strong{font-size:9px;}}
  @media print{display:none;}
`;
export const CheckoutPanel = styled.article`
  display:grid;gap:24px;border:1px solid #e7eaf0;border-radius:18px;background:#fff;padding:26px;box-shadow:0 16px 35px -32px rgba(16,24,40,.55);
  form{display:grid;gap:24px;}fieldset{min-width:0;margin:0;border:0;padding:0;}@media(max-width:560px){padding:19px;border-radius:15px;}
`;
export const PublicStepHeading = styled.header`display:grid;gap:5px;border-bottom:1px solid #edf0f4;padding-bottom:18px;small{color:#415ba5;font-size:9px;font-weight:850;letter-spacing:.08em;}h2{margin:0;color:#101828;font-size:24px;letter-spacing:-.04em;}p{margin:0;color:#667085;font-size:12px;line-height:1.6;}`;
export const FieldLegend = styled.legend`margin-bottom:11px;color:#344054;font-size:11px;font-weight:850;`;
export const PublicItemCards = styled.div`display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px;@media(max-width:570px){grid-template-columns:1fr;}`;
export const PublicItemCard = styled.label<{ $selected: boolean }>`
  position:relative;display:grid;grid-template-columns:42px minmax(0,1fr) 18px;gap:12px;align-items:center;min-height:104px;border:1px solid ${({$selected})=>$selected?"#6680c4":"#e2e6ed"};border-radius:15px;background:${({$selected})=>$selected?"#f0f4ff":"#fff"};padding:14px;color:#475467;cursor:pointer;transition:border-color .16s ease,box-shadow .16s ease,transform .16s ease;
  &:hover{border-color:#8799c9;box-shadow:0 10px 26px -23px rgba(16,24,40,.7);transform:translateY(-1px);}input{position:absolute;opacity:0;pointer-events:none;}
  >span{display:grid;width:42px;height:42px;place-items:center;border-radius:12px;background:${({$selected})=>$selected?"#415ba5":"#f2f4f7"};color:${({$selected})=>$selected?"#fff":"#667085"};} >span svg{width:20px;}
  >div{display:grid;gap:4px;min-width:0;}strong{color:#344054;font-size:12px;}p{display:-webkit-box;overflow:hidden;margin:0;color:#7c8798;font-size:9px;line-height:1.45;-webkit-line-clamp:2;-webkit-box-orient:vertical;}small{color:${({$selected})=>$selected?"#415ba5":"#667085"};font-size:10px;font-weight:800;} >svg{width:18px;color:#415ba5;}
  &[data-disabled="true"]{filter:grayscale(.6);opacity:.55;cursor:not-allowed;transform:none;}
`;
export const QuantityControl = styled.div`grid-column:2/4!important;display:flex!important;width:max-content!important;grid-template-columns:none!important;align-items:center;gap:9px!important;border:1px solid #d9e0ef;border-radius:9px;background:#fff;padding:4px!important;button{display:grid;width:26px;height:26px;place-items:center;border:0;border-radius:6px;background:#eef2ff;color:#415ba5;}button:hover{background:#415ba5;color:#fff;}svg{width:13px;}b{min-width:18px;color:#344054;font-size:11px;text-align:center;}`;
export const PaymentChoices = styled.div`display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;label{position:relative;display:grid;grid-template-columns:38px minmax(0,1fr) 18px;gap:10px;align-items:center;border:1px solid #e1e5ec;border-radius:13px;background:#fff;padding:13px;cursor:pointer;}label[data-selected="true"]{border-color:#6680c4;background:#eef3ff;}input{position:absolute;opacity:0;}label>span{display:grid;width:38px;height:38px;place-items:center;border-radius:10px;background:#f0f2f6;color:#667085;}label[data-selected="true"]>span{background:#415ba5;color:#fff;}svg{width:17px;}label>div{display:grid;gap:3px;}strong{color:#344054;font-size:11px;}small{color:#7c8798;font-size:9px;line-height:1.4;}label>svg{color:#415ba5;}@media(max-width:570px){grid-template-columns:1fr;}`;
export const PublicActions = styled.footer`display:flex;align-items:center;justify-content:space-between;gap:10px;border-top:1px solid #edf0f4;padding-top:20px;>div{display:flex;flex-wrap:wrap;gap:8px;}@media(max-width:520px){align-items:stretch;flex-direction:column-reverse;button{width:100%;} >div{display:grid;}}@media print{display:none;}`;
export const PixIntro = styled.div`display:flex;align-items:flex-start;gap:13px;border:1px solid #d8e2fa;border-radius:13px;background:#f5f8ff;padding:15px;>span{display:grid;width:39px;height:39px;place-items:center;border-radius:11px;background:#415ba5;color:#fff;}svg{width:19px;}strong{color:#344054;font-size:11px;}p{margin:5px 0 0;color:#6677a8;font-size:10px;line-height:1.55;}`;
export const SimulationNotice = styled.div`display:flex;align-items:flex-start;gap:13px;border:1px solid #f0cf78;border-radius:13px;background:#fff9e8;padding:14px;color:#7a5510;>span{display:grid;width:39px;height:39px;flex:0 0 auto;place-items:center;border-radius:11px;background:#d69e2e;color:#fff;}svg{width:19px;}div{display:grid;gap:4px;}strong{font-size:11px;}p{margin:0;color:#8a6a2a;font-size:10px;line-height:1.55;}`;
export const PixLayout = styled.div`display:grid;place-items:center;`;
export const PixCodePanel = styled.section`display:grid;width:min(560px,100%);justify-items:center;gap:13px;border:1px solid #e1e6ee;border-radius:20px;background:linear-gradient(180deg,#fff,#f8faff);padding:24px;text-align:center;>img{width:230px;height:230px;border:10px solid #fff;border-radius:16px;box-shadow:0 10px 35px rgba(16,24,40,.1);}h3{margin:3px 0 0;color:#101828;font-size:18px;}p{max-width:430px;margin:0;color:#667085;font-size:11px;line-height:1.6;}`;
export const SimulatedQr = styled.div`display:grid;width:230px;height:230px;place-items:center;border:10px solid #fff;border-radius:16px;background:#fff;box-shadow:0 10px 35px rgba(16,24,40,.1);>div{width:210px!important;border-radius:10px!important;padding:4px!important;}`;
export const PixStatus = styled.div`display:grid;width:100%;grid-template-columns:38px 1fr auto;gap:10px;align-items:center;border-radius:13px;background:#eef3ff;padding:11px;text-align:left;>span{display:grid;width:38px;height:38px;place-items:center;border-radius:10px;background:#415ba5;color:#fff;}svg{width:18px;}div{display:grid;gap:2px;}small{color:#6677a8;font-size:8px;font-weight:850;}strong{color:#344e97;font-size:11px;}time{border-radius:8px;background:#fff;padding:8px 10px;color:#344e97;font-size:14px;font-weight:900;font-variant-numeric:tabular-nums;}`;
export const PixCopy = styled.div`display:grid;width:100%;grid-template-columns:minmax(0,1fr) auto;gap:8px;border:1px solid #e0e5ed;border-radius:12px;background:#fff;padding:8px;code{overflow:hidden;padding:9px;color:#667085;font-size:9px;text-align:left;text-overflow:ellipsis;white-space:nowrap;}@media(max-width:520px){grid-template-columns:1fr;}`;
export const PixHelp = styled.div`display:grid;width:100%;grid-template-columns:24px 1fr;gap:8px;align-items:center;border-top:1px solid #e7eaf0;border-bottom:1px solid #e7eaf0;padding:13px 3px;text-align:left;b{display:grid;width:22px;height:22px;place-items:center;border-radius:50%;background:#e9efff;color:#415ba5;font-size:9px;}span{color:#667085;font-size:10px;}`;
export const ManualPayment = styled.section`display:grid;justify-items:center;gap:12px;padding:30px 18px;text-align:center;>span{display:grid;width:64px;height:64px;place-items:center;border-radius:20px;background:#eef3ff;color:#415ba5;}svg{width:28px;}h3{margin:4px 0 0;color:#101828;font-size:21px;}p{max-width:520px;margin:0;color:#667085;font-size:12px;line-height:1.7;}div{display:flex;align-items:center;gap:8px;border-radius:11px;background:#f2f4f7;padding:11px 13px;color:#667085;font-size:10px;}div svg{width:16px;}`;
export const ConfirmationPanel = styled.article`display:grid;gap:20px;border:1px solid #e7eaf0;border-radius:18px;background:#fff;padding:26px;box-shadow:0 16px 35px -32px rgba(16,24,40,.55);@media(max-width:560px){padding:18px;}@media print{border:0;padding:0;box-shadow:none;}`;
export const ConfirmationHeader = styled.header`display:flex;align-items:center;gap:14px;border-radius:16px;background:#edf9f4;padding:18px;>span{display:grid;width:48px;height:48px;place-items:center;border-radius:50%;background:#2f9e73;color:#fff;}svg{width:24px;}div{display:grid;gap:3px;}small{color:#278462;font-size:8px;font-weight:850;}h2{margin:0;color:#155e47;font-size:22px;}p{margin:0;color:#48806f;font-size:10px;} &[data-pending="true"]{background:#fff8e7;} &[data-pending="true"]>span{background:#d39a2e;} &[data-pending="true"] small,&[data-pending="true"] h2{color:#8a6111;} &[data-pending="true"] p{color:#8f774a;}`;
export const ReceiptGrid = styled.div`display:grid;grid-template-columns:minmax(0,1fr) minmax(250px,.72fr);gap:14px;@media(max-width:700px){grid-template-columns:1fr;}`;
export const ReceiptCard = styled.section`display:grid;align-content:start;border:1px solid #e1e5ec;border-radius:17px;background:#fff;padding:20px;header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;border-bottom:1px dashed #dfe4eb;padding-bottom:17px;}header div{display:grid;gap:4px;}small{color:#415ba5;font-size:8px;font-weight:850;}header strong{color:#101828;font-size:15px;}header svg{color:#415ba5;}dl{display:grid;gap:0;margin:8px 0;}dl>div{display:flex;align-items:center;justify-content:space-between;gap:15px;border-bottom:1px solid #f0f2f5;padding:11px 0;}dt{color:#7c8798;font-size:9px;}dd{margin:0;color:#344054;font-size:10px;font-weight:850;text-align:right;}footer{display:flex;align-items:center;justify-content:space-between;padding-top:9px;color:#344054;font-size:11px;}footer strong{color:#415ba5;font-size:17px;}`;
export const CredentialCard = styled.section`display:grid;justify-items:center;align-content:start;gap:7px;overflow:hidden;border-radius:17px;background:linear-gradient(145deg,#0d1b32,#1d3155);padding:20px;color:#fff;text-align:center;header{display:grid;width:100%;gap:4px;border-bottom:1px solid rgba(255,255,255,.12);padding-bottom:13px;text-align:left;}small{color:#8fa9e8;font-size:8px;font-weight:850;}header strong{font-size:12px;}h3{margin:5px 0 0;font-size:13px;}p{margin:0;color:#a9b6cb;font-size:9px;}footer{margin-top:8px;border-radius:8px;background:rgba(255,255,255,.08);padding:8px 10px;font-size:8px;} &[data-locked="true"]{background:linear-gradient(145deg,#384152,#1f2937);}`;
export const CredentialLocked = styled.div`display:grid;min-height:230px;place-items:center;align-content:center;gap:10px;padding:15px;>span{display:grid;width:54px;height:54px;place-items:center;border-radius:50%;background:rgba(255,255,255,.08);}svg{width:24px;color:#bac3d1;}h3{margin:0!important;}p{max-width:210px!important;line-height:1.55;}`;
export const EventInfoCard = styled.section`display:grid;gap:13px;border:1px solid #e4e8ef;border-radius:14px;background:#fff;padding:15px;h3{margin:0;color:#344054;font-size:12px;}p{display:grid!important;grid-template-columns:18px 1fr;gap:8px;align-items:start!important;margin:0;color:#667085;font-size:10px;line-height:1.55;}svg{width:16px;height:16px;margin:0!important;color:#415ba5;}`;
export const SummaryMeta = styled.div`display:grid;grid-template-columns:1fr auto;gap:7px;border-top:1px solid #d9e0ee;padding-top:10px;span{color:#7c8798;font-size:9px;}strong{color:#344054;font-size:9px;text-align:right;}`;
export const ScreenReaderStatus = styled.div`position:fixed;z-index:2000;right:18px;bottom:18px;display:flex;align-items:center;gap:8px;border-radius:999px;background:#071426;padding:10px 14px;color:#fff;font-size:10px;font-weight:750;box-shadow:0 10px 30px rgba(16,24,40,.22);svg{width:15px;animation:spin .8s linear infinite;}@keyframes spin{to{transform:rotate(360deg);}}`;
export const PublicLoading = styled.main`display:grid;min-height:100vh;place-items:center;background:linear-gradient(160deg,#eef2ff 0,#f6f8fb 40%,#fff 100%);div{display:grid;place-items:center;gap:12px;color:#415ba5;font-size:12px;font-weight:750;}svg{width:34px;height:34px;animation:spin .8s linear infinite;}@keyframes spin{to{transform:rotate(360deg);}}`;
export const ErrorText = styled.span`color:#b42318;font-size:11px;`;

export const Wizard = styled.div`
  display: grid;
  gap:20px;
  align-items:start;
  @media(min-width:1180px){grid-template-columns:minmax(280px,360px) minmax(0,1fr);}
  >form{overflow:hidden;border:1px solid ${({theme})=>theme.colors.border.soft};border-radius:19px;background:#fff;box-shadow:${({theme})=>theme.shadows.card};}
`;

export const WizardProgress = styled.aside`
  border:1px solid ${({theme})=>theme.colors.border.soft};border-radius:8px;background:#fff;padding:26px;box-shadow:${({theme})=>theme.shadows.card};
  header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;}
  header div{display:grid;gap:3px;}
  header span{color:#667085;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;}
  header strong{color:#101828;font-size:16px;font-weight:600;letter-spacing:-.03em;}
  header em{display:inline-flex;min-width:58px;min-height:36px;align-items:center;justify-content:center;border-radius:8px;background:#eef2ff;color:#415ba5;font-size:13px;font-style:normal;font-weight:800;}
  >i{display:block;height:8px;overflow:hidden;border-radius:999px;background:rgba(65,91,165,.12);margin-top:18px;}
  >i>b{display:block;height:100%;border-radius:inherit;background:#415ba5;transition:width .2s ease;}
  ol{display:grid;gap:10px;margin:20px 0 0;padding:0;list-style:none;}
  button{display:grid;width:100%;grid-template-columns:42px 1fr;gap:12px;align-items:start;border:1px solid transparent;border-radius:8px;background:#fff;padding:12px;color:#667085;text-align:left;cursor:pointer;transition:.16s ease;}
  button:hover{border-color:rgba(65,91,165,.18);background:#f8faff;}
  button[aria-current="step"]{border-color:rgba(65,91,165,.18);background:rgba(65,91,165,.08);color:#101828;}
  button[data-completed="true"]{background:#f8fafc;}
  button>span{display:grid;width:42px;height:42px;place-items:center;border-radius:8px;background:#f0f2f5;color:#667085;}
  button[aria-current="step"]>span,button[data-completed="true"]>span{background:#415ba5;color:#fff;}
  button div{display:grid;gap:3px;min-width:0;}
  button strong{color:#101828;font-size:13px;font-weight:600;letter-spacing:-.02em;}
  button small{color:#667085;font-size:12px;font-weight:500;line-height:18px;}
  @media(max-width:1179px){ol{grid-template-columns:repeat(7,minmax(145px,1fr));overflow:auto;}button{min-width:150px;}button small{display:none;}}
`;

export const WizardContent = styled.div`display:grid;min-height:640px;grid-template-rows:auto 1fr auto;`;
export const StepHeading = styled.header`
  display:flex;flex-direction:column;gap:14px;border-bottom:1px solid #edf0f4;background:#fff;padding:26px;
  span{display:inline-flex;width:fit-content;align-items:center;border-radius:8px;background:#eef2ff;color:#415ba5;padding:8px 12px;font-size:12px;font-weight:800;}
  h2{margin:0;color:#101828;font-size:24px;font-weight:700;letter-spacing:-.04em;}
  p{max-width:760px;margin:0;color:#667085;font-size:13px;font-weight:500;line-height:24px;}
`;
export const WizardBody = styled.div`align-content:start;display:grid;padding:32px;@media(max-width:600px){padding:20px;}`;
export const InnerStepHeading = styled.div`
  margin-bottom:24px;
  span{display:inline-flex;width:fit-content;border-radius:6px;background:rgba(65,91,165,.1);color:#415ba5;padding:4px 8px;font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;}
  h3{margin:8px 0 0;color:#101828;font-size:18px;font-weight:600;letter-spacing:-.03em;}
  p{margin:0;color:#667085;font-size:14px;font-weight:500;line-height:24px;}
`;
export const StepPanel = styled.section`
  align-content:start;display:grid;gap:18px;
  &[hidden]{display:none;}
`;
export const FieldGrid = styled.div`display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:15px;@media(max-width:680px){grid-template-columns:1fr;}`;
export const InfoBox = styled.div`
  display:flex;align-items:flex-start;gap:12px;border:1px solid #dce5fa;border-radius:12px;background:#f6f8ff;padding:14px;color:#415ba5;
  >svg{width:20px;flex:0 0 auto;}strong{display:block;color:#344e97;font-size:12px;}p{margin:4px 0 0;color:#6677a8;font-size:10px;line-height:1.55;}
`;
export const CardChoices = styled.div`display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;@media(max-width:680px){grid-template-columns:1fr;}`;
export const OptionCard = styled.label<{ $selected: boolean }>`
  position:relative;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:12px;min-height:96px;border:1px solid ${({$selected})=>$selected?"#6680c4":"#e0e5ed"};border-radius:14px;background:${({$selected})=>$selected?"#eef3ff":"#fff"};padding:15px;cursor:pointer;transition:.16s ease;
  &:hover{border-color:#8799c9;box-shadow:0 8px 25px -22px rgba(16,24,40,.65);}
  input{position:absolute;opacity:0;pointer-events:none;}
  >span{display:grid;width:42px;height:42px;place-items:center;border-radius:12px;background:${({$selected})=>$selected?"#415ba5":"#f2f4f7"};color:${({$selected})=>$selected?"#fff":"#667085"};}
  >span svg{width:20px;}
  div{display:grid;gap:4px;}div strong{color:#344054;font-size:12px;}div small{color:#7a8495;font-size:10px;line-height:1.45;}
  >svg{width:18px;color:${({$selected})=>$selected?"#415ba5":"transparent"};}
`;
export const UploadBox = styled.div`
  display:grid;gap:14px;border:1px dashed #b7c2d8;border-radius:15px;background:#fafbfe;padding:16px;
  >img{width:100%;height:230px;object-fit:cover;border-radius:11px;background:#e9edf4;}
  >span{display:grid;min-height:180px;place-items:center;align-content:center;gap:7px;color:#667085;text-align:center;}
  >span svg{width:36px;height:36px;color:#415ba5;} >span strong{font-size:13px;} >span small{font-size:10px;}
  >div{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;}
  label{cursor:pointer;}label input{display:none;}
`;
export const ReviewGrid = styled.div`
  display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;
  div{border:1px solid #e8ebf1;border-radius:11px;background:#fbfcfd;padding:12px;}small{display:block;color:#98a2b3;font-size:9px;}strong{display:block;margin-top:4px;color:#344054;font-size:11px;}
  @media(max-width:600px){grid-template-columns:1fr;}
`;
export const WizardFooter = styled.footer`
  display:flex;align-items:center;justify-content:space-between;gap:12px;border-top:1px solid #edf0f4;background:#fbfcfd;padding:16px 26px;
`;

export const StatStrip = styled.section`display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;@media(max-width:560px){grid-template-columns:1fr;}`;
export const StatBox = styled.article`
  display:flex;align-items:center;gap:13px;border:1px solid #e6eaf1;border-radius:15px;background:#fff;padding:16px;box-shadow:0 10px 30px -28px rgba(16,24,40,.65);
  >span{display:grid;width:42px;height:42px;place-items:center;border-radius:12px;background:#eef2ff;color:#415ba5;}strong{display:block;color:#101828;font-size:20px;}small{display:block;margin-top:2px;color:#7c8799;font-size:10px;}
`;
export const OperationalList = styled.dl`
  display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0;margin:0;border:1px solid #eaedf2;border-radius:14px;overflow:hidden;
  div{display:flex;min-height:58px;align-items:center;justify-content:space-between;gap:16px;border-bottom:1px solid #edf0f4;padding:12px 15px;}div:nth-child(odd){border-right:1px solid #edf0f4;}div:nth-last-child(-n+2){border-bottom:0;}
  dt{color:#667085;font-size:10px;font-weight:700;}dd{margin:0;color:#344054;font-size:11px;font-weight:850;text-align:right;}
  @media(max-width:640px){grid-template-columns:1fr;div:nth-child(odd){border-right:0;}div:nth-last-child(2){border-bottom:1px solid #edf0f4;}}
`;
export const ItemCards = styled.div`display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;@media(max-width:760px){grid-template-columns:repeat(2,minmax(0,1fr));}@media(max-width:460px){grid-template-columns:1fr;}`;
export const ItemCard = styled.label<{ $selected?: boolean }>`
  position:relative;display:grid;min-height:132px;place-items:center;align-content:center;gap:7px;border:1px solid ${({$selected})=>$selected?"#415ba5":"#e1e5ec"};border-radius:14px;background:${({$selected})=>$selected?"#eaf0ff":"#fff"};padding:14px;color:${({$selected})=>$selected?"#324d9a":"#475467"};text-align:center;cursor:pointer;
  input{position:absolute;opacity:0;}svg{width:25px;height:25px;}strong{font-size:11px;}small{font-size:10px;font-weight:800;}
`;
export const ModalForm = styled.form`display:grid;gap:18px;`;
export const ModalFooter = styled.div`display:flex;width:100%;align-items:center;justify-content:flex-end;gap:10px;`;
export const ChoiceTabs = styled.div`
  display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:4px;border:1px solid #e1e5ec;border-radius:12px;background:#f6f7f9;
  button{min-height:42px;border:0;border-radius:9px;background:transparent;color:#667085;font-size:11px;font-weight:850;}button[aria-pressed="true"]{background:#415ba5;color:#fff;box-shadow:0 4px 14px rgba(65,91,165,.22);}
`;
export const SearchBox = styled.div`
  position:relative;input{padding-right:38px!important;} >svg{position:absolute;right:12px;bottom:14px;width:16px;color:#415ba5;} >svg[data-loading]{animation:spin 800ms linear infinite;} @keyframes spin{to{transform:rotate(360deg);}}
`;
export const FilterSearch = styled.div`position:relative;input{padding-left:38px!important;}svg{position:absolute;left:13px;bottom:14px;width:16px;height:16px;color:#667085;}`;
export const SearchResults = styled.div`
  position:absolute;z-index:10;top:calc(100% + 5px);right:0;left:0;max-height:230px;overflow:auto;border:1px solid #dce1ea;border-radius:11px;background:#fff;padding:5px;box-shadow:0 16px 35px rgba(16,24,40,.16);
  button{display:grid;width:100%;gap:2px;border:0;border-radius:8px;background:transparent;padding:10px;text-align:left;}button:hover,button:focus{background:#f1f4fb;outline:0;}strong{color:#344054;font-size:11px;}small{color:#7d8797;font-size:9px;}
`;
export const TotalBox = styled.div`display:flex;align-items:center;justify-content:space-between;border-radius:12px;background:#f1f4fb;padding:13px 15px;color:#475467;font-size:11px;strong{color:#2f4b98;font-size:16px;}`;
export const GoalProgress = styled.div`
  display:grid;gap:5px;min-width:150px;span{height:7px;overflow:hidden;border-radius:999px;background:#e9edf3;}i{display:block;height:100%;border-radius:inherit;background:#415ba5;}small{color:#667085;font-size:9px;}
`;
export const DropField = styled.label`
  display:grid;min-height:130px;place-items:center;align-content:center;gap:7px;border:1px dashed #b7c2d8;border-radius:13px;background:#fafbfe;color:#667085;text-align:center;cursor:pointer;
  svg{width:28px;color:#415ba5;}strong{font-size:11px;}small{font-size:9px;}input{display:none;}
`;

export const DeleteWarning = styled.div`
  border-radius:13px;background:#fff4f3;padding:13px 15px;color:#8f312c;font-size:11px;font-weight:650;line-height:1.55;
  strong{color:#7a2420;}
`;

export const RegistrationFilters = styled.div`
  display:grid;grid-template-columns:repeat(3,minmax(145px,1fr));gap:10px;align-items:end;border:1px solid #e9edf3;border-radius:13px;background:#fafbfc;padding:13px;
  >span{display:block;}
  @media(max-width:1050px){grid-template-columns:repeat(2,minmax(0,1fr));}
  @media(max-width:580px){grid-template-columns:1fr;}
`;

export const FilterResult = styled.p`
  margin:-3px 0 0!important;color:#98a2b3!important;font-size:10px!important;font-weight:700!important;
`;

export const ChartsGrid = styled.div`
  display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;
  @media(max-width:820px){grid-template-columns:1fr;}
`;

export const ChartCard = styled.article`
  min-width:0;overflow:hidden;border:1px solid #e7eaf0;border-radius:14px;background:#fff;
  >header{display:flex;align-items:center;gap:10px;border-bottom:1px solid #edf0f4;padding:14px 16px;}
  >header span{display:grid;width:34px;height:34px;place-items:center;border-radius:10px;background:#eef2ff;color:#415ba5;}
  >header svg{width:17px;height:17px;}
  >header h3{margin:0;color:#344054;font-size:13px;font-weight:850;}
`;

export const ChartRows = styled.div`
  display:grid;gap:13px;max-height:390px;overflow:auto;padding:16px;
  >div{display:grid;gap:6px;}
  >div>span{display:flex;min-width:0;align-items:center;justify-content:space-between;gap:12px;}
  strong{min-width:0;overflow:hidden;color:#475467;font-size:10px;font-weight:750;text-overflow:ellipsis;white-space:nowrap;}
  b{color:#344054;font-size:11px;font-weight:900;}
  i{display:block;height:8px;overflow:hidden;border-radius:999px;background:#edf0f5;}
  em{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#415ba5,#6681cb);transition:width .2s ease;}
`;

export const ChartEmpty = styled.div`
  display:grid;min-height:180px;place-items:center;padding:24px;color:#98a2b3;font-size:11px;text-align:center;
`;

export const BlankTab = styled.div`
  min-height:280px;border:1px solid #e6e9ef;border-radius:15px;background:#fff;
`;

export const StatusDot = styled.span<{ $tone: "success"|"warning"|"danger"|"neutral" }>`display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:5px 9px;font-size:10px;font-weight:750;${({$tone})=>$tone==="success"?css`background:#e7f8ef;color:#16714f;`:$tone==="warning"?css`background:#fff7d6;color:#8a6111;`:$tone==="danger"?css`background:#ffefee;color:#b42318;`:css`background:#f2f4f7;color:#475467;`}&::before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor;}`;
