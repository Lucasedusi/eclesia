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
 .finance .empty{padding:48px 24px;text-align:center;color:#6D7F76;display:grid;justify-items:center;gap:12px}.finance .empty>svg{color:#8CA297}.finance .tabs{display:flex;gap:8px;flex-wrap:wrap}.finance .tabs button{padding:10px 14px;border-radius:8px;border:1px solid #E3EAE6;background:white;color:#52695E;font:inherit;font-size:13px;cursor:pointer}.finance .tabs button[aria-pressed=true]{background:#0B3D32;color:white;border-color:#0B3D32}
 .finance [role=alert],#finance-modal-root [role=alert]{background:#FBEFF0;color:#923840;padding:12px 16px;border-radius:8px;font-size:13px}.finance [role=status],#finance-modal-root [role=status]{font-size:13px}.finance .notice,#finance-modal-root .notice{padding:14px 16px;background:#F0F7E9;border-radius:10px;font-size:13px;line-height:1.6}
 #finance-modal-root .finance-drawer{position:fixed;right:0;top:0;bottom:0;max-height:100dvh;height:100dvh;border-radius:20px 0 0 20px;max-width:min(650px,100vw);width:650px}

 :is(.finance,#finance-modal-root) .finance-form-section{border:0;border-top:1px solid #E3EAE6!important;padding:22px 0 0!important;margin-top:8px}
 :is(.finance,#finance-modal-root) .finance-form-section:first-child{border:0!important;padding-top:0!important;margin-top:0}
 :is(.finance,#finance-modal-root) .finance-form-section h3{font-size:15px;font-weight:650;color:#18352C;margin:0}
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
 .finance .finance-attendance-form{display:grid;grid-template-columns:minmax(0,1fr) 400px;gap:30px;align-items:start}
 .finance .finance-attendance-form>[role=status],.finance .finance-attendance-form>[role=alert],.finance .finance-attendance-form>.notice{grid-column:1/-1}
 .finance .finance-attendance-summary{position:sticky;top:20px;padding:22px;background:#F4F8F5;border:1px solid #E0EAE3;border-radius:14px}
 .finance .finance-attendance-summary>.row{display:grid;gap:10px}
 .finance .finance-attendance-summary button{width:100%}
 .finance .finance-attendance-total{gap:12px;padding-bottom:20px;border-bottom:1px solid #DCE7DF}
 .finance .finance-attendance-total p{margin:0;overflow-wrap:anywhere}
 .finance .finance-attendance-total strong{font-variant-numeric:tabular-nums;color:#087F5B}
 .finance .finance-cashbox-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,330px),1fr));gap:20px;align-items:stretch}
 .finance .finance-cashbox{display:flex;flex-direction:column;gap:18px;border-top:3px solid #D7E8DE}
 .finance .finance-bank-card{border-top-color:#87B6A0}
 .finance .finance-cashbox h2{overflow-wrap:anywhere;font-size:17px}
 .finance .finance-cashbox>.row:first-child{align-items:flex-start;flex-wrap:nowrap}
 .finance .finance-cashbox>.row:first-child>.row{flex:1;flex-wrap:nowrap;min-width:0;align-items:flex-start}
 .finance .finance-cashbox svg{flex-shrink:0;color:#26775A}
 .finance .finance-cashbox p{margin:0}
 .finance .finance-account-details{display:grid;gap:6px;font-size:13px;overflow-wrap:anywhere;min-height:46px}
 .finance .finance-cashbox-actions{margin-top:auto;padding-top:16px;border-top:1px solid #EDF2EF}
 :is(.finance,#finance-modal-root) .finance-secondary-link{display:inline-flex;align-items:center;justify-content:center;gap:8px;width:fit-content;padding:9px 13px;border:1px solid #CFDCD3;border-radius:8px;background:#F8FBF9;color:#176348;font-size:13px;font-weight:500;text-decoration:none}
 :is(.finance,#finance-modal-root) .finance-secondary-link:hover{background:#EAF4EE}
 :is(.finance,#finance-modal-root) .finance-secondary-link:focus-visible{outline:2px solid #6B9F89;outline-offset:2px}
 .finance .finance-statement-meta{padding:20px 24px;border-left:3px solid #87B6A0}
 .finance .finance-statement-meta p{margin:5px 0 0}
 .finance .finance-statement-meta .muted{font-size:12px}
 .finance .finance-statement-period{font-size:14px;font-weight:500}
 .finance .finance-statement-meta .finance-statement-stale{background:#FFF6E6;color:#805D22;margin-top:16px}
 .finance .finance-statement-note{margin:0;padding:0 4px}
 .finance .finance-pwa-status{display:grid;gap:6px;padding:0 24px}
 .finance .finance-pwa-status:empty{display:none}
 .finance .finance-pwa-offline,.finance .finance-pwa-update{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 14px;border-radius:10px;font-size:13px}
 .finance .finance-pwa-offline{background:#FFF2E8;color:#814D1D}
 .finance .finance-pwa-update{background:#EDF7F0;color:#176348}
 .finance .finance-pwa-update button,.finance .finance-pwa-install button{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:44px;padding:8px 12px;border:1px solid #A9CCBA;border-radius:8px;background:white;color:#176348;font:inherit;font-size:12px;font-weight:600;cursor:pointer}
 .finance .finance-pwa-update button:focus-visible,.finance .finance-pwa-install button:focus-visible{outline:2px solid #087F5B;outline-offset:2px}
 .finance .finance-pwa-install{display:none}
 .finance .finance-base-card{background:#F5F9F7}
 .finance .finance-excluded-card{background:#F8F9FC}
 .finance .finance-base-card .finance-summary-icon{background:#DFEEE8;color:#28634F}
 .finance .finance-excluded-card .finance-summary-icon{background:#E9EDF6;color:#526580}
 .finance .finance-summary-card .amount{margin-top:14px}
 .finance .finance-search-loading{position:absolute;right:14px;top:50%;transform:translateY(-50%);display:grid;place-items:center;color:#26775A}
 .finance .finance-filter-bar{align-items:end}
 .finance .finance-search-input .finance-clear-search{background:transparent;color:#6D7F76}
 .finance .finance-search-input .finance-clear-search:hover{background:#F0F4F2}
 .finance .finance-receipt-controls{align-items:end}
 .finance .finance-receipt-controls button{height:42px;min-height:42px;padding:8px 18px}
 .finance .finance-receipt-controls>.muted{align-self:center}
 .finance .finance-attendance-summary button.finance-attendance-action{display:grid;grid-template-columns:50px minmax(0,1fr);gap:12px;text-align:left;justify-content:stretch;min-height:44px}
 .finance .finance-attendance-action>.finance-action-icon{display:flex;align-items:center;justify-content:flex-start;border-right:1px solid currentColor;min-height:22px}
 .finance .finance-attendance-action>.finance-action-label{line-height:1.4}
 :is(.finance,#finance-modal-root) .finance-entry-review{gap:12px}
 :is(.finance,#finance-modal-root) .finance-entry-review h3{font-size:15px;font-weight:650;margin:0}
 :is(.finance,#finance-modal-root) .finance-entry-review dl{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:0}
 :is(.finance,#finance-modal-root) .finance-entry-review dl>div{min-width:0}
 :is(.finance,#finance-modal-root) .finance-entry-review dt{font-size:11px;color:#6D7F76}
 :is(.finance,#finance-modal-root) .finance-entry-review dd{margin:3px 0 0;font-size:13px;font-weight:550;overflow-wrap:anywhere}
 :is(.finance,#finance-modal-root) .finance-entry-review-items{display:grid;gap:7px;padding:12px 0;border-top:1px solid #DCE7DF}
 :is(.finance,#finance-modal-root) .finance-entry-review-items .row{gap:8px;font-size:13px}
 :is(.finance,#finance-modal-root) .finance-entry-review-items .row>*{min-width:0;overflow-wrap:anywhere}
 :is(.finance,#finance-modal-root) .finance-entry-review-item-label{display:grid;gap:2px}
 :is(.finance,#finance-modal-root) .finance-entry-review-total{padding-top:12px;border-top:1px solid #DCE7DF;font-size:14px}
 :is(.finance,#finance-modal-root) .finance-entry-review-total strong{color:#087F5B;font-size:22px;font-variant-numeric:tabular-nums}
 :is(.finance,#finance-modal-root) .finance-entry-actions{display:flex;gap:10px;flex-wrap:wrap}
 :is(.finance,#finance-modal-root) .finance-entry-primary-action,:is(.finance,#finance-modal-root) .finance-entry-secondary-actions{display:flex;gap:10px;flex-wrap:wrap}
 :is(.finance,#finance-modal-root) .finance-entry-primary-total{display:none}
 @media(max-width:480px){.finance .finance-receipt-controls>*{width:100%}}
 .finance .finance-row-income,.finance .finance-row-expense{background:white}
 .finance .finance-row-income>td:first-child{box-shadow:inset 3px 0 #5A9D7C}
 .finance .finance-row-expense>td:first-child{box-shadow:inset 3px 0 #C77A7E}
 .finance .finance-row-income:hover,.finance .finance-row-expense:hover{background:#FAFCFB}
 .finance .finance-row-cancelled{background:#F7F8F7;color:#6D7F76}
 .finance .finance-transfers{padding:16px 22px}
 .finance .finance-transfers summary{display:flex;align-items:center;gap:10px;cursor:pointer;font-size:14px;color:#52695E}
 .finance .finance-transfers summary::after{content:"+";margin-left:auto}.finance .finance-transfers[open] summary::after{content:"−"}
 #finance-modal-root .table-scroll{overflow-x:auto}#finance-modal-root table{width:100%;border-collapse:collapse;font-size:13px;text-align:left}#finance-modal-root th,#finance-modal-root td{padding:12px 8px;border-bottom:1px solid #E3EAE6}
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
 @media(max-width:760px){
  .finance .finance-pwa-status{padding:0 16px}
  .finance .finance-pwa-install{display:flex;justify-content:flex-end;flex-wrap:wrap;gap:8px}
  .finance .finance-pwa-install>button{min-height:36px;padding:6px 10px;border-color:transparent;background:transparent}
  .finance .finance-pwa-install-help{display:flex;align-items:center;gap:10px;width:100%;padding:10px 12px;border-radius:10px;background:#EDF7F0;color:#176348;font-size:12px;line-height:1.5}
  .finance .finance-pwa-install-help>span{flex:1}
  .finance .finance-pwa-install-help button{min-width:44px;min-height:44px}
  .finance .finance-secondary-heading{align-items:stretch;gap:14px}
  .finance .finance-secondary-heading>*{width:100%}
  .finance .finance-secondary-heading-actions{display:grid;grid-template-columns:1fr;gap:8px}
  .finance .finance-secondary-heading-actions button,.finance .finance-secondary-heading>button{width:100%;min-height:44px}
  .finance .finance-settings-tabs{flex-wrap:nowrap;overflow-x:auto;max-width:100%;padding-bottom:5px;scrollbar-width:thin}
  .finance .finance-settings-tabs button{flex:none;min-height:44px;white-space:nowrap}
  :is(.finance,#finance-modal-root) .finance-mobile-card-table,:is(.finance,#finance-modal-root) .finance-mobile-card-table tbody,:is(.finance,#finance-modal-root) .finance-mobile-card-table tr,:is(.finance,#finance-modal-root) .finance-mobile-card-table td{display:block;width:100%}
  :is(.finance,#finance-modal-root) .finance-mobile-card-table thead{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
  :is(.finance,#finance-modal-root) .finance-mobile-card-table tbody{display:grid;gap:10px}
  :is(.finance,#finance-modal-root) .finance-mobile-card-table tr{padding:10px 14px;border:1px solid #E3EAE6;border-radius:12px;background:#fff}
  :is(.finance,#finance-modal-root) .finance-mobile-card-table td{display:block;padding:7px 0;border:0;min-width:0;overflow-wrap:anywhere}
  :is(.finance,#finance-modal-root) .finance-mobile-card-table td::before{content:attr(data-label);display:block;margin-bottom:2px;color:#6D7F76;font-size:11px;font-weight:500}
  :is(.finance,#finance-modal-root) .finance-mobile-card-table td.money{text-align:left;white-space:normal}
  :is(.finance,#finance-modal-root) .finance-mobile-card-table td button{min-width:44px;min-height:44px}
  .finance .finance-cashbox-grid{gap:12px}
  .finance .finance-cashbox{padding:18px;gap:14px}
  .finance .finance-cashbox-actions{display:grid;grid-template-columns:1fr;gap:8px}
  .finance .finance-cashbox-actions button{width:100%;min-height:44px}
  .finance .finance-statement-meta{padding:18px}
  .finance .finance-statement-meta .badge{margin-top:8px}
  #finance-modal-root .finance-secondary-drawer{inset:0;width:100vw;max-width:100vw;height:100dvh;max-height:100dvh;border-radius:0}
  #finance-modal-root .finance-secondary-drawer button[aria-label="Fechar modal"]{min-width:44px;min-height:44px}
  :is(.finance,#finance-modal-root) .finance-entry-review dl{grid-template-columns:1fr}
  :is(.finance,#finance-modal-root) .finance-entry-summary{position:static;min-width:0}
  :is(.finance,#finance-modal-root) .finance-entry-secondary-actions{display:grid;grid-template-columns:1fr;gap:8px;width:100%}
  :is(.finance,#finance-modal-root) .finance-entry-secondary-actions button{min-height:44px}
  :is(.finance,#finance-modal-root) .finance-entry-primary-action{position:fixed;left:0;right:0;bottom:calc(66px + env(safe-area-inset-bottom));z-index:100;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.45fr);align-items:center;gap:12px;padding:9px 16px;border-top:1px solid #DCE7DF;background:#FFFFFFF7;box-shadow:0 -5px 20px #0B3D3210}
  :is(.finance,#finance-modal-root) .finance-entry-primary-total{display:grid;gap:2px;font-size:11px;color:#6D7F76;min-width:0}
  :is(.finance,#finance-modal-root) .finance-entry-primary-total strong{font-size:16px;color:#087F5B;overflow-wrap:anywhere;font-variant-numeric:tabular-nums}
  :is(.finance,#finance-modal-root) .finance-entry-primary-action button{min-height:48px;width:100%}
  .finance .finance-entry-primary-action button.finance-attendance-action{grid-template-columns:20px minmax(0,1fr);gap:8px;padding:10px}
  .finance .finance-entry-primary-action button.finance-attendance-action .finance-action-icon{border:0}
  .finance .finance-attendance-form{padding-bottom:82px}
  .finance .finance-attendance-card{padding:16px}
  #finance-modal-root .finance-entry-drawer{inset:0;width:100vw;max-width:100vw;height:100dvh;max-height:100dvh;border-radius:0;padding:16px}
  #finance-modal-root .finance-entry-drawer form{padding-bottom:92px}
  #finance-modal-root .finance-entry-drawer button[aria-label="Fechar modal"]{min-width:44px;min-height:44px}
  #finance-modal-root .finance-entry-primary-action{bottom:0;z-index:1001;padding-bottom:calc(9px + env(safe-area-inset-bottom))}
  :is(.finance,#finance-modal-root) :is(input,select,textarea):focus{scroll-margin-block:80px 170px}
 }
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
  .finance-logo b {
    font-weight: 600;
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
    position: relative;
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

  .finance-menu-toggle {
    display: grid;
    place-items: center;
    width: 38px;
    height: 38px;
    flex-shrink: 0;
    border: 1px solid #dce5df;
    border-radius: 9px;
    background: #fff;
    color: #52695e;
    cursor: pointer;
  }
  .finance-menu-toggle:focus-visible {
    outline: 2px solid #6b9f89;
    outline-offset: 2px;
  }
  .finance-desktop-toggle {
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 28px;
    height: 36px;
    border: 0;
    border-radius: 0 6px 6px 0;
    background: transparent;
    color: #80958a;
  }
  .finance-desktop-toggle:hover {
    background: #edf4ef;
    color: #285c47;
  }
  .finance-mobile-toggle {
    display: none;
  }
  .finance-topbar > .row:last-child {
    margin-left: auto;
  }
  .finance-mobile-title,
  .finance-mobile-navigation,
  .finance-mobile-actions,
  .finance-overview-recent-mobile,
  .finance-mobile-nature,
  .finance-mobile-transaction-cards,
  .finance-mobile-transfers {
    display: none;
  }
  .finance-single-unit {
    display: flex;
    align-items: center;
    min-height: 36px;
    color: #18352c;
    font-size: 13px;
    font-weight: 500;
    letter-spacing: 0;
    text-transform: none;
  }
  @media (min-width: 761px) {
    &[data-collapsed="true"] .finance-sidebar {
      width: 76px;
      padding: 28px 10px;
    }
    &[data-collapsed="true"] .finance-main,
    &[data-collapsed="true"] .finance-topbar {
      margin-left: 76px;
    }
    &[data-collapsed="true"] .finance-nav-label,
    &[data-collapsed="true"] .finance-sidebar > .eyebrow,
    &[data-collapsed="true"] .finance-bottom .notice {
      display: none;
    }
    &[data-collapsed="true"] .finance-logo {
      padding: 0 0 30px;
      justify-content: center;
    }
    &[data-collapsed="true"] nav a {
      justify-content: center;
      padding: 14px 10px;
    }
    &[data-collapsed="true"] .finance-bottom {
      padding: 20px 0 0;
    }
    &[data-collapsed="true"] .finance-bottom a {
      justify-content: center;
      min-height: 42px;
    }
  }
  @media (max-width: 760px) {
    .finance-filter-bar {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }
    .finance-filter-bar > label {
      grid-column: 1 / -1;
      min-width: 0 !important;
    }
    .finance-filter-bar > button {
      min-height: 44px;
      margin: 0;
    }
    .finance-mobile-nature {
      display: flex;
      gap: 6px;
    }
    .finance-mobile-nature button {
      flex: 1;
      min-height: 44px;
      padding: 8px 6px;
      border: 1px solid #dce8e0;
      border-radius: 10px;
      background: #f7faf8;
      color: #52695e;
      font: inherit;
      font-size: 12px;
      font-weight: 600;
    }
    .finance-mobile-nature button[aria-pressed="true"] {
      border-color: #087f5b;
      background: #0b3d32;
      color: #fff;
    }
    .finance-mobile-nature button:focus-visible {
      outline: 2px solid #087f5b;
      outline-offset: 2px;
    }
    .finance-advanced-direction,
    .finance-desktop-transactions {
      display: none;
    }
    .finance-filter-totals {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 5px 10px;
    }
    .finance-filter-totals > span:first-child {
      grid-column: 1 / -1;
      font-weight: 600;
    }
    .finance-filter-totals > span {
      min-width: 0;
      font-size: 12px;
    }
    .finance-mobile-transaction-cards {
      display: grid;
      gap: 16px;
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .finance-mobile-transaction-cards h3 {
      margin: 0 0 8px;
      color: #6d7f76;
      font-size: 12px;
      font-weight: 600;
    }
    .finance-mobile-transaction-cards ul {
      display: grid;
      gap: 8px;
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .finance-mobile-transaction-card {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 10px;
      width: 100%;
      min-height: 88px;
      padding: 15px;
      border: 1px solid #dfe9e2;
      border-radius: 13px;
      background: #fff;
      color: #18352c;
      font: inherit;
      font-size: 13px;
      text-align: left;
      cursor: pointer;
    }
    .finance-mobile-transaction-card:focus-visible {
      outline: 2px solid #087f5b;
      outline-offset: 2px;
    }
    .finance-mobile-transaction-main,
    .finance-mobile-transaction-side {
      display: grid;
      gap: 4px;
      min-width: 0;
    }
    .finance-mobile-transaction-main {
      overflow-wrap: anywhere;
    }
    .finance-mobile-transaction-main > span,
    .finance-mobile-transaction-main > small {
      color: #6d7f76;
      font-size: 11px;
    }
    .finance-mobile-transaction-side {
      flex-shrink: 0;
      justify-items: end;
      max-width: 45%;
      font-variant-numeric: tabular-nums;
      text-align: right;
      overflow-wrap: anywhere;
    }
    .finance-mobile-transaction-side .badge {
      font-size: 10px;
    }
    .finance-desktop-transfers {
      display: none;
    }
    .finance-mobile-transfers {
      display: grid;
      gap: 10px;
    }
    .finance-mobile-transfer-card {
      display: grid;
      gap: 6px;
      padding: 14px;
      border: 1px solid #dfe9e2;
      border-radius: 12px;
      background: #fff;
      font-size: 13px;
      overflow-wrap: anywhere;
    }
    .finance-mobile-transfer-card p {
      margin: 0;
    }
    .finance-mobile-transfer-card > .row:last-child {
      justify-content: flex-end;
    }
    .finance-mobile-transfer-card button {
      min-width: 44px;
      min-height: 44px;
    }
    .finance-overview-summaries {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }
    .finance-overview-summaries .finance-summary-card {
      padding: 17px;
      gap: 8px;
    }
    .finance-overview-summaries .finance-summary-card:first-child {
      grid-column: 1 / -1;
      padding: 22px;
    }
    .finance-overview-summaries .finance-summary-card:not(:first-child) .amount {
      font-size: clamp(18px, 5vw, 24px);
      overflow-wrap: anywhere;
    }
    .finance-mobile-actions {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 8px;
    }
    .finance-mobile-actions a {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 7px;
      min-width: 0;
      min-height: 74px;
      padding: 8px 2px;
      color: #18352c;
      font-size: 11px;
      font-weight: 600;
      line-height: 1.2;
      text-align: center;
      text-decoration: none;
      overflow-wrap: anywhere;
    }
    .finance-mobile-action-icon {
      display: grid;
      place-items: center;
      width: 44px;
      height: 44px;
      border-radius: 14px;
      background: #e7f4eb;
      color: #087f5b;
    }
    .finance-mobile-actions a:focus-visible {
      outline: 2px solid #087f5b;
      outline-offset: 2px;
    }
    .finance-overview-recent-mobile {
      display: grid;
    }
    .finance-overview-recent-desktop {
      display: none;
    }
    .finance-overview-recent-list {
      display: grid;
    }
    .finance-overview-recent-item {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 10px;
      padding: 12px 0;
      border-top: 1px solid #edf2ef;
      font-size: 13px;
    }
    .finance-overview-recent-item > div {
      display: grid;
      gap: 3px;
      min-width: 0;
    }
    .finance-overview-recent-item > strong {
      min-width: 0;
      max-width: 45%;
      overflow-wrap: anywhere;
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    .finance-overview-recent-item .muted {
      overflow-wrap: anywhere;
    }
    .finance-desktop-toggle {
      display: none;
    }
    .finance-sidebar {
      display: none;
    }
    .finance-topbar {
      display: grid;
      gap: 8px;
      padding: 14px 16px 12px;
    }
    .finance-mobile-title {
      display: block;
      color: #0b3d32;
      font-size: 18px;
      letter-spacing: -0.4px;
    }
    .finance-context {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(125px, 0.7fr);
      gap: 12px;
      width: 100%;
    }
    .finance-context label {
      min-width: 0;
    }
    .finance-context select,
    .finance-context input {
      min-height: 44px;
      max-width: 100%;
    }
    .finance-single-unit {
      min-height: 44px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .finance-topbar > .row:last-child {
      display: none;
    }
    .finance-main {
      padding: 18px 16px calc(106px + env(safe-area-inset-bottom));
    }
    .finance-mobile-navigation {
      display: block;
      position: fixed;
      inset: auto 0 0;
      z-index: 30;
      padding: 6px 8px calc(7px + env(safe-area-inset-bottom));
      background: #fff;
      border-top: 1px solid #dce8e0;
      box-shadow: 0 -4px 20px #0b3d320c;
    }
    .finance-mobile-navigation-row {
      display: flex;
      gap: 2px;
      max-width: 560px;
      margin: auto;
    }
    .finance-mobile-navigation-row > a,
    .finance-mobile-navigation-row > button {
      flex: 1;
      min-width: 0;
      min-height: 52px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
      padding: 5px 2px;
      border: 0;
      border-radius: 10px;
      background: transparent;
      color: #60776a;
      font: inherit;
      font-size: 11px;
      font-weight: 600;
      line-height: 1.2;
      text-align: center;
      text-decoration: none;
      cursor: pointer;
    }
    .finance-mobile-navigation-row > :is(a, button)[aria-current="page"] {
      color: #087f5b;
      background: #edf7f0;
    }
    .finance-mobile-navigation :is(a, button):focus-visible {
      outline: 2px solid #087f5b;
      outline-offset: 2px;
    }
    .finance-mobile-more {
      position: absolute;
      left: 12px;
      right: 12px;
      bottom: calc(100% + 8px);
      display: grid;
      gap: 2px;
      max-width: 540px;
      max-height: min(65dvh, 420px);
      overflow-y: auto;
      margin: auto;
      padding: 8px;
      border: 1px solid #dce8e0;
      border-radius: 16px;
      background: #fff;
      box-shadow: 0 14px 42px #0b3d3226;
    }
    .finance-mobile-more a {
      display: flex;
      align-items: center;
      min-height: 48px;
      padding: 10px 12px;
      color: #18352c;
      font-size: 14px;
    }
    .finance-mobile-more a[aria-current="page"] {
      color: #087f5b;
      background: #edf7f0;
      box-shadow: none;
    }
    .finance-progress {
      bottom: calc(86px + env(safe-area-inset-bottom));
    }
  }

  .finance-report-types {
    border: 0;
    padding: 0;
    margin: 0;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
  }
  .finance-report-types legend {
    font-weight: 600;
    margin-bottom: 12px;
    font-size: 13px;
  }
  .finance-report-option {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 12px;
    padding: 20px;
    border: 1px solid #dce6e0;
    border-radius: 12px;
    cursor: pointer;
  }
  .finance-report-option[data-selected="true"] {
    border-color: #148361;
    background: #eff8f2;
  }
  .finance-report-option:focus-within {
    outline: 2px solid #87b8a5;
    outline-offset: 2px;
  }
  .finance-report-option input {
    width: 16px;
    height: 16px;
    margin: 0;
    flex-shrink: 0;
    accent-color: #087c59;
  }
  .finance-report-option svg {
    flex-shrink: 0;
    color: #087c59;
  }
  .finance-report-option strong {
    display: block;
    font-size: 14px;
    line-height: 1.5;
  }
  .finance-report-option small {
    display: block;
    color: #586e63;
    font-size: 12px;
    margin-top: 4px;
    font-weight: 400;
  }
  .finance-report-controls {
    display: flex;
    align-items: flex-end;
    gap: 16px;
    flex-wrap: wrap;
  }
  .finance-report-controls label {
    min-width: 240px;
    flex: 1;
  }
  .finance-report-controls button {
    height: 42px;
    min-height: 42px;
    min-width: 180px;
    padding: 8px 18px;
  }
  .finance-report-empty {
    text-align: center;
    display: grid;
    gap: 12px;
    padding: 42px 20px;
    justify-items: center;
    color: #526b5d;
  }
  .finance-report-empty svg {
    color: #087c59;
  }
  .finance-report-empty h2 {
    color: #183d2e;
  }
  .finance-report-empty small {
    font-size: 12px;
  }
  .finance-report-link {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    border: 1px solid #b8d2c4;
    border-radius: 8px;
    padding: 10px 14px;
    color: #096548;
    text-decoration: none;
    font-weight: 600;
    font-size: 13px;
  }
  .finance-report-link:hover {
    background: #edf6f0;
  }
  .finance-report-error {
    background: #fff1f0;
    color: #922b30;
  }
  @media (max-width: 760px) {
    .finance-reports .card {
      padding: 18px;
    }
    .finance-report-types {
      grid-template-columns: 1fr;
    }
    .finance-report-controls {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 12px;
    }
    .finance-report-controls label {
      min-width: 0;
      width: 100%;
      flex-basis: 100%;
    }
    .finance-report-controls button {
      width: 100%;
      min-width: 0;
      min-height: 48px;
    }
    .finance-report-option {
      padding: 15px;
    }
    .finance-report-ready .row {
      flex-wrap: wrap;
    }
    .finance-report-ready-actions {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      width: 100%;
      gap: 8px;
    }
    .finance-report-ready-actions .finance-report-link {
      justify-content: center;
      min-height: 48px;
      width: 100%;
    }
    .finance-receipt-controls {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      align-items: stretch;
      width: 100%;
      gap: 12px;
    }
    .finance-receipt-controls > * {
      width: 100%;
      min-width: 0;
    }
    .finance-receipt-controls button {
      min-height: 48px;
    }
    .finance .financial-receipt {
      width: min(100%, 80mm);
    }
  }
`;
