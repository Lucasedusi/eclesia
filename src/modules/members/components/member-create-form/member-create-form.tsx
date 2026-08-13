"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, Info, Loader2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Toast, ToastViewport } from "@/components/ui/toast";
import { useNavigationFeedback } from "@/components/navigation/navigation-feedback";
import { formatBrazilPhone, formatCpf, isValidCpf } from "@/utils/input-masks";
import { checkMemberCpfAvailabilityAction, createMemberAction, updateMemberAction } from "../../actions/member-form.actions";
import {
  brazilianStateOptions,
  educationLevelOptions,
  genderOptions,
  initialMemberFormData,
  maritalStatusOptions,
  memberFormSteps,
  memberTypeOptions,
  receivedByOptions,
} from "../../constants/member-form-options";
import type {
  MemberFormData,
  MemberFormErrors,
  MemberFormInitialData,
  MemberFormMode,
  MemberFormOptions,
} from "../../types/member-form.types";
import {
  validateAllMemberFormSteps,
  validateMemberFormStep,
} from "../../utils/member-form-validation";
import { formatDateOnly } from "../../utils/member-formatters";
import { MemberFormFooter } from "./member-form-footer";
import { MemberFormProgress } from "./member-form-progress";
import * as S from "./member-create-form.styles";

type Props = {
  options: MemberFormOptions;
  mode?: MemberFormMode;
  initialData?: MemberFormInitialData;
};

type Notice = { title: string; description: string; variant: "success" | "danger" | "warning" };

function digits(value: string) {
  return value.replace(/\D/g, "");
}

function formatCep(value: string) {
  const clean = digits(value).slice(0, 8);
  return clean.length > 5 ? `${clean.slice(0, 5)}-${clean.slice(5)}` : clean;
}

function ReviewItem({ label, value }: { label: string; value?: string }) {
  return (
    <S.ReviewItem>
      <span>{label}</span>
      <strong>{value || "Não informado"}</strong>
    </S.ReviewItem>
  );
}

