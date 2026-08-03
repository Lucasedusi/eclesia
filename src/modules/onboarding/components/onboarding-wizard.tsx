"use client";

import { startTransition, useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Church, ShieldCheck } from "lucide-react";
import { INITIAL_ACTION_STATE } from "@/modules/auth/types/auth.types";
import { formatBrazilPhone, formatCnpj } from "@/utils/input-masks";
import { completeOnboardingAction } from "../actions/onboarding.actions";
import * as S from "./onboarding-wizard.styles";

const steps = [
  { title: "Igreja", text: "Identificação institucional" },
  { title: "Endereço", text: "Localização principal" },
  { title: "Sede", text: "Liderança e congregação" },
  { title: "Preferências", text: "Configuração inicial" },
  { title: "Revisão", text: "Confirmação dos dados" },
] as const;

const initialValues: Record<string, string> = {
  church_name: "", legal_name: "", document: "", church_email: "", phone: "", whatsapp: "",
  zip_code: "", address: "", number: "", complement: "", district: "", city: "", state: "", country: "Brasil",
  senior_pastor_name: "", senior_pastor_spouse_name: "", headquarters_name: "Congregação Sede",
  headquarters_code: "SEDE", headquarters_pastor_name: "", headquarters_pastor_spouse_name: "",
  app_name: "Eclesias", display_church_name: "", member_code_prefix: "MEM",
  member_code_next_number: "1", member_code_padding: "4",
};

const stepRequiredFields: Record<number, string[]> = {
  0: ["church_name"],
  1: ["address", "district", "city", "state"],
  2: ["senior_pastor_name", "headquarters_name"],
  3: ["display_church_name", "app_name", "member_code_prefix", "member_code_next_number", "member_code_padding"],
};

