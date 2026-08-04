"use client";

import styled, { keyframes } from "styled-components";

type SummaryTone = "primary" | "success" | "neutral" | "warning";

const spin = keyframes`
  to { transform: rotate(360deg); }
`;

const skeleton = keyframes`
  0% { background-position: 100% 0; }
  100% { background-position: -100% 0; }
`;

const toneColor = {
  primary: "#415ba5",
  success: "#2f9e73",
  neutral: "#667085",
  warning: "#b98112",
};

const toneBackground = {
  primary: "rgba(65, 91, 165, 0.10)",
  success: "#e7f8ef",
  neutral: "#f2f4f7",
  warning: "#fff7d6",
};

export const Content = styled.div`
  display: grid;
  gap: 18px;
  padding: 2px 4px 4px;
`;

export const SummaryGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(145px, 1fr));
  gap: 10px;

  @media (max-width: 700px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`;

export const SummaryCard = styled.div<{ $tone: SummaryTone }>`
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 11px;
  border: 1px solid ${({ theme }) => theme.colors.border.soft};
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.colors.surface.card};
  padding: 13px;

  > span {
    display: inline-flex;
    width: 36px;
    height: 36px;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    border-radius: 9px;
    background: ${({ $tone }) => toneBackground[$tone]};
    color: ${({ $tone }) => toneColor[$tone]};
  }

  svg {
    width: 17px;
    height: 17px;
    stroke-width: 1.9;
  }

  div {
    display: grid;
    min-width: 0;
    gap: 2px;
  }

  strong {
    overflow: hidden;
    color: ${({ theme }) => theme.colors.text.title};
    font-size: 15px;
    font-weight: 800;
    line-height: 1.15;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  small {
    color: ${({ theme }) => theme.colors.text.soft};
    font-size: 9px;
    font-weight: 750;
    line-height: 1.3;
  }
`;

export const Section = styled.section`
  display: grid;
  gap: 14px;
  border: 1px solid ${({ theme }) => theme.colors.border.soft};
  border-radius: ${({ theme }) => theme.radius.lg};
  background: ${({ theme }) => theme.colors.surface.card};
  padding: 16px;
`;

export const SectionHeader = styled.div`
  display: flex;
  min-width: 0;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;

  > div {
    min-width: 0;
  }

  h3 {
    margin: 0;
    color: ${({ theme }) => theme.colors.text.body};
    font-size: 12px;
    font-weight: 850;
  }

  p {
    margin: 3px 0 0;
    color: ${({ theme }) => theme.colors.text.soft};
    font-size: 9px;
    font-weight: 650;
    line-height: 1.45;
  }
`;

export const InfoGrid = styled.dl`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 15px 18px;
  margin: 0;

  @media (max-width: 700px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (max-width: 440px) {
    grid-template-columns: 1fr;
  }
`;

export const InfoItem = styled.div<{ $wide?: boolean }>`
  display: grid;
  min-width: 0;
  grid-column: ${({ $wide }) => ($wide ? "1 / -1" : "auto")};
  gap: 4px;

  dt {
    color: ${({ theme }) => theme.colors.text.soft};
    font-size: 9px;
    font-weight: 750;
  }

  dd {
    min-width: 0;
    margin: 0;
    overflow-wrap: anywhere;
    color: ${({ theme }) => theme.colors.text.body};
    font-size: 11px;
    font-weight: 700;
    line-height: 1.45;
  }
`;

export const Link = styled.a`
  color: ${({ theme }) => theme.colors.brand.primary};
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`;

export const Notes = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.colors.text.body};
  font-size: 11px;
  font-weight: 600;
  line-height: 1.65;
  white-space: pre-wrap;
`;

export const StatusBadge = styled.span<{ $active: boolean }>`
  display: inline-flex;
  width: fit-content;
  min-height: 25px;
  align-items: center;
  border-radius: ${({ theme }) => theme.radius.full};
  background: ${({ $active, theme }) =>
    $active ? theme.colors.state.successSoft : theme.colors.surface.muted};
  color: ${({ $active, theme }) =>
    $active ? theme.colors.state.success : theme.colors.text.muted};
  padding: 0 9px;
  font-size: 9px;
  font-weight: 850;
`;

export const CountBadge = styled.span`
  display: inline-flex;
  min-height: 25px;
  align-items: center;
  border-radius: ${({ theme }) => theme.radius.full};
  background: ${({ theme }) => theme.colors.state.infoSoft};
  color: ${({ theme }) => theme.colors.brand.primary};
  padding: 0 9px;
  font-size: 9px;
  font-weight: 850;
`;

export const SearchBox = styled.label`
  position: relative;
  display: block;
  width: min(100%, 250px);

  svg {
    position: absolute;
    top: 50%;
    left: 11px;
    width: 14px;
    height: 14px;
    color: ${({ theme }) => theme.colors.text.soft};
    transform: translateY(-50%);
    pointer-events: none;
  }

  input {
    width: 100%;
    min-height: 38px;
    border: 1px solid ${({ theme }) => theme.colors.border.strong};
    border-radius: ${({ theme }) => theme.radius.md};
    outline: 0;
    background: ${({ theme }) => theme.colors.surface.card};
    padding: 0 11px 0 33px;
    color: ${({ theme }) => theme.colors.text.body};
    font-size: 10px;
    font-weight: 650;

    &:focus {
      border-color: ${({ theme }) => theme.colors.brand.primary};
      box-shadow: ${({ theme }) => theme.shadows.focus};
    }
  }

  @media (max-width: 560px) {
    width: 100%;
  }
`;

export const LinkedList = styled.div`
  display: grid;
  max-height: 310px;
  gap: 8px;
  overflow-y: auto;
  padding-right: 3px;

  &::-webkit-scrollbar {
    width: 4px;
  }

  &::-webkit-scrollbar-thumb {
    border-radius: ${({ theme }) => theme.radius.full};
    background: #d9deea;
  }
`;

export const LinkedItem = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(120px, 1fr) minmax(100px, 0.8fr) auto auto;
  align-items: center;
  gap: 12px;
  border: 1px solid ${({ theme }) => theme.colors.border.soft};
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.colors.surface.soft};
  padding: 11px 12px;

  @media (max-width: 700px) {
    grid-template-columns: minmax(0, 1fr) auto;

    > div:not(:first-child) {
      grid-column: 1 / 2;
    }

    > span,
    > button {
      grid-column: 2 / 3;
      grid-row: 1;
    }

    > button {
      grid-row: 2;
    }
  }
`;

export const LinkedPrimary = styled.div`
  display: grid;
  min-width: 0;
  gap: 3px;

  strong {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 6px;
    overflow: hidden;
    color: ${({ theme }) => theme.colors.text.body};
    font-size: 10px;
    font-weight: 800;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  strong svg {
    width: 13px;
    height: 13px;
    flex: 0 0 auto;
    color: ${({ theme }) => theme.colors.brand.primary};
  }

  small {
    color: ${({ theme }) => theme.colors.text.soft};
    font-size: 8px;
    font-weight: 650;
  }
`;

export const LinkedMeta = styled.div`
  display: grid;
  min-width: 0;
  gap: 2px;

  small {
    color: ${({ theme }) => theme.colors.text.soft};
    font-size: 8px;
    font-weight: 700;
  }

  span {
    overflow: hidden;
    color: ${({ theme }) => theme.colors.text.body};
    font-size: 9px;
    font-weight: 700;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

export const ViewButton = styled.button`
  display: inline-flex;
  width: 32px;
  height: 32px;
  align-items: center;
  justify-content: center;
  border: 1px solid ${({ theme }) => theme.colors.border.soft};
  border-radius: ${({ theme }) => theme.radius.sm};
  background: ${({ theme }) => theme.colors.surface.card};
  color: ${({ theme }) => theme.colors.brand.primary};
  transition:
    background ${({ theme }) => theme.transitions.fast},
    border-color ${({ theme }) => theme.transitions.fast};

  &:hover {
    border-color: rgba(65, 91, 165, 0.28);
    background: ${({ theme }) => theme.colors.state.infoSoft};
  }

  svg {
    width: 15px;
    height: 15px;
  }
`;

export const EmptyState = styled.div`
  display: grid;
  min-height: 135px;
  place-items: center;
  align-content: center;
  gap: 7px;
  border: 1px dashed ${({ theme }) => theme.colors.border.strong};
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.colors.surface.soft};
  padding: 22px;
  color: ${({ theme }) => theme.colors.text.soft};
  text-align: center;

  svg {
    width: 24px;
    height: 24px;
  }

  strong {
    color: ${({ theme }) => theme.colors.text.body};
    font-size: 11px;
    font-weight: 800;
  }

  p {
    margin: 0;
    font-size: 9px;
    font-weight: 650;
  }
`;

export const LoadingState = styled.div`
  display: grid;
  min-height: 330px;
  place-items: center;
  align-content: center;
  gap: 13px;
  color: ${({ theme }) => theme.colors.text.soft};
  text-align: center;

  svg {
    width: 25px;
    height: 25px;
    color: ${({ theme }) => theme.colors.brand.primary};
    animation: ${spin} 800ms linear infinite;
  }

  strong {
    color: ${({ theme }) => theme.colors.text.body};
    font-size: 11px;
    font-weight: 800;
  }

  span {
    font-size: 9px;
    font-weight: 650;
  }
`;

export const SkeletonGrid = styled.div`
  display: grid;
  width: min(100%, 570px);
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;

  i {
    height: 58px;
    border-radius: ${({ theme }) => theme.radius.md};
    background: linear-gradient(90deg, #f2f4f7 20%, #e8ebf0 50%, #f2f4f7 80%);
    background-size: 200% 100%;
    animation: ${skeleton} 1.3s ease-in-out infinite;
  }
`;

export const ErrorState = styled.div`
  display: grid;
  min-height: 300px;
  place-items: center;
  align-content: center;
  gap: 9px;
  text-align: center;

  > span {
    display: inline-flex;
    width: 48px;
    height: 48px;
    align-items: center;
    justify-content: center;
    border-radius: ${({ theme }) => theme.radius.full};
    background: ${({ theme }) => theme.colors.state.dangerSoft};
    color: ${({ theme }) => theme.colors.state.danger};
  }

  svg {
    width: 21px;
    height: 21px;
  }

  strong {
    color: ${({ theme }) => theme.colors.text.title};
    font-size: 12px;
    font-weight: 850;
  }

  p {
    max-width: 360px;
    margin: 0 0 5px;
    color: ${({ theme }) => theme.colors.text.soft};
    font-size: 10px;
    font-weight: 650;
    line-height: 1.5;
  }
`;

export const FooterActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 9px;
`;
