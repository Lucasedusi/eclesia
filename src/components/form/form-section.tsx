"use client";

import { ReactNode } from "react";
import * as S from "./form-section.styles";

type FormSectionProps = {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  darkHeader?: boolean;
};

export function FormSection({
  title,
  description,
  children,
  className,
  darkHeader = false,
}: FormSectionProps) {
  return (
    <S.FormSectionRoot className={className}>
      <S.FormSectionHeader $dark={darkHeader}>
        <S.FormSectionTitle $dark={darkHeader}>{title}</S.FormSectionTitle>

        {description && (
          <S.FormSectionDescription $dark={darkHeader}>
            {description}
          </S.FormSectionDescription>
        )}
      </S.FormSectionHeader>

      <S.FormSectionBody>{children}</S.FormSectionBody>
    </S.FormSectionRoot>
  );
}

type FormContainerProps = {
  title: string;
  description?: string;
  step?: number;
  totalSteps?: number;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
};

export function FormContainer({
  title,
  description,
  step,
  totalSteps,
  children,
  footer,
  className,
}: FormContainerProps) {
  const progress = step && totalSteps ? Math.min((step / totalSteps) * 100, 100) : 0;
  const hasProgress = Boolean(step && totalSteps);

  return (
    <S.FormContainerRoot className={className}>
      <S.FormContainerHeader>
        <div>
          <S.FormContainerTitle>{title}</S.FormContainerTitle>
          {description && (
            <S.FormContainerDescription>{description}</S.FormContainerDescription>
          )}
        </div>

        {hasProgress && (
          <S.StepText>
            <span>Step {step}</span> of {totalSteps}
          </S.StepText>
        )}
      </S.FormContainerHeader>

      {hasProgress && (
        <S.ProgressTrack>
          <S.ProgressBar $progress={progress} />
        </S.ProgressTrack>
      )}

      <S.FormContainerBody>{children}</S.FormContainerBody>

      {footer && <S.FormContainerFooter>{footer}</S.FormContainerFooter>}
    </S.FormContainerRoot>
  );
}
