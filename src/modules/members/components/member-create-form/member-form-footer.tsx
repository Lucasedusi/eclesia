"use client";

import { ArrowLeft, ArrowRight, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import * as S from "./member-create-form.styles";

type MemberFormFooterProps = {
  isFirstStep: boolean;
  isLastStep: boolean;
  onBack: () => void;
  onNext: () => void;
  saving?: boolean;
};

export function MemberFormFooter({
  isFirstStep,
  isLastStep,
  onBack,
  onNext,
  saving = false,
}: MemberFormFooterProps) {
  return (
    <S.FormFooter>
      <S.FooterHint>
        {saving
          ? "Aguarde enquanto o cadastro é salvo."
          : isLastStep
            ? "Revise as informações antes de finalizar."
            : "Os campos obrigatórios desta etapa precisam ser preenchidos para avançar."}
      </S.FooterHint>

      <S.FooterActions>
        {!isFirstStep && (
          <Button
            type="button"
            variant="secondary"
            onClick={onBack}
            disabled={saving}
          >
            <ArrowLeft aria-hidden="true" />
            Voltar
          </Button>
        )}

        <Button type="button" onClick={onNext} loading={saving}>
          {isLastStep ? (
            <>
              <Save aria-hidden="true" />
              {saving ? "Salvando..." : "Salvar cadastro"}
            </>
          ) : (
            <>
              Próximo
              <ArrowRight aria-hidden="true" />
            </>
          )}
        </Button>
      </S.FooterActions>
    </S.FormFooter>
  );
}
