"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, Save } from "lucide-react";
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
  const footer = useRef<HTMLElement>(null);
  const [belowViewport, setBelowViewport] = useState(false);
  useEffect(() => {
    const target = footer.current?.querySelector<HTMLButtonElement>("[data-step-action]");
    if (!target) return;
    const observer = new IntersectionObserver(([entry]) => {
      setBelowViewport(!entry.isIntersecting && entry.boundingClientRect.top > 0);
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  return (
    <S.FormFooter ref={footer}>
      {belowViewport && <S.JumpToFooter type="button" aria-label="Ir para o fim da etapa" title="Ir para o fim da etapa"
        onClick={() => {
          footer.current?.scrollIntoView({ block: "end", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
          footer.current?.querySelector<HTMLButtonElement>("[data-step-action]")?.focus({ preventScroll: true });
        }}>
        <ArrowDown size={20} aria-hidden />
      </S.JumpToFooter>}
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

        <Button type="button" data-step-action onClick={onNext} loading={saving}>
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
