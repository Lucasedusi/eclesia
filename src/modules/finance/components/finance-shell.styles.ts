"use client";
import styled, { createGlobalStyle } from "styled-components";
export const FinanceStyles = createGlobalStyle`
 .finance,#finance-modal-root{color:#18352C;font-family:var(--font-app),sans-serif}
 .finance h1{font-size:28px;font-weight:600;letter-spacing:-.8px;margin:0}.finance h2{font-size:18px;font-weight:500;margin:0}.finance h3{font-size:15px;font-weight:500;margin:0}.finance p{line-height:1.6}
 .finance .muted,#finance-modal-root .muted{color:#6D7F76;font-size:13px}.finance .eyebrow{font-size:11px;letter-spacing:1.6px;text-transform:uppercase;font-weight:600;color:#6D7F76}
 .finance .stack,#finance-modal-root .stack{display:grid;gap:18px}.finance .row,#finance-modal-root .row{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.finance .spread{justify-content:space-between}
 .finance .stack>*,.finance .grid>*,#finance-modal-root .stack>*,#finance-modal-root .grid>*{min-width:0}
 .finance .grid,#finance-modal-root .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:18px}
 .finance .card,#finance-modal-root .card{background:white;border:1px solid #E3EAE6;border-radius:18px;padding:24px;box-shadow:0 3px 12px #18352c03}
 .finance .amount{font-variant-numeric:tabular-nums;font-size:28px;letter-spacing:-.8px;font-weight:500}.finance .positive{color:#087F5B}.finance .negative{color:#B5474D}
 .finance .badge,#finance-modal-root .badge{display:inline-flex;align-items:center;gap:6px;border-radius:50px;padding:5px 10px;background:#EDF5EF;color:#176348;font-size:11px;font-weight:500}
 .finance label,#finance-modal-root label{display:grid;gap:8px;font-size:12px;font-weight:600;color:#52695E}
 .finance input:not([type=checkbox]),.finance select,.finance textarea,#finance-modal-root input:not([type=checkbox]),#finance-modal-root select,#finance-modal-root textarea{width:100%;min-height:42px;padding:10px 12px;border:1px solid #CFDCD3;border-radius:8px;background:white;color:#18352C;font:inherit;font-size:14px;font-weight:400}
 .finance input:focus-visible,.finance select:focus-visible,.finance textarea:focus-visible,#finance-modal-root input:focus-visible,#finance-modal-root select:focus-visible,#finance-modal-root textarea:focus-visible{outline:1px solid #6B9F89;outline-offset:-1px;border-color:#6B9F89;box-shadow:inset 0 0 0 1px #6B9F8920}
 .finance label.check,#finance-modal-root label.check{display:flex;align-items:center;gap:9px}.finance input[type=checkbox],#finance-modal-root input[type=checkbox]{accent-color:#087F5B;width:17px;height:17px}
 .finance .table-scroll{position:relative;overflow-x:auto;min-width:0;max-width:100%}.finance table{width:100%;border-collapse:collapse;font-size:13px;text-align:left}.finance th{color:#6D7F76;font-size:11px;font-weight:500;text-transform:uppercase;letter-spacing:.6px;background:#F8FAF9}.finance th,.finance td{padding:15px 12px;border-bottom:1px solid #EDF2EF}.finance td.money{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}.finance tbody tr:last-child td{border-bottom:0}.finance tbody tr:hover{background:#FAFCFB}
 .finance .empty{padding:48px 24px;text-align:center;color:#6D7F76}.finance .tabs{display:flex;gap:8px;flex-wrap:wrap}.finance .tabs button{padding:10px 14px;border-radius:8px;border:1px solid #E3EAE6;background:white;color:#52695E;font:inherit;font-size:13px;cursor:pointer}.finance .tabs button[aria-pressed=true]{background:#0B3D32;color:white;border-color:#0B3D32}
 .finance [role=alert],#finance-modal-root [role=alert]{background:#FBEFF0;color:#923840;padding:12px 16px;border-radius:8px;font-size:13px}.finance [role=status],#finance-modal-root [role=status]{font-size:13px}.finance .notice,#finance-modal-root .notice{padding:14px 16px;background:#F0F7E9;border-radius:10px;font-size:13px;line-height:1.6}
 #finance-modal-root .finance-drawer{position:fixed;right:0;top:0;bottom:0;max-height:100dvh;height:100dvh;border-radius:20px 0 0 20px;max-width:min(650px,100vw);width:650px}

 :is(.finance,#finance-modal-root) .finance-form-section{border:0;border-top:1px solid #E3EAE6!important;padding:22px 0 0!important;margin-top:8px}
 :is(.finance,#finance-modal-root) .finance-form-section:first-child{border:0!important;padding-top:0!important;margin-top:0}
 :is(.finance,#finance-modal-root) .finance-form-section legend{float:left;width:100%;font-size:15px;font-weight:650;color:#18352C;margin-bottom:6px;padding:0}
 :is(.finance,#finance-modal-root) .finance-form-section legend+*{clear:both}
 :is(.finance,#finance-modal-root) .finance-section-title{font-size:15px;font-weight:650;margin-top:12px;padding-top:20px;border-top:1px solid #E3EAE6}
 :is(.finance,#finance-modal-root) .finance-money-field{position:relative;display:block;font-weight:400}
 :is(.finance,#finance-modal-root) .finance-money-field>span{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:#788A80;font-size:12px;pointer-events:none}
 :is(.finance,#finance-modal-root) .finance-money-field>span::before{content:"R$"}
 :is(.finance,#finance-modal-root) .finance-money-field>input{padding-left:39px;font-variant-numeric:tabular-nums}
 :is(.finance,#finance-modal-root) .finance-person-search{display:grid;grid-template-columns:minmax(120px,1fr) minmax(0,2fr);gap:16px;align-items:end}
 :is(.finance,#finance-modal-root) .finance-person-query{display:grid;gap:8px;min-width:0}
 :is(.finance,#finance-modal-root) .finance-search-controls{display:flex;align-items:center;gap:8px}
 :is(.finance,#finance-modal-root) .finance-search-input{position:relative;flex:1;min-width:0}
 :is(.finance,#finance-modal-root) .finance-search-input input{padding-right:45px}
 :is(.finance,#finance-modal-root) .finance-search-input button{position:absolute;right:3px;top:3px;bottom:3px;width:36px;display:grid;place-items:center;border:0;border-radius:6px;background:#EDF5EF;color:#176348;cursor:pointer}
 :is(.finance,#finance-modal-root) .finance-search-input button:focus-visible{outline:2px solid #6B9F89;outline-offset:-2px}
 :is(.finance,#finance-modal-root) .finance-icon-button{width:42px;min-width:42px;height:42px;min-height:42px!important;padding:0;flex-shrink:0}
 :is(.finance,#finance-modal-root) .finance-payment-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px}
 :is(.finance,#finance-modal-root) .finance-payment-tiles legend{grid-column:1/-1}
 :is(.finance,#finance-modal-root) .finance-payment-tile{position:relative;display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:12px;min-height:98px;padding:16px;border:1px solid #DCE5DF;border-radius:12px;background:#FAFCFB;cursor:pointer;color:#52695E;transition:background .15s,border-color .15s}
 :is(.finance,#finance-modal-root) .finance-payment-tile input{position:absolute;opacity:0;width:1px;height:1px}
 :is(.finance,#finance-modal-root) .finance-payment-tile:has(input:checked){background:#EDF8EF;border-color:#70AF8C;color:#126442}
 :is(.finance,#finance-modal-root) .finance-payment-tile:has(input:focus-visible){outline:2px solid #6B9F89;outline-offset:2px}
 :is(.finance,#finance-modal-root) .finance-payment-check{position:absolute;right:12px;top:12px;opacity:0}
 :is(.finance,#finance-modal-root) .finance-payment-tile:has(input:checked) .finance-payment-check{opacity:1}
 .finance .finance-attendance-form{display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:30px;align-items:start}
 .finance .finance-attendance-form>[role=status],.finance .finance-attendance-form>[role=alert],.finance .finance-attendance-form>.notice{grid-column:1/-1}
 .finance .finance-attendance-summary{position:sticky;top:20px;padding:22px;background:#F4F8F5;border:1px solid #E0EAE3;border-radius:14px}
 .finance .finance-attendance-summary>.row{display:grid;gap:10px}
 .finance .finance-attendance-summary button{width:100%}
 .finance .finance-attendance-total{gap:12px;padding-bottom:20px;border-bottom:1px solid #DCE7DF}
 .finance .finance-attendance-total p{margin:0;overflow-wrap:anywhere}
 .finance .finance-attendance-total strong{font-variant-numeric:tabular-nums;color:#087F5B}
 .finance .finance-bank-card{position:relative;overflow:hidden;background:linear-gradient(125deg,#123F34,#21654E);color:#fff;border-color:#245F4C;box-shadow:0 10px 26px #163F3417}
 .finance .finance-bank-card::before{content:"";position:absolute;width:250px;height:250px;border:1px solid #ffffff12;border-radius:50%;right:-100px;top:-100px;pointer-events:none}
 .finance .finance-bank-card .muted{color:#D3E7DB}
 .finance .finance-bank-card .negative{color:#FFD2D8}
 .finance .finance-bank-card .badge{background:#FFFFFF18;color:#E4F6E9}
 .finance .finance-bank-card button{background:#ffffffed;color:#1B5441;border-color:transparent}
 .finance .finance-bank-data{display:grid;gap:12px;font-size:13px;letter-spacing:.4px}
 .finance .finance-bank-chip{width:38px;height:29px;border-radius:6px;border:1px solid #D2C19C;background:linear-gradient(120deg,#DCCFAF,#A89874);box-shadow:inset 0 0 0 6px #ffffff14}
 .finance .finance-cashbox-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,330px),1fr));gap:20px;align-items:start}
 .finance .finance-cashbox{align-content:start;gap:16px}
 .finance .finance-cashbox h2{overflow-wrap:anywhere}
 .finance .finance-summary-card{position:relative;overflow:hidden}
 .finance .finance-summary-icon{display:grid;place-items:center;width:42px;height:42px;border-radius:13px;background:#FFFFFF12}
 .finance .finance-income-card{background:linear-gradient(140deg,#FFFFFF,#F3FAF5);border-color:#D7E9DE}
 .finance .finance-income-card .finance-summary-icon{background:#E3F3E8}
 .finance .finance-expense-card{background:linear-gradient(140deg,#FFFFFF,#FFF4F4);border-color:#EEDADB}
 .finance .finance-expense-card .finance-summary-icon{background:#FBE4E6}
 .finance .finance-expense-card .amount{color:#AD3E46}
 :is(.finance,#finance-modal-root) .finance-expense-action{color:#AD3E46;border-color:#E7C4C8;background:#FFF7F7}
 :is(.finance,#finance-modal-root) .finance-expense-badge{color:#AD3E46;background:#FCECEE}
 .finance .finance-progress{position:fixed;z-index:100;bottom:24px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:10px;padding:12px 18px;border:1px solid #CFE3D6;border-radius:30px;background:#FFFFFFF5;color:#176348;box-shadow:0 6px 30px #18352C20;pointer-events:none}
 .finance-spinner{width:16px;height:16px;display:inline-block;border:2px solid #CEE3D6;border-top-color:#087F5B;border-radius:50%;animation:finance-spin .7s linear infinite}
 .finance-spin{animation:finance-spin .7s linear infinite}
 .finance-skeleton-block{animation:finance-pulse 1.4s ease-in-out infinite}
 @keyframes finance-spin{to{transform:rotate(360deg)}}
 @keyframes finance-pulse{50%{opacity:.42}}
 @media(max-width:1100px){.finance .finance-attendance-form{grid-template-columns:minmax(0,1fr)}.finance .finance-attendance-summary{position:static}.finance .finance-attendance-summary>.row{display:flex}}
 @media(max-width:480px){:is(.finance,#finance-modal-root) .finance-person-search{grid-template-columns:1fr}.finance .finance-attendance-summary>.row{display:grid}}
 @media(prefers-reduced-motion:reduce){.finance *,#finance-modal-root *{animation:none!important;transition:none!important}}
 @media print{.finance-sidebar,.finance-topbar,.finance .no-print{display:none!important}.finance-main{margin:0!important;padding:0!important}.finance .card{box-shadow:none;break-inside:avoid;background:white!important;color:black!important}.finance .muted,.finance .eyebrow{color:#333!important}.finance .table-scroll{overflow:visible}.finance table{font-size:10px}.finance th,.finance td{padding:8px 5px}.finance{background:white!important;min-height:0!important}}
`;
export const Workspace = styled.div`
  min-height: 100dvh;
  background: #f5f7f6;
  .finance-sidebar {
    position: fixed;
    inset: 0 auto 0 0;
    width: 230px;
    background: #fff;
    border-right: 1px solid #e3eae6;
    padding: 32px 18px;
    display: flex;
    flex-direction: column;
    z-index: 20;
  }
  .finance-logo {
    display: flex;
    gap: 10px;
    align-items: center;
    font-size: 23px;
    font-weight: 600;
    letter-spacing: -1px;
    padding: 0 14px 35px;
  }
  .finance-logo span {
    width: 35px;
    height: 38px;
    border-radius: 11px;
    background: #0b3d32;
    color: #b6e875;
    display: grid;
    place-items: center;
  }
  nav {
    display: grid;
    gap: 7px;
  }
  nav a {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 13px 15px;
    border-radius: 10px;
    color: #6d7f76;
    font-size: 13px;
    text-decoration: none;
    transition: background 0.18s;
  }
  nav a:hover {
    background: #f0f6f2;
  }
  nav a[aria-current="page"] {
    background: #0b3d32;
    color: white;
    box-shadow: 0 4px 10px #0b3d3215;
  }
  nav a[aria-current="page"] svg {
    color: #b6e875;
  }
  .finance-bottom {
    margin-top: auto;
    padding: 20px 14px 0;
  }
  .finance-bottom a {
    font-size: 12px;
    color: #52695e;
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .finance-topbar {
    margin-left: 230px;
    background: #ffffffd9;
    border-bottom: 1px solid #e3eae6;
    padding: 18px 36px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
  }
  .finance-main {
    margin-left: 230px;
    padding: 30px 36px 48px;
    max-width: 1800px;
  }
  .finance-context {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .finance-context label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.7px;
  }
  .finance-context select,
  .finance-context input {
    font-size: 12px;
    min-height: 36px;
    padding: 7px 10px;
    letter-spacing: 0;
    text-transform: none;
  }
  .finance-user {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: #edf5ef;
    display: grid;
    place-items: center;
    color: #087f5b;
    font-size: 12px;
    font-weight: 600;
  }
  @media (max-width: 1100px) {
    .finance-sidebar {
      width: 200px;
      padding: 24px 12px;
    }
    .finance-topbar,
    .finance-main {
      margin-left: 200px;
      padding: 24px;
    }
  }
  @media (max-width: 760px) {
    .finance-sidebar {
      position: static;
      width: auto;
      padding: 15px;
      border-right: 0;
      border-bottom: 1px solid #e3eae6;
    }
    .finance-logo {
      padding: 0 0 12px;
      font-size: 20px;
    }
    .finance-sidebar nav {
      display: flex;
      overflow-x: auto;
      gap: 6px;
    }
    .finance-sidebar nav a {
      white-space: nowrap;
      padding: 10px;
      font-size: 12px;
    }
    .finance-sidebar nav svg {
      width: 16px;
    }
    .finance-sidebar .eyebrow,
    .finance-bottom {
      display: none;
    }
    .finance-topbar,
    .finance-main {
      margin-left: 0;
      padding: 18px;
    }
    .finance-context {
      gap: 8px;
    }
    .finance-context select {
      max-width: 180px;
    }
    .finance-topbar .finance-user {
      display: none;
    }
    .finance-context {
      min-width: 0;
      flex: 1;
    }
    .finance-context label {
      min-width: 0;
    }
    .finance-topbar .identity {
      display: none;
    }
    .finance h1 {
      font-size: 24px;
    }
  }
`;
