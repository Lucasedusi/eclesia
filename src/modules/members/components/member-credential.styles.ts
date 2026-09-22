"use client";

import styled from "styled-components";

export const Content = styled.div`
  display: grid;
  gap: 16px;
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

export const Feedback = styled.div`
  border: 1px solid #b9d6c5;
  border-radius: 8px;
  background: #f1fbf5;
  padding: 12px 14px;
  color: #245c3d;
  font-size: calc(10px + var(--eclesia-font-size-adjustment, 0px));
  font-weight: 600;
`;

export const PreviewStage = styled.div`
  display: grid;
  justify-items: center;
  gap: 12px;
  padding: 6px;
`;

export const SkeletonCard = styled.div`
  width: 100%;
  max-width: 592px;
  aspect-ratio: 85.6 / 53.98;
  overflow: hidden;
  border-radius: clamp(12px, 2.4vw, 24px);
  background: #fbf8f0;
  box-shadow: rgba(99, 99, 99, 0.2) 0 2px 8px;

  .credential-skeleton-header {
    display: flex;
    height: 29%;
    align-items: center;
    gap: 4%;
    background: #082a5b;
    padding: 4% 5%;
  }

  .credential-skeleton-logo {
    width: 16%;
    flex: 0 0 16%;
    aspect-ratio: 1;
    border-radius: 50%;
    background: #dce5f1;
  }

  .credential-skeleton-church {
    display: grid;
    width: 72%;
    gap: clamp(4px, 1vw, 9px);
  }

  .credential-skeleton-church span {
    height: clamp(5px, 1vw, 10px);
    background: #b7c5dc;
  }

  .credential-skeleton-church span:nth-child(2) { width: 82%; }
  .credential-skeleton-church span:nth-child(3) { width: 62%; }

  .credential-skeleton-gold {
    height: 3%;
    background: linear-gradient(90deg, #d4a72c, #f0d26f, #d4a72c);
  }

  .credential-skeleton-body {
    display: grid;
    height: 68%;
    grid-template-columns: 28% minmax(0, 1fr);
    align-items: center;
    gap: 5%;
    padding: 6% 7%;
  }

  .credential-skeleton-qr {
    width: 100%;
    aspect-ratio: 1;
    border: 5px solid #e9edf3;
    border-radius: 8px;
  }

  .credential-skeleton-fields {
    display: grid;
    align-content: center;
    gap: clamp(4px, 1vw, 9px);
  }

  .credential-skeleton-fields .app-skeleton-block {
    height: clamp(5px, 1.2vw, 12px);
  }

  .credential-skeleton-name { width: 94%; }
  .credential-skeleton-role { width: 53%; }
  .credential-skeleton-label { width: 40%; }
  .credential-skeleton-value { width: 73%; }

  .credential-skeleton-rule {
    height: 1px;
    margin: 2px 0;
    background: #e8d5a9;
  }
`;

export const SkeletonHint = styled.span`
  width: 135px;
  height: 12px;
`;

export const FlipCard = styled.span<{ $flipped: boolean }>`
  position: relative;
  display: block;
  width: 100%;
  height: 100%;
  transform: ${({ $flipped }) =>
    $flipped ? "rotateY(180deg)" : "rotateY(0deg)"};
  transform-style: preserve-3d;
  transition: transform 550ms cubic-bezier(0.22, 1, 0.36, 1);
  will-change: transform;

  @media (prefers-reduced-motion: reduce) {
    transition-duration: 1ms;
  }
`;

export const FlipButton = styled.button`
  display: block;
  width: 100%;
  max-width: 592px;
  aspect-ratio: 85.6 / 53.98;
  border: 0;
  border-radius: clamp(12px, 2.4vw, 24px);
  outline: 3px solid transparent;
  outline-offset: 5px;
  background: transparent;
  padding: 0;
  perspective: 1600px;
  cursor: pointer;
  transition:
    transform 180ms ease,
    outline-color 180ms ease;

  &:hover {
    transform: translateY(-2px);
  }

  &:focus-visible {
    outline-color: #415ba5;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
    &:hover {
      transform: none;
    }
  }
`;

export const CardFace = styled.span<{ $back?: boolean }>`
  position: absolute;
  inset: 0;
  display: block;
  overflow: hidden;
  border-radius: clamp(12px, 2.4vw, 24px);
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  transform: ${({ $back }) => ($back ? "rotateY(180deg)" : "rotateY(0deg)")};
  box-shadow: rgba(99, 99, 99, 0.2) 0px 2px 8px 0px;
  line-height: 0;

  svg {
    display: block;
    width: 100%;
    height: 100%;
  }
`;

export const FlipHint = styled.p`
  display: inline-flex;
  align-items: center;
  gap: 7px;
  margin: 0;
  color: #667085;
  font-size: calc(10px + var(--eclesia-font-size-adjustment, 0px));
  font-weight: 500;

  svg {
    width: 14px;
    height: 14px;
    color: #415ba5;
    stroke-width: 1.8;
  }
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
    font-weight: 600;
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
  width: 100%;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  button:first-child:last-of-type {
    margin-left: auto;
  }
  @media (max-width: 620px) {
    flex-direction: column-reverse;
    button,
    a {
      width: 100%;
      justify-content: center;
    }
  }
`;
