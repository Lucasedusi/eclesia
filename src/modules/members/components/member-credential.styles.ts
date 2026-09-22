"use client";

import styled from "styled-components";

export const Content = styled.div`
  display: grid;
  gap: 16px;
`;

export const Loading = styled.div`
  display: grid;
  min-height: 280px;
  place-items: center;
  color: #415ba5;
  svg { animation: credential-spin 800ms linear infinite; }
  @keyframes credential-spin { to { transform: rotate(360deg); } }
`;

export const ErrorNotice = styled.div`
  border: 1px solid #f2cbc8;
  border-radius: 8px;
  background: #fff5f4;
  padding: 13px 14px;
  color: #8f302c;
  font-size: calc(10px + var(--eclesia-font-size-adjustment, 0px));
  font-weight: 600;
  line-height: 1.5;
`;

export const PreviewGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
  @media (max-width: 760px) { grid-template-columns: 1fr; }
`;

export const FaceGroup = styled.section`
  display: grid;
  gap: 7px;
  > h3 {
    margin: 0;
    color: #475467;
    font-size: calc(9px + var(--eclesia-font-size-adjustment, 0px));
    font-weight: 700;
    letter-spacing: .04em;
    text-transform: uppercase;
  }
`;

export const Card = styled.article`
  position: relative;
  display: grid;
  aspect-ratio: 85.6 / 53.98;
  overflow: hidden;
  border: 1px solid rgba(16, 24, 40, .12);
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 14px 32px rgba(16, 24, 40, .13);
  color: #101828;
  isolation: isolate;
  &:after {
    position: absolute;
    right: -11%;
    bottom: -20%;
    z-index: -1;
    width: 44%;
    aspect-ratio: 1;
    border-radius: 50%;
    background: var(--credential-primary);
    content: "";
    opacity: .07;
  }
`;

export const Header = styled.header`
  display: flex;
  min-height: 23%;
  align-items: center;
  background: var(--credential-dark);
  padding: 0 5.2%;
  color: var(--credential-foreground);
  font-size: clamp(10px, 1.32vw, 16px);
  font-weight: 800;
  letter-spacing: .015em;
  line-height: 1.15;
  text-transform: uppercase;
  span {
    display: -webkit-box;
    overflow: hidden;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  }
`;

export const FrontBody = styled.div`
  display: grid;
  min-height: 0;
  grid-template-columns: minmax(0, 67fr) minmax(70px, 25fr);
  justify-content: space-between;
  gap: 6%;
  padding: 5% 5.2% 4.5%;
`;

export const Identity = styled.div`
  display: grid;
  min-width: 0;
  align-content: start;
  gap: 3.5%;
`;

export const MemberName = styled.strong`
  display: -webkit-box;
  overflow: hidden;
  color: #101828;
  font-size: clamp(15px, 2.05vw, 25px);
  font-weight: 800;
  line-height: 1.03;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow-wrap: anywhere;
`;

export const Role = styled.p`
  overflow: hidden;
  margin: 0;
  color: #344054;
  font-size: clamp(9px, 1.15vw, 14px);
  font-weight: 700;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export const CompactFields = styled.dl`
  display: grid;
  grid-template-columns: minmax(0, .7fr) minmax(0, 1.3fr);
  gap: 6%;
  margin: auto 0 0;
`;

export const Field = styled.div`
  min-width: 0;
  dt {
    color: #667085;
    font-size: clamp(6px, .72vw, 9px);
    font-weight: 800;
    letter-spacing: .045em;
    text-transform: uppercase;
  }
  dd {
    overflow: hidden;
    margin: 2px 0 0;
    color: #101828;
    font-size: clamp(8px, 1vw, 12px);
    font-weight: 700;
    line-height: 1.15;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

export const QrArea = styled.div`
  display: grid;
  min-width: 0;
  align-content: end;
  gap: 6px;
  small {
    color: #475467;
    font-size: clamp(5px, .59vw, 7px);
    font-weight: 800;
    letter-spacing: .02em;
    text-align: center;
    white-space: nowrap;
  }
`;

export const QrGrid = styled.div`
  display: grid;
  width: 100%;
  max-width: 112px;
  aspect-ratio: 1;
  grid-template-columns: repeat(21, 1fr);
  overflow: hidden;
  border: 3px solid #fff;
  outline: 1px solid #d0d5dd;
  background: #fff;
`;

export const QrCell = styled.span<{ $filled: boolean }>`
  background: ${({ $filled }) => ($filled ? "#101828" : "#fff")};
`;

export const BackBody = styled.dl`
  display: grid;
  min-height: 0;
  align-content: stretch;
  gap: 0;
  margin: 0;
  padding: 2.5% 5.2% 6%;
  > div {
    display: grid;
    align-content: center;
    border-bottom: 1px solid #e4e7ec;
  }
  > div:last-of-type { border-bottom: 0; }
  dt {
    color: #667085;
    font-size: clamp(6px, .72vw, 9px);
    font-weight: 800;
    letter-spacing: .045em;
    text-transform: uppercase;
  }
  dd {
    overflow: hidden;
    margin: 2px 0 0;
    color: #101828;
    font-size: clamp(9px, 1.15vw, 14px);
    font-weight: 700;
    line-height: 1.2;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

export const Footnote = styled.p`
  position: absolute;
  bottom: 3.5%;
  left: 5.2%;
  margin: 0;
  color: #667085;
  font-size: clamp(5px, .62vw, 8px);
  font-weight: 600;
`;

export const Warnings = styled.div`
  display: grid;
  gap: 7px;
  border: 1px solid #f2d9a7;
  border-radius: 8px;
  background: #fffaeb;
  padding: 12px 14px;
  color: #7a4b12;
  h3 {
    margin: 0;
    font-size: calc(10px + var(--eclesia-font-size-adjustment, 0px));
  }
  ul {
    display: grid;
    gap: 3px;
    margin: 0;
    padding-left: 18px;
    font-size: calc(9px + var(--eclesia-font-size-adjustment, 0px));
    line-height: 1.45;
  }
`;

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