export function OnboardingWizard({ administratorName }: { administratorName: string }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [values, setValues] = useState(initialValues);
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});
  const [state, action, pending] = useActionState(completeOnboardingAction, INITIAL_ACTION_STATE);
  const router = useRouter();
  const isReviewStep = currentStep === steps.length - 1;

  useEffect(() => {
    if (state.status === "success" && state.redirectTo) {
      router.replace(state.redirectTo);
      router.refresh();
    }
  }, [router, state]);

  const errors = useMemo(() => {
    const serverErrors = Object.fromEntries(
      Object.entries(state.fieldErrors ?? {}).map(([key, messages]) => [key, messages[0] ?? "Campo inválido."]),
    );
    return { ...serverErrors, ...localErrors };
  }, [localErrors, state.fieldErrors]);

  function updateValue(event: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target;
    const maskedValue =
      name === "document"
        ? formatCnpj(value)
        : name === "phone" || name === "whatsapp"
          ? formatBrazilPhone(value)
          : value;
    setValues((current) => ({
      ...current,
      [name]: name === "state" || name === "headquarters_code" || name === "member_code_prefix" ? maskedValue.toUpperCase() : maskedValue,
      ...(name === "church_name" && !current.display_church_name ? { display_church_name: maskedValue } : {}),
    }));
    setLocalErrors((current) => {
      const next = { ...current };
      delete next[name];
      return next;
    });
  }

  function goNext() {
    const nextErrors: Record<string, string> = {};
    for (const field of stepRequiredFields[currentStep] ?? []) {
      if (!values[field]?.trim()) nextErrors[field] = "Este campo é obrigatório.";
    }
    if (currentStep === 1 && values.state.trim().length !== 2) nextErrors.state = "Use a sigla com 2 letras.";
    if (Object.keys(nextErrors).length) {
      setLocalErrors(nextErrors);
      return;
    }
    setLocalErrors({});
    setCurrentStep((step) => Math.min(step + 1, steps.length - 1));
  }

  function completeOnboarding() {
    if (!isReviewStep || pending) return;

    const formData = new FormData();
    Object.entries(values).forEach(([name, value]) => {
      formData.set(name, value);
    });

    startTransition(() => {
      action(formData);
    });
  }

  const field = (name: string, label: string, placeholder = "", extra?: React.InputHTMLAttributes<HTMLInputElement>) => (
    <S.Field>
      <span>{label}</span>
      <S.Input name={name} value={values[name]} onChange={updateValue} placeholder={placeholder} $invalid={Boolean(errors[name])} {...extra} />
      {errors[name] ? <S.FieldError>{errors[name]}</S.FieldError> : null}
    </S.Field>
  );

  return (
    <S.Page>
      <S.Shell>
        <S.Aside>
          <S.Brand><S.BrandMark><Church size={23} /></S.BrandMark><strong>Eclesias</strong></S.Brand>
          <S.AsideTitle>Vamos preparar o ambiente da sua igreja.</S.AsideTitle>
          <S.AsideText>São apenas cinco etapas. Ao concluir, você será o primeiro Administrador e poderá convidar a equipe da secretaria.</S.AsideText>
          <S.Steps>
            {steps.map((step, index) => (
              <S.Step key={step.title} $active={index === currentStep} $complete={index < currentStep}>
                <span>{index < currentStep ? <Check size={16} /> : index + 1}</span>
                <div><strong>{step.title}</strong><small>{step.text}</small></div>
              </S.Step>
            ))}
          </S.Steps>
        </S.Aside>

        <S.Content>
          <S.Top>
            <S.Counter>Etapa {currentStep + 1} de {steps.length}</S.Counter>
            <S.Progress><span style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }} /></S.Progress>
          </S.Top>

          <form
            onSubmit={(event) => {
              event.preventDefault();
            }}
          >
            {Object.entries(values).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
            {state.status === "error" ? <S.Alert>{state.message}</S.Alert> : null}

            <S.Stage key={currentStep}>
              {currentStep === 0 ? <>
                <S.Eyebrow>Identificação institucional</S.Eyebrow><S.Title>Conte-nos sobre sua igreja</S.Title>
                <S.Description>Use o nome pelo qual o campo ou a igreja é conhecido. Os dados jurídicos são opcionais.</S.Description>
                <S.Grid>{field("church_name", "Nome da igreja ou campo *", "Ex.: Assembleia de Deus — Campo de Porangatu")}{field("legal_name", "Razão social", "Nome jurídico, se houver")}{field("document", "CNPJ ou documento institucional", "00.000.000/0000-00", { inputMode: "numeric", maxLength: 18 })}{field("church_email", "E-mail institucional", "secretaria@igreja.com.br", { type: "email" })}{field("phone", "Telefone", "(00) 0000-0000", { inputMode: "tel", maxLength: 15 })}{field("whatsapp", "WhatsApp", "(00) 00000-0000", { inputMode: "tel", maxLength: 15 })}</S.Grid>
              </> : null}
              {currentStep === 1 ? <>
                <S.Eyebrow>Endereço principal</S.Eyebrow><S.Title>Onde está localizada a Sede?</S.Title>
                <S.Description>Este endereço será usado como padrão nos cadastros e poderá ser alterado nas configurações.</S.Description>
                <S.Grid>{field("zip_code", "CEP", "00000-000")}{field("address", "Endereço *", "Avenida, rua ou praça")}{field("number", "Número", "Nº")}{field("complement", "Complemento", "Sala, bloco ou referência")}{field("district", "Bairro *", "Bairro")}{field("city", "Cidade *", "Cidade")}{field("state", "Estado *", "GO", { maxLength: 2 })}{field("country", "País *", "Brasil")}</S.Grid>
              </> : null}
              {currentStep === 2 ? <>
                <S.Eyebrow>Liderança e Congregação Sede</S.Eyebrow><S.Title>Defina a estrutura principal</S.Title>
                <S.Description>A Sede será criada como a congregação principal. O contato e o endereço serão herdados da igreja.</S.Description>
                <S.Grid>{field("senior_pastor_name", "Pastor Presidente *", "Nome completo")}{field("senior_pastor_spouse_name", "Cônjuge do Pastor Presidente", "Nome completo")}{field("headquarters_name", "Nome da Congregação Sede *", "Congregação Sede")}{field("headquarters_code", "Código interno da Sede *", "SEDE", { maxLength: 20 })}{field("headquarters_pastor_name", "Dirigente da Sede", "Deixe vazio para usar o Pastor Presidente")}{field("headquarters_pastor_spouse_name", "Cônjuge do dirigente", "Nome completo")}</S.Grid>
              </> : null}
              {currentStep === 3 ? <>
                <S.Eyebrow>Preferências iniciais</S.Eyebrow><S.Title>Personalize os primeiros detalhes</S.Title>
                <S.Description>Essas definições controlam o nome exibido e a sequência automática dos códigos de membros.</S.Description>
                <S.Grid>{field("display_church_name", "Nome de exibição *", "Nome curto da igreja")}{field("app_name", "Nome do sistema *", "Eclesias")}{field("member_code_prefix", "Prefixo do código de membros *", "MEM", { maxLength: 8 })}{field("member_code_next_number", "Número inicial *", "1", { type: "number", min: 1 })}{field("member_code_padding", "Quantidade de dígitos *", "4", { type: "number", min: 1, max: 10 })}</S.Grid>
              </> : null}
              {currentStep === 4 ? <>
                <S.Eyebrow>Revisão e conclusão</S.Eyebrow><S.Title>Confira antes de começar</S.Title>
                <S.Description>A operação será concluída de forma segura e atômica. Se algo falhar, nenhum cadastro incompleto será mantido.</S.Description>
                <S.Review>
                  <S.ReviewCard><strong>Igreja</strong><p>{values.church_name}<br />{values.church_email || "Sem e-mail institucional"}</p></S.ReviewCard>
                  <S.ReviewCard><strong>Localização</strong><p>{values.address}, {values.number || "s/n"}<br />{values.city} — {values.state}</p></S.ReviewCard>
                  <S.ReviewCard><strong>Congregação Sede</strong><p>{values.headquarters_name} ({values.headquarters_code})<br />Pastor Presidente: {values.senior_pastor_name}</p></S.ReviewCard>
                  <S.ReviewCard><strong>Primeiro Administrador</strong><p>{administratorName}<br />Acesso a toda a igreja</p></S.ReviewCard>
                  <S.ReviewCard><strong>Código de membros</strong><p>{values.member_code_prefix}{String(Number(values.member_code_next_number) || 1).padStart(Number(values.member_code_padding) || 4, "0")}<br />Numeração automática ativada</p></S.ReviewCard>
                  <S.ReviewCard><strong>Segurança</strong><p>Rotas privadas, permissões, RLS e auditoria serão ativadas para esta igreja.</p></S.ReviewCard>
                </S.Review>
              </> : null}
            </S.Stage>

            <S.Footer>
              <S.Button type="button" $secondary disabled={currentStep === 0 || pending} onClick={() => setCurrentStep((step) => Math.max(step - 1, 0))}><ArrowLeft size={17} /> Voltar</S.Button>
              {currentStep < steps.length - 1 ? <S.Button key="continue" type="button" onClick={goNext}>Continuar <ArrowRight size={17} /></S.Button> : <S.Button key="complete" type="button" onClick={completeOnboarding} disabled={pending}>{pending ? <S.Spinner /> : <ShieldCheck size={17} />}{pending ? "Configurando..." : "Concluir configuração"}</S.Button>}
            </S.Footer>
          </form>
        </S.Content>
      </S.Shell>
    </S.Page>
  );
}
