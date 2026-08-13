"use client";

import {
  BookOpen,
  CheckCircle,
  Church,
  LucideIcon,
  MapPin,
  User,
  Users,
} from "lucide-react";
import type {
  MemberFormStep,
  MemberFormStepId,
} from "../../types/member-form.types";
import * as S from "./member-form-progress.styles";

const stepIcons: Record<MemberFormStepId, LucideIcon> = {
  personal: User,
  contact: MapPin,
  family: Users,
  bond: Church,
  ecclesiastical: BookOpen,
  review: CheckCircle,
};

type MemberFormProgressProps = {
  steps: MemberFormStep[];
  currentStepIndex: number;
  onStepChange: (stepIndex: number) => void;
};

export function MemberFormProgress({
  steps,
  currentStepIndex,
  onStepChange,
}: MemberFormProgressProps) {
  const currentStep = steps[currentStepIndex];
  const progress = Math.round(((currentStepIndex + 1) / steps.length) * 100);

  return (
    <S.ProgressRoot>
      <S.ProgressSummary>
        <div>
          <S.ProgressLabel>
            Etapa {currentStepIndex + 1} de {steps.length}
          </S.ProgressLabel>
          <S.ProgressTitle>{currentStep.title}</S.ProgressTitle>
        </div>

        <S.ProgressPercent>{progress}%</S.ProgressPercent>
      </S.ProgressSummary>

      <S.ProgressTrack aria-hidden="true">
        <S.ProgressBar $progress={progress} />
      </S.ProgressTrack>

      <S.StepList aria-label="Etapas do formulário de membros">
        {steps.map((step, index) => {
          const Icon = stepIcons[step.id];
          const isActive = index === currentStepIndex;
          const isCompleted = index < currentStepIndex;

          return (
            <S.StepItem key={step.id}>
              <S.StepButton
                type="button"
                $active={isActive}
                $completed={isCompleted}
                title={`Ir para ${step.title}`}
                aria-current={isActive ? "step" : undefined}
                onClick={() => onStepChange(index)}
              >
                <S.StepIcon $active={isActive} $completed={isCompleted}>
                  <Icon aria-hidden="true" />
                </S.StepIcon>

                <S.StepContent>
                  <S.StepTitle>{step.title}</S.StepTitle>
                  <S.StepDescription>{step.description}</S.StepDescription>
                </S.StepContent>
              </S.StepButton>
            </S.StepItem>
          );
        })}
      </S.StepList>
    </S.ProgressRoot>
  );
}
