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
  .bank-import-upload-grid {
    align-items: start;
  }
  .bank-import-upload-field {
    display: grid;
    gap: 10px;
  }
  .bank-import-field-label {
    font-size: 13px;
    font-weight: 600;
    color: #52695e;
  }
  label.bank-import-dropzone {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 196px;
    padding: 24px;
    border: 2px dashed #b8cec1;
    border-radius: 12px;
    background: #f6f9f7;
    text-align: center;
    cursor: pointer;
    font-weight: 400;
  }
  .bank-import-dropzone:hover,
  .bank-import-dropzone.is-dragging,
  .bank-import-dropzone:focus-within {
    border-color: #087f5b;
    background: #edf5ef;
  }
  .bank-import-dropzone:focus-within {
    outline: 2px solid #087f5b;
    outline-offset: 3px;
  }
  .bank-import-dropzone input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
    width: 100%;
    height: 100%;
  }
  .bank-import-upload-icon {
    display: flex;
    padding: 12px;
    border-radius: 12px;
    background: #e3eee7;
    color: #087f5b;
  }
  .bank-import-upload-link {
    color: #087f5b;
    font-weight: 600;
    text-decoration: underline;
  }
  .bank-import-dropzone small {
    color: #52695e;
  }
  .bank-import-selected-file {
    display: flex;
    gap: 12px;
    align-items: center;
    padding: 12px;
    border: 1px solid #e3eae6;
    border-radius: 10px;
  }
  .bank-import-selected-file > span {
    flex: 1;
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .bank-import-selected-file strong,
  .bank-import-selected-file small {
    display: block;
  }
  .bank-import-selected-file small {
    color: #52695e;
    margin-top: 4px;
  }
  .bank-import-pagination {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 12px;
    gap: 12px;
  }
  .bank-import-pagination button {
    padding: 7px 10px;
    min-height: 32px;
    font-size: 12px;
  }
  .bank-import-metric > div {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    color: #52695e;
    font-size: 13px;
  }
  .bank-import-metric > div svg {
    color: #087f5b;
    flex-shrink: 0;
  }
  .bank-import-summary .bank-import-metric strong {
    font-size: 28px;
    margin: 14px 0 10px;
    color: #0b3d32;
  }
  .bank-import-metric small {
    color: #52695e;
    font-size: 11px;
  }
  .bank-import-metric.is-expense > div svg,
  .bank-import-summary .bank-import-metric.is-expense strong {
    color: #923840;
  }
  .bank-import-metric.is-progress {
    background: linear-gradient(120deg, #0b3d32, #087f5b);
    border: 0;
  }
  .bank-import-metric.is-progress > div,
  .bank-import-metric.is-progress small,
  .bank-import-summary .bank-import-metric.is-progress strong {
    color: white;
  }
  .bank-import-metric.is-progress > div svg {
    color: #b6e875;
  }
  .bank-import-counts {
    display: flex;
    flex-wrap: wrap;
    gap: 24px;
    padding: 16px 22px;
    font-size: 12px;
    color: #52695e;
  }
  .bank-import-counts span {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .bank-import-counts span:first-child svg {
    color: #927122;
  }
  .bank-import-status.status-PENDING {
    color: #72591d;
    background: #fff7d6;
    border: 1px solid #ead99a;
  }
  .bank-import-status.status-IGNORED,
  .bank-import-status.status-DELETED {
    color: #52695e;
    background: #f0f3f1;
  }
  .bank-import-options {
    border: 1px solid #e3eae6;
    border-radius: 10px;
    padding: 14px 18px;
    background: #fafcfb;
  }
  .bank-import-options > summary {
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
    color: #52695e;
  }
  .bank-import-options .tabs button {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }
  .bank-import-options > .stack {
    margin-top: 18px;
  }
  .bank-import-warning summary {
    cursor: pointer;
    font-weight: 600;
  }
  .bank-import-warning label {
    margin-top: 12px;
  }
  .finance-entry-secondary-actions {
    width: 100%;
  }
  .finance-attendance-summary .finance-entry-secondary-actions {
    display: grid;
    grid-template-columns: 1fr;
  }
  .bank-import-table td:last-child {
    white-space: nowrap;
  }
  .bank-import-table td:last-child > button + button {
    margin-left: 6px;
  }
  @media (max-width: 1100px) {
    .bank-import-summary {
      gap: 12px;
    }
    .bank-import-metric {
      padding: 18px;
    }
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
