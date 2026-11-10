"use client";
import styled from "styled-components";
import { Modal } from "@/components/ui/modal";
import { Body } from "@/components/ui/modal.styles";

export const StatementModal = styled(Modal)`
  height: min(800px, calc(100dvh - 40px));
  ${Body} {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  @media (max-width: 640px) {
    height: calc(100dvh - 24px);
  }
`;
export const Controls = styled.div`
  display: grid;
  grid-template-columns: 140px 1fr;
  align-items: end;
  gap: 16px;
  p {
    margin: 0;
    color: #667085;
    font-size: 11px;
    line-height: 1.5;
  }
  @media (max-width: 480px) {
    grid-template-columns: 1fr;
  }
`;
export const Preview = styled.div`
  display: flex;
  flex: 1;
  min-height: 220px;
  justify-content: center;
  background: #f2f4f7;
  border: 1px solid #e4e7ec;
  border-radius: 6px;
  padding: 12px;
  iframe {
    display: block;
    max-width: 100%;
    height: 100%;
    min-height: 220px;
    border: 0;
    background: #fff;
  }
`;