export function MemberCreateForm({ options, mode = "create", initialData }: Props) {
  const router = useRouter();
  const { startNavigation } = useNavigationFeedback();
  const [data, setData] = useState<MemberFormData>(initialData ?? initialMemberFormData);
  const [stepIndex, setStepIndex] = useState(0);
  const [errors, setErrors] = useState<MemberFormErrors>({});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [cepMessage, setCepMessage] = useState("");
  const [cpfChecking, setCpfChecking] = useState(false);
  const [cpfMessage, setCpfMessage] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const cepTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cepRequest = useRef<AbortController | null>(null);
  const cpfTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cpfRequest = useRef(0);
  const currentStep = memberFormSteps[stepIndex];

  useEffect(() => {
    function warnBeforeLeave(event: BeforeUnloadEvent) {
      if (!dirty) return;
      event.preventDefault();
    }
    window.addEventListener("beforeunload", warnBeforeLeave);
    return () => window.removeEventListener("beforeunload", warnBeforeLeave);
  }, [dirty]);

  useEffect(() => () => {
    if (cepTimer.current) clearTimeout(cepTimer.current);
    if (cpfTimer.current) clearTimeout(cpfTimer.current);
    cepRequest.current?.abort();
  }, []);

  function update<K extends keyof MemberFormData>(field: K, value: MemberFormData[K]) {
    setData((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setDirty(true);
  }

  async function loadCep(cep: string) {
    cepRequest.current?.abort();
    const controller = new AbortController();
    cepRequest.current = controller;
    setCepLoading(true);
    setCepMessage("");
    try {
      const response = await fetch(`/api/address/cep/${cep}`, { signal: controller.signal });
      const address = await response.json();
      if (!response.ok) throw new Error(address.message ?? "CEP não encontrado.");
      setData((current) => ({
        ...current,
        address: address.street || current.address,
        district: address.district || current.district,
        city: address.city || current.city,
        state: address.state || current.state,
      }));
      setCepMessage("CEP localizado");
      setDirty(true);
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        setCepMessage(error instanceof Error ? error.message : "Não foi possível consultar o CEP.");
      }
    } finally {
      if (cepRequest.current === controller) setCepLoading(false);
    }
  }

  function changeCep(event: ChangeEvent<HTMLInputElement>) {
    const value = formatCep(event.target.value);
    update("zip_code", value);
    setCepMessage("");
    if (cepTimer.current) clearTimeout(cepTimer.current);
    const clean = digits(value);
    if (clean.length === 8) {
      cepTimer.current = setTimeout(() => void loadCep(clean), 350);
    } else {
      cepRequest.current?.abort();
      setCepLoading(false);
    }
  }

  async function checkCpf(cpf: string) {
    const requestId = ++cpfRequest.current;
    setCpfChecking(true);
    setCpfMessage("");
    const result = await checkMemberCpfAvailabilityAction(cpf, mode === "edit" ? initialData?.id : undefined);
    if (requestId !== cpfRequest.current) return;
    setCpfChecking(false);
    if (!result.success) {
      setCpfMessage(result.message);
      return;
    }
    if (!result.available) {
      setErrors((current) => ({ ...current, cpf: "Este CPF já está vinculado a outro membro." }));
      return;
    }
    setCpfMessage("CPF válido e disponível para cadastro.");
  }

  function changeCpf(event: ChangeEvent<HTMLInputElement>) {
    const value = formatCpf(event.target.value);
    update("cpf", value);
    setCpfMessage("");
    setCpfChecking(false);
    cpfRequest.current += 1;
    if (cpfTimer.current) clearTimeout(cpfTimer.current);
    const clean = digits(value);
    if (clean.length !== 11) return;
    if (!isValidCpf(clean)) {
      setErrors((current) => ({ ...current, cpf: "Informe um CPF válido." }));
      return;
    }
    cpfTimer.current = setTimeout(() => void checkCpf(clean), 350);
  }

  function previous() {
    setErrors({});
    setStepIndex((current) => Math.max(0, current - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goToStep(targetIndex: number) {
    if (saving || targetIndex === stepIndex) return;
    if (targetIndex < stepIndex) {
      setErrors({});
      setStepIndex(targetIndex);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (cpfChecking && targetIndex > 0) {
      setNotice({
        title: "Aguarde a verificação",
        description: "A validação do CPF ainda está em andamento.",
        variant: "warning",
      });
      return;
    }

    for (let index = 0; index < targetIndex; index += 1) {
      const stepErrors = validateMemberFormStep(memberFormSteps[index].id, data);
      if (Object.keys(stepErrors).length) {
        setErrors(stepErrors);
        setStepIndex(index);
        setNotice({
          title: `Revise a etapa ${memberFormSteps[index].title}`,
          description:
            "Preencha os campos obrigatórios antes de avançar para outra etapa.",
          variant: "warning",
        });
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
    }

    setErrors({});
    setStepIndex(targetIndex);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function next() {
    if (saving) return;
    if (currentStep.id === "personal" && cpfChecking) {
      setNotice({ title: "Aguarde a verificação", description: "A validação do CPF ainda está em andamento.", variant: "warning" });
      return;
    }
    const stepErrors = validateMemberFormStep(currentStep.id, data);
    if (Object.keys(stepErrors).length) {
      setErrors(stepErrors);
      setNotice({ title: "Revise esta etapa", description: "Existem campos que precisam de atenção antes de continuar.", variant: "warning" });
      return;
    }
    if (stepIndex < memberFormSteps.length - 1) {
      setErrors({});
      setStepIndex((current) => current + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const allErrors = validateAllMemberFormSteps(
      memberFormSteps.map((step) => step.id),
      data,
    );
    if (Object.keys(allErrors).length) {
      const firstInvalidIndex = memberFormSteps.findIndex((step) =>
        Object.keys(validateMemberFormStep(step.id, data)).length,
      );
      const safeIndex = Math.max(0, firstInvalidIndex);
      setErrors(validateMemberFormStep(memberFormSteps[safeIndex].id, data));
      setStepIndex(safeIndex);
      setNotice({
        title: `Revise a etapa ${memberFormSteps[safeIndex].title}`,
        description:
          "O cadastro não pode ser salvo enquanto houver campos obrigatórios em branco.",
        variant: "warning",
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setSaving(true);
    const result = mode === "edit" && initialData
      ? await updateMemberAction(initialData.id, initialData.updated_at, data)
      : await createMemberAction(data);
    setSaving(false);
    if (!result.success) {
      setErrors(result.fieldErrors ?? {});
      setNotice({ title: "Não foi possível salvar", description: result.message, variant: "danger" });
      return;
    }
    setDirty(false);
    setNotice({ title: mode === "edit" ? "Cadastro atualizado" : "Membro cadastrado", description: result.message, variant: "success" });
    window.setTimeout(() => {
      startNavigation();
      router.push("/membros");
    }, 650);
  }

  const input = (field: keyof MemberFormData, label: string, type = "text", placeholder?: string) => (
    <S.Field>
      <span>{label}</span>
      <S.Control
        id={field}
        type={type}
        value={String(data[field] ?? "")}
        placeholder={placeholder}
        $invalid={Boolean(errors[field])}
        onChange={(event) => update(field, event.target.value as never)}
      />
      {errors[field] && <S.FieldError>{errors[field]}</S.FieldError>}
    </S.Field>
  );

  const select = (field: keyof MemberFormData, label: string, values: { label: string; value: string }[], placeholder?: string) => (
    <S.Field>
      <span>{label}</span>
      <S.SelectControl id={field} value={String(data[field] ?? "")} $invalid={Boolean(errors[field])} onChange={(event) => update(field, event.target.value as never)}>
        <option value="">{placeholder ?? "Selecione uma opção"}</option>
        {values.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </S.SelectControl>
      {errors[field] && <S.FieldError>{errors[field]}</S.FieldError>}
    </S.Field>
  );

  return (
    <>
      <S.FormLayout>
        <MemberFormProgress
          steps={memberFormSteps}
          currentStepIndex={stepIndex}
          onStepChange={goToStep}
        />
        <S.FormCard onSubmit={(event) => event.preventDefault()}>
          <S.FormHeader>
            <S.HeaderBadge>Cadastro multifases</S.HeaderBadge>
            <S.FormTitle>{mode === "edit" ? "Editar membro" : "Ficha cadastral"}</S.FormTitle>
            <S.FormDescription>
              Etapa {stepIndex + 1} de {memberFormSteps.length}. Os dados permanecem preenchidos ao avançar ou voltar.
            </S.FormDescription>
          </S.FormHeader>
          <S.FormBody>
            <S.StepHeader>
              <S.StepEyebrow>{currentStep.title}</S.StepEyebrow>
              <S.StepTitle>{currentStep.title}</S.StepTitle>
              <S.StepDescription>{currentStep.description}</S.StepDescription>
            </S.StepHeader>

            {options.hasLoadError && (
              <S.WarningBox><CircleAlert />{options.loadErrorMessage}</S.WarningBox>
            )}

            {currentStep.id === "personal" && (
              <S.FieldsGrid>
                <S.FieldFull>{input("full_name", "Nome completo *", "text", "Nome civil completo")}</S.FieldFull>
                {select("gender", "Sexo", genderOptions)}
                {input("birth_date", "Data de nascimento", "date")}
                {select("marital_status", "Estado civil", maritalStatusOptions)}
                {input("nationality", "Nacionalidade")}
                {input("natural_city", "Naturalidade")}
                {select("natural_state", "UF de nascimento", brazilianStateOptions)}
                {input("profession", "Profissão")}
                {select("education_level", "Escolaridade", educationLevelOptions)}
                {options.canManageSensitiveIdentity && (
                  <>
                    <S.Field>
                      <S.FieldHeader>
                        <span>CPF</span>
                        {!cpfChecking && errors.cpf && <S.LabelStatus $tone="danger" title={errors.cpf}>{errors.cpf}</S.LabelStatus>}
                        {!cpfChecking && !errors.cpf && cpfMessage && <S.LabelStatus $tone={cpfMessage.startsWith("CPF válido") ? "success" : "danger"} title={cpfMessage}>{cpfMessage}</S.LabelStatus>}
                      </S.FieldHeader>
                      <S.ControlShell>
                        <S.Control $withInlineStatus={cpfChecking} id="cpf" value={data.cpf} $invalid={Boolean(errors.cpf)} onChange={changeCpf} inputMode="numeric" maxLength={14} placeholder="000.000.000-00" />
                        {cpfChecking && <S.InlineFieldStatus role="status"><Loader2 /> Verificando CPF...</S.InlineFieldStatus>}
                      </S.ControlShell>
                    </S.Field>
                    {input("rg", "RG")}
                    {input("issuing_agency", "Órgão emissor")}
                  </>
                )}
              </S.FieldsGrid>
            )}

            {currentStep.id === "contact" && (
              <S.FieldsGrid>
                <S.Field>
                  <span>WhatsApp</span>
                  <S.Control id="whatsapp" value={data.whatsapp} $invalid={Boolean(errors.whatsapp)} onChange={(event) => update("whatsapp", formatBrazilPhone(event.target.value))} inputMode="tel" maxLength={15} placeholder="(00) 00000-0000" />
                  {errors.whatsapp && <S.FieldError>{errors.whatsapp}</S.FieldError>}
                </S.Field>
                {input("email", "E-mail", "email")}
                <S.FieldBlock>
                  <S.FieldHeader>
                    <S.FieldLabel htmlFor="zip_code">CEP</S.FieldLabel>
                    {!cepLoading && cepMessage && <S.LabelStatus $tone={cepMessage === "CEP localizado" ? "success" : "danger"} title={cepMessage}>{cepMessage}</S.LabelStatus>}
                  </S.FieldHeader>
                  <S.ControlShell>
                    <S.Control $withInlineStatus={cepLoading} id="zip_code" value={data.zip_code} onChange={changeCep} inputMode="numeric" maxLength={9} placeholder="00000-000" />
                    {cepLoading && <S.InlineFieldStatus role="status"><Loader2 /> Buscando CEP...</S.InlineFieldStatus>}
                  </S.ControlShell>
                </S.FieldBlock>
                {input("address", "Logradouro")}
                {input("number", "Número")}
                {input("complement", "Complemento")}
                {input("district", "Bairro")}
                {input("city", "Cidade *")}
                {select("state", "Estado *", brazilianStateOptions)}
                {input("country", "País")}
              </S.FieldsGrid>
            )}

            {currentStep.id === "family" && (
              <S.FieldsGrid>
                {input("father_name", "Nome do pai")}
                {input("mother_name", "Nome da mãe")}
                {input("spouse_name", "Nome do cônjuge")}
              </S.FieldsGrid>
            )}

            {currentStep.id === "bond" && (
              <S.FieldsGrid>
                <S.FieldFull><S.ChurchContextBox><Info />Igreja atual: <strong>{options.churchName}</strong>.</S.ChurchContextBox></S.FieldFull>
                {select("congregation_id", "Congregação *", options.congregations)}
                {select("member_type", "Tipo de cadastro *", memberTypeOptions)}
                {options.canManageRoles && mode === "create" && select("main_role_id", "Cargo", options.roles, "Sem Cargo")}
                {options.canManageRoles && mode === "create" && input("role_start_date", "Início no Cargo", "date")}
              </S.FieldsGrid>
            )}

            {currentStep.id === "ecclesiastical" && (
              <S.FieldsGrid>
                {input("conversion_date", "Data de conversão", "date")}
                {input("baptism_date", "Data de batismo nas águas", "date")}
                {input("baptism_church", "Igreja do batismo")}
                <S.CheckCard><Checkbox id="has_holy_spirit_baptism" label="Batizado com o Espírito Santo" checked={data.has_holy_spirit_baptism} onChange={(event) => update("has_holy_spirit_baptism", event.target.checked)} /></S.CheckCard>
                {data.has_holy_spirit_baptism && input("holy_spirit_baptism_date", "Data do batismo com o Espírito Santo", "date")}
                {input("previous_church", "Igreja anterior")}
                {select("received_by", "Forma de recebimento", receivedByOptions)}
                {input("received_date", "Data de recebimento oficial", "date")}
                {data.received_by === "LETTER" && input("letter_origin_church", "Igreja de origem da carta")}
              </S.FieldsGrid>
            )}

            {currentStep.id === "review" && (
              <S.ReviewGrid>
                <ReviewItem label="Nome" value={data.full_name} />
                <ReviewItem label="Tipo" value={memberTypeOptions.find((item) => item.value === data.member_type)?.label} />
                <ReviewItem label="Congregação" value={options.congregations.find((item) => item.value === data.congregation_id)?.label} />
                {mode === "create" && <ReviewItem label="Cargo" value={options.roles.find((item) => item.value === data.main_role_id)?.label} />}
                <ReviewItem label="WhatsApp" value={data.whatsapp} />
                <ReviewItem label="Recebimento" value={formatDateOnly(data.received_date)} />
                <S.FieldFull>
                  <S.FieldBlock><S.FieldLabel htmlFor="notes">Observações gerais</S.FieldLabel><S.Textarea id="notes" value={data.notes} onChange={(event) => update("notes", event.target.value)} /></S.FieldBlock>
                </S.FieldFull>
                {options.canEditPastoralNotes && (
                  <S.FieldFull><S.FieldBlock><S.FieldLabel htmlFor="pastoral_notes">Observações pastorais (restritas)</S.FieldLabel><S.Textarea id="pastoral_notes" value={data.pastoral_notes} onChange={(event) => update("pastoral_notes", event.target.value)} /></S.FieldBlock></S.FieldFull>
                )}
              </S.ReviewGrid>
            )}
          </S.FormBody>
          <MemberFormFooter isFirstStep={stepIndex === 0} isLastStep={stepIndex === memberFormSteps.length - 1} onBack={previous} onNext={() => void next()} saving={saving} />
        </S.FormCard>
      </S.FormLayout>
      {notice && <ToastViewport><Toast title={notice.title} description={notice.description} variant={notice.variant} onClose={() => setNotice(null)} /></ToastViewport>}
    </>
  );
}
