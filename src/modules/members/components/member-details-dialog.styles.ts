import styled from "styled-components";
import { Modal } from "@/components/ui/modal";
import { Body } from "@/components/ui/modal.styles";

export const DetailsModal = styled(Modal)`height: min(860px, calc(100dvh - 40px)); ${Body} { flex: 1; } @media (max-width: 640px) { height: calc(100dvh - 24px); }`;

export const FooterActions = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  @media (max-width: 520px) {
    width: 100%;
    flex-direction: column-reverse;
    button, a { width: 100%; justify-content: center; }
  }
`;
