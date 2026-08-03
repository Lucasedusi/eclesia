"use client";

import { useActionState, useEffect, useId, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Church, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { formatBrazilPhone } from "@/utils/input-masks";
import { createCongregationAction, updateCongregationAction } from "../actions/organization.actions";
import type { CongregationItem, OrganizationOption } from "../types/organization.types";
import { INITIAL_ORGANIZATION_ACTION_STATE } from "../types/organization.types";
import { congregationSchema } from "../validations/organization.schemas";
import * as S from "./organization.styles";

type CongregationFormProps = {
  congregation: CongregationItem | null;
  regions: OrganizationOption[];
  onClose: () => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
};

const steps = ["Identificação", "Liderança e contato", "Endereço", "Revisão"];

export function CongregationForm({
  congregation,
  regions,
  onClose,
  onSuccess,
  onError,
}: CongregationFormProps) {
  const formId = useId();
  const action = congregation ? updateCongregationAction : createCongregationAction;
  const [state, formAction, pending] = useActionState(
    action,
    INITIAL_ORGANIZATION_ACTION_STATE,
  );
  const [currentStep, setCurrentStep] = useState(0);
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});
  const [values, setValues] = useState({
    name: congregation?.name ?? "",
    code: congregation?.code ?? "",
    regionId: congregation?.regionId ?? "",
    displayOrder: String(congregation?.displayOrder ?? 0),
    pastorName: congregation?.pastorName ?? "",
    pastorSpouseName: congregation?.pastorSpouseName ?? "",
    phone: congregation?.phone ?? "",
    whatsapp: congregation?.whatsapp ?? "",
    email: congregation?.email ?? "",
    zipCode: congregation?.zipCode ?? "",
    address: congregation?.address ?? "",
    number: congregation?.number ?? "",
    complement: congregation?.complement ?? "",
    district: congregation?.district ?? "",
    city: congregation?.city ?? "",
    state: congregation?.state ?? "",
    country: congregation?.country ?? "Brasil",
    notes: congregation?.notes ?? "",
    status: congregation?.status ?? "ACTIVE",
  });
  const isHeadquarters = congregation?.isHeadquarters ?? false;

  useEffect(() => {
    if (state.status === "success") onSuccess(state.message);
    if (state.status === "error") onError(state.message);
  }, [onError, onSuccess, state]);

  const errors = useMemo(() => ({
    ...Object.fromEntries(
      Object.entries(state.fieldErrors ?? {}).map(([key, messages]) => [
        key,
        messages[0] ?? "Campo inválido.",
      ]),
    ),
    ...localErrors,
  }), [localErrors, state.fieldErrors]);

  function update(name: keyof typeof values, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
    setLocalErrors((current) => {
      const next = { ...current };
      delete next[name];
      return next;
    });
  }

  function validateCurrentStep() {
    const nextErrors: Record<string, string> = {};

    if (currentStep === 0) {
      if (values.name.trim().length < 2) nextErrors.name = "Informe o nome da Congregação.";
      if (!isHeadquarters && !values.regionId) nextErrors.regionId = "Selecione uma Regional ativa.";
      if (Number(values.displayOrder) < 0 || !Number.isInteger(Number(values.displayOrder))) {
        nextErrors.displayOrder = "Informe uma ordem inteira igual ou maior que zero.";
      }
    }

    if (currentStep === 1) {
      for (const key of ["phone", "whatsapp"] as const) {
        const length = values[key].replace(/\D/g, "").length;
        if (values[key] && length !== 10 && length !== 11) nextErrors[key] = "Informe o telefone com DDD.";
      }
      if (values.email && !/^\S+@\S+\.\S+$/.test(values.email)) nextErrors.email = "Informe um e-mail válido.";
    }

    if (currentStep === 2) {
      if (values.zipCode && values.zipCode.replace(/\D/g, "").length !== 8) nextErrors.zipCode = "Informe um CEP com 8 dígitos.";
      if (values.state && values.state.trim().length !== 2) nextErrors.state = "Use a sigla com 2 letras.";
      if (!values.country.trim()) nextErrors.country = "Informe o país.";
    }

    setLocalErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function nextStep() {
    if (!validateCurrentStep()) return;
    setCurrentStep((step) => Math.min(step + 1, steps.length - 1));
  }

  function formatZipCode(value: string) {
    return value.replace(/\D/g, "").slice(0, 8).replace(/^(\d{5})(\d)/, "$1-$2");
  }

  const hiddenFields = { id: congregation?.id ?? "", ...values };
  const isReviewStep = currentStep === steps.length - 1;

  return (
    <Modal
      open
      title={congregation ? "Editar Congregação" : "Nova Congregação"}
      description={isHeadquarters ? "Atualize os dados institucionais da Congregação Sede." : "Cadastre a identificação, liderança, contato e endereço."}
      icon={<Church size={22} />}
      onClose={onClose}
      busy={pending}
      size="xl"
      footer={
        <S.ModalFooter>
          <Button
            variant="outline"
            onClick={() => setCurrentStep((step) => Math.max(step - 1, 0))}
            disabled={pending || currentStep === 0}
          >
            <ArrowLeft size={16} /> Voltar
          </Button>
          <div>
            <Button variant="outline" onClick={onClose} disabled={pending}>Cancelar</Button>
            {currentStep < steps.length - 1 ? (
              <Button type="button" onClick={nextStep} disabled={pending}>
                Continuar <ArrowRight size={16} />
              </Button>
            ) : (
              <Button type="submit" form={formId} loading={pending}>
                {!pending && <Save size={16} />}
                {pending ? "Salvando..." : "Salvar Congregação"}
              </Button>
            )}
          </div>
        </S.ModalFooter>
      }
    >
      <S.Form
        id={formId}
        action={isReviewStep ? formAction : undefined}
        onSubmit={(event) => {
          if (!isReviewStep) {
            event.preventDefault();
            nextStep();
            return;
          }

          const parsed = congregationSchema.safeParse(hiddenFields);
          const extraError = !isHeadquarters && !values.regionId;
          if (!parsed.success || extraError) {
            event.preventDefault();
            const parsedErrors = parsed.success
              ? {}
              : Object.fromEntries(
                  Object.entries(parsed.error.flatten().fieldErrors).map(([key, messages]) => [
                    key,
                    messages[0] ?? "Campo inválido.",
                  ]),
                );
            setLocalErrors({
              ...parsedErrors,
              ...(extraError ? { regionId: "Selecione uma Regional ativa." } : {}),
            });
            setCurrentStep(0);
          }
        }}
      >
        {Object.entries(hiddenFields).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}

        <S.StepHeader>
          <S.StepProgress>
            {steps.map((step, index) => (
              <S.Step key={step} $active={currentStep === index} $complete={currentStep > index}>
                <span>{currentStep > index ? <Check size={13} /> : index + 1}</span>
                {step}
              </S.Step>
            ))}
          </S.StepProgress>
        </S.StepHeader>

        {state.status === "error" && <S.FormAlert role="alert">{state.message}</S.FormAlert>}

        {currentStep === 0 && (
          <>
            <S.SectionTitle>
              <h3>Identificação e Regional</h3>
              <p>Defina como a Congregação será localizada nas listagens e relatórios.</p>
            </S.SectionTitle>
            {isHeadquarters && (
              <S.FormIntro>
                Esta é a Congregação Sede. Ela deve permanecer ativa, não pode ser excluída e a Regional é opcional.
              </S.FormIntro>
            )}
            <S.FieldGrid>
              <S.Field>
                <span>Nome da Congregação *</span>
                <S.Control
                  data-autofocus
                  value={values.name}
                  onChange={(event) => update("name", event.target.value)}
                  placeholder="Ex.: Congregação Vila Planaltina"
                  maxLength={160}
                  required
                  $invalid={Boolean(errors.name)}
                />
                {errors.name && <S.FieldError>{errors.name}</S.FieldError>}
              </S.Field>
              <S.Field>
                <span>Código interno</span>
                <S.Control
                  value={values.code}
                  onChange={(event) => update("code", event.target.value.toUpperCase())}
                  placeholder="Ex.: VPL"
                  maxLength={30}
                  $invalid={Boolean(errors.code)}
                />
                {errors.code && <S.FieldError>{errors.code}</S.FieldError>}
              </S.Field>
              <S.Field>
                <span>{isHeadquarters ? "Regional (opcional para a Sede)" : "Regional *"}</span>
                <S.SelectControl
                  value={values.regionId}
                  onChange={(event) => update("regionId", event.target.value)}
                  required={!isHeadquarters}
                  $invalid={Boolean(errors.regionId)}
                >
                  <option value="">{isHeadquarters ? "Sem Regional" : "Selecione uma Regional"}</option>
                  {regions.map((region) => <option key={region.id} value={region.id}>{region.name}</option>)}
                </S.SelectControl>
                {errors.regionId && <S.FieldError>{errors.regionId}</S.FieldError>}
              </S.Field>
              <S.Field>
                <span>Ordem de exibição</span>
                <S.Control
                  value={values.displayOrder}
                  onChange={(event) => update("displayOrder", event.target.value)}
                  type="number"
                  min={0}
                  step={1}
                  $invalid={Boolean(errors.displayOrder)}
                />
                {errors.displayOrder && <S.FieldError>{errors.displayOrder}</S.FieldError>}
              </S.Field>
              <S.Field $span={2}>
                <span>Status</span>
                <S.SelectControl
                  value={values.status}
                  onChange={(event) => update("status", event.target.value)}
                  disabled={isHeadquarters}
                >
                  <option value="ACTIVE">Ativa</option>
                  <option value="INACTIVE">Inativa</option>
                </S.SelectControl>
                {isHeadquarters && <small>A Sede deve permanecer ativa.</small>}
              </S.Field>
            </S.FieldGrid>
          </>
        )}

        {currentStep === 1 && (
          <>
            <S.SectionTitle>
              <h3>Liderança e contato</h3>
              <p>Registre os responsáveis e os principais canais de atendimento.</p>
            </S.SectionTitle>
            <S.FieldGrid>
              <S.Field>
                <span>Pastor/Dirigente</span>
                <S.Control value={values.pastorName} onChange={(event) => update("pastorName", event.target.value)} placeholder="Nome completo" maxLength={160} />
              </S.Field>
              <S.Field>
                <span>Nome do cônjuge</span>
                <S.Control value={values.pastorSpouseName} onChange={(event) => update("pastorSpouseName", event.target.value)} placeholder="Nome completo" maxLength={160} />
              </S.Field>
              <S.Field>
                <span>Telefone</span>
                <S.Control value={values.phone} onChange={(event) => update("phone", formatBrazilPhone(event.target.value))} placeholder="(00) 00000-0000" inputMode="tel" maxLength={15} $invalid={Boolean(errors.phone)} />
                {errors.phone && <S.FieldError>{errors.phone}</S.FieldError>}
              </S.Field>
              <S.Field>
                <span>WhatsApp</span>
                <S.Control value={values.whatsapp} onChange={(event) => update("whatsapp", formatBrazilPhone(event.target.value))} placeholder="(00) 00000-0000" inputMode="tel" maxLength={15} $invalid={Boolean(errors.whatsapp)} />
                {errors.whatsapp && <S.FieldError>{errors.whatsapp}</S.FieldError>}
              </S.Field>
              <S.Field $span={2}>
                <span>E-mail</span>
                <S.Control value={values.email} onChange={(event) => update("email", event.target.value.toLowerCase())} placeholder="congregacao@igreja.com.br" type="email" maxLength={160} $invalid={Boolean(errors.email)} />
                {errors.email && <S.FieldError>{errors.email}</S.FieldError>}
              </S.Field>
            </S.FieldGrid>
          </>
        )}

        {currentStep === 2 && (
          <>
            <S.SectionTitle>
              <h3>Endereço</h3>
              <p>O preenchimento é opcional, mas facilita buscas e relatórios futuros.</p>
            </S.SectionTitle>
            <S.FieldGrid>
              <S.Field>
                <span>CEP</span>
                <S.Control value={values.zipCode} onChange={(event) => update("zipCode", formatZipCode(event.target.value))} placeholder="00000-000" inputMode="numeric" maxLength={9} $invalid={Boolean(errors.zipCode)} />
                {errors.zipCode && <S.FieldError>{errors.zipCode}</S.FieldError>}
              </S.Field>
              <S.Field>
                <span>Logradouro</span>
                <S.Control value={values.address} onChange={(event) => update("address", event.target.value)} placeholder="Rua, avenida ou praça" maxLength={180} />
              </S.Field>
              <S.Field>
                <span>Número</span>
                <S.Control value={values.number} onChange={(event) => update("number", event.target.value)} placeholder="Número ou s/n" maxLength={20} />
              </S.Field>
              <S.Field>
                <span>Complemento</span>
                <S.Control value={values.complement} onChange={(event) => update("complement", event.target.value)} placeholder="Bloco, sala ou referência" maxLength={100} />
              </S.Field>
              <S.Field>
                <span>Bairro</span>
                <S.Control value={values.district} onChange={(event) => update("district", event.target.value)} placeholder="Bairro" maxLength={100} />
              </S.Field>
              <S.Field>
                <span>Cidade</span>
                <S.Control value={values.city} onChange={(event) => update("city", event.target.value)} placeholder="Cidade" maxLength={100} />
              </S.Field>
              <S.Field>
                <span>Estado</span>
                <S.Control value={values.state} onChange={(event) => update("state", event.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2))} placeholder="GO" maxLength={2} $invalid={Boolean(errors.state)} />
                {errors.state && <S.FieldError>{errors.state}</S.FieldError>}
              </S.Field>
              <S.Field>
                <span>País *</span>
                <S.Control value={values.country} onChange={(event) => update("country", event.target.value)} placeholder="Brasil" maxLength={80} required $invalid={Boolean(errors.country)} />
                {errors.country && <S.FieldError>{errors.country}</S.FieldError>}
              </S.Field>
              <S.Field $span={2}>
                <span>Observações administrativas</span>
                <S.Textarea value={values.notes} onChange={(event) => update("notes", event.target.value)} placeholder="Informações administrativas não sensíveis" maxLength={1000} />
              </S.Field>
            </S.FieldGrid>
          </>
        )}

        {currentStep === 3 && (
          <>
            <S.SectionTitle>
              <h3>Revisão e conclusão</h3>
              <p>Confira as informações antes de salvar a Congregação.</p>
            </S.SectionTitle>
            <S.ReviewGrid>
              <S.ReviewCard><strong>Identificação</strong><p>{values.name}<br />{values.code || "Sem código interno"}</p></S.ReviewCard>
              <S.ReviewCard><strong>Regional e situação</strong><p>{regions.find((region) => region.id === values.regionId)?.name ?? "Sem Regional"}<br />{values.status === "ACTIVE" ? "Ativa" : "Inativa"}</p></S.ReviewCard>
              <S.ReviewCard><strong>Liderança</strong><p>{values.pastorName || "Não informada"}<br />{values.phone || values.whatsapp || "Sem telefone"}</p></S.ReviewCard>
              <S.ReviewCard><strong>Localização</strong><p>{values.address ? `${values.address}, ${values.number || "s/n"}` : "Endereço não informado"}<br />{values.city ? `${values.city}${values.state ? ` — ${values.state}` : ""}` : values.country}</p></S.ReviewCard>
            </S.ReviewGrid>
          </>
        )}
      </S.Form>
    </Modal>
  );
}
