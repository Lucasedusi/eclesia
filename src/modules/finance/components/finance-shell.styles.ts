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
 .finance label,#finance-modal-root label{display:grid;gap:7px;font-size:13px;font-weight:500}
 .finance input:not([type=checkbox]),.finance select,.finance textarea,#finance-modal-root input:not([type=checkbox]),#finance-modal-root select,#finance-modal-root textarea{width:100%;min-height:42px;padding:10px 12px;border:1px solid #CFDCD3;border-radius:8px;background:white;color:#18352C;font:inherit;font-size:14px}
 .finance input:focus-visible,.finance select:focus-visible,.finance textarea:focus-visible,#finance-modal-root input:focus-visible,#finance-modal-root select:focus-visible,#finance-modal-root textarea:focus-visible{outline:3px solid #B6E875;outline-offset:2px}
 .finance label.check,#finance-modal-root label.check{display:flex;align-items:center;gap:9px}.finance input[type=checkbox],#finance-modal-root input[type=checkbox]{accent-color:#087F5B;width:17px;height:17px}
 .finance .table-scroll{position:relative;overflow-x:auto;min-width:0;max-width:100%}.finance table{width:100%;border-collapse:collapse;font-size:13px;text-align:left}.finance th{color:#6D7F76;font-size:11px;font-weight:500;text-transform:uppercase;letter-spacing:.6px;background:#F8FAF9}.finance th,.finance td{padding:15px 12px;border-bottom:1px solid #EDF2EF}.finance td.money{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}.finance tbody tr:last-child td{border-bottom:0}.finance tbody tr:hover{background:#FAFCFB}
 .finance .empty{padding:48px 24px;text-align:center;color:#6D7F76}.finance .tabs{display:flex;gap:8px;flex-wrap:wrap}.finance .tabs button{padding:10px 14px;border-radius:8px;border:1px solid #E3EAE6;background:white;color:#52695E;font:inherit;font-size:13px;cursor:pointer}.finance .tabs button[aria-pressed=true]{background:#0B3D32;color:white;border-color:#0B3D32}
 .finance [role=alert],#finance-modal-root [role=alert]{background:#FBEFF0;color:#923840;padding:12px 16px;border-radius:8px;font-size:13px}.finance [role=status],#finance-modal-root [role=status]{font-size:13px}.finance .notice,#finance-modal-root .notice{padding:14px 16px;background:#F0F7E9;border-radius:10px;font-size:13px;line-height:1.6}
 #finance-modal-root .finance-drawer{position:fixed;right:0;top:0;bottom:0;max-height:100dvh;height:100dvh;border-radius:20px 0 0 20px;max-width:min(650px,100vw);width:650px}
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
