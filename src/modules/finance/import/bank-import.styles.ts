"use client";
import styled from "styled-components";
export const BankImportLayout = styled.div`
  min-width: 0;
  .bank-import-mobile {
    display: none;
  }
  .bank-import-card {
    background: white;
    border: 1px solid #e3eae6;
    border-radius: 14px;
    padding: 24px;
  }
  .bank-import-summary {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 18px;
  }
  .bank-import-summary strong {
    display: block;
    font-size: 22px;
    margin-top: 6px;
    font-variant-numeric: tabular-nums;
  }
  .bank-import-filters {
    display: grid;
    grid-template-columns: 1fr 1fr 2fr auto;
    align-items: end;
    gap: 14px;
  }
  .bank-import-table {
    overflow-x: auto;
  }
  .bank-import-table table {
    width: 100%;
    border-collapse: collapse;
  }
  .bank-import-table td,
  .bank-import-table th {
    text-align: left;
    padding: 14px 10px;
    border-bottom: 1px solid #e3eae6;
    vertical-align: top;
  }
  .bank-import-table th {
    font-size: 12px;
    color: #52695e;
  }
  .bank-import-table td {
    font-size: 13px;
  }
  .bank-import-excerpt {
    display: block;
    color: #52695e;
    max-width: 340px;
    white-space: pre-line;
    overflow-wrap: anywhere;
  }
  .bank-import-source {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 18px;
    padding: 20px;
    background: #f6f9f7;
    border-radius: 10px;
  }
  .bank-import-source dt {
    color: #52695e;
    font-size: 12px;
    margin-bottom: 4px;
  }
  .bank-import-source dd {
    margin: 0;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .bank-import-source-wide {
    grid-column: 1/-1;
  }
  .bank-import-expense {
    color: #923840;
  }
  .bank-import-warning {
    padding: 14px 16px;
    background: #fff7d6;
    border-radius: 10px;
    color: #72591d;
  }
  .bank-import-status {
    font-size: 12px;
    border-radius: 6px;
    background: #edf5ef;
    color: #176348;
    padding: 4px 8px;
    white-space: nowrap;
  }
  .bank-import-history {
    margin: 0;
    padding-left: 18px;
  }
  .bank-import-history li {
    padding: 6px 0;
    font-size: 13px;
  }
  .bank-import-history p {
    white-space: pre-wrap;
  }
  .bank-import-choice {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 12px;
    align-items: center;
    border-top: 1px solid #e3eae6;
    padding: 12px 0;
  }
  @media (max-width: 760px) {
    .bank-import-desktop {
      display: none;
    }
    .bank-import-mobile {
      display: grid;
      gap: 16px;
    }
  }
`;
