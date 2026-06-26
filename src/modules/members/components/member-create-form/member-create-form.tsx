"use client";

import { ChangeEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Info, ShieldCheck } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Toast } from "@/components/ui/toast";
import {
  brazilianStateOptions,
  educationLevelOptions,
  genderOptions,
  initialMemberFormData,
  maritalStatusOptions,
  memberFormSteps,
  memberStatusOptions,
  memberTypeOptions,
  receivedByOptions,
} from "../../constants/member-form-options";
import type {
  MemberFormData,
  MemberFormErrors,
  MemberFormOptions,
  MemberFormStepId,
  SelectOption,
} from "../../types/member-form.types";
import {
  hasValidationErrors,
  validateAllMemberFormSteps,
  validateMemberFormStep,
} from "../../utils/member-form-validation";
import { createMemberAction } from "../../actions/create-member.action";
import { MemberFormFooter } from "./member-form-footer";
import { MemberFormProgress } from "./member-form-progress";
import * as S from "./member-create-form.styles";

type MemberCreateFormProps = {
  options: MemberFormOptions;
};

type FormToast = {
  title: string;
  description?: string;
  variant: "success" | "danger" | "warning" | "neutral";
};

type TextAreaFieldProps = {
  id: keyof Pick<
    MemberFormData,
    "notes" | "pastoral_notes" | "inactive_reason"
  >;
  label: string;
  value: string;
  error?: string;
  placeholder?: string;
  onChange: (field: keyof MemberFormData, value: string) => void;
};

function TextAreaField({
  id,
  label,
  value,
  error,
  placeholder,
  onChange,
}: TextAreaFieldProps) {
  return (
    <S.FieldBlock>
      <S.FieldLabel htmlFor={id}>{label}</S.FieldLabel>
      <S.Textarea
        id={id}
        value={value}
        placeholder={placeholder}
        $hasError={Boolean(error)}
        onChange={(event) => onChange(id, event.target.value)}
      />
      {error ? <S.ErrorText>{error}</S.ErrorText> : null}
    </S.FieldBlock>
  );
}

function getOptionLabel(options: SelectOption[], value: string) {
  if (!value) return "Não informado";
  return options.find((option) => option.value === value)?.label ?? value;
}

function getBooleanLabel(value: boolean) {
  return value ? "Sim" : "Não";
}

function displayValue(value?: string) {
  return value && value.trim() ? value : "Não informado";
}

export function MemberCreateForm({ options }: MemberCreateFormProps) {
  const router = useRouter();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [formData, setFormData] = useState<MemberFormData>(
    initialMemberFormData,
  );
  const [errors, setErrors] = useState<MemberFormErrors>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<FormToast | null>(null);

  const currentStep = memberFormSteps[currentStepIndex];
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === memberFormSteps.length - 1;

  const stepIds = useMemo(() => memberFormSteps.map((step) => step.id), []);

  function clearFieldError(field: keyof MemberFormData) {
    setErrors((currentErrors) => {
      if (!currentErrors[field]) return currentErrors;
      const nextErrors = { ...currentErrors };
      delete nextErrors[field];
      return nextErrors;
    });
  }

  function clearFeedbackMessages() {
    setSuccessMessage(null);
    setToast(null);
  }

  function updateField(field: keyof MemberFormData, value: string) {
    clearFeedbackMessages();
    setFormData((currentData) => ({ ...currentData, [field]: value }));
    clearFieldError(field);
  }

  function updateBooleanField(field: keyof MemberFormData, checked: boolean) {
    clearFeedbackMessages();
    setFormData((currentData) => ({ ...currentData, [field]: checked }));
    clearFieldError(field);
  }

  function handleInputChange(field: keyof MemberFormData) {
    return (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      updateField(field, event.target.value);
    };
  }

  function validateCurrentStep() {
    const stepErrors = validateMemberFormStep(currentStep.id, formData);
    setErrors((currentErrors) => ({ ...currentErrors, ...stepErrors }));
    return !hasValidationErrors(stepErrors);
  }

  function goToFirstInvalidStep(allErrors: MemberFormErrors) {
    if (!hasValidationErrors(allErrors)) return;

    const firstInvalidStepIndex = memberFormSteps.findIndex((step) => {
      const stepErrors = validateMemberFormStep(step.id, formData);
      return hasValidationErrors(stepErrors);
    });

    if (firstInvalidStepIndex >= 0) {
      setCurrentStepIndex(firstInvalidStepIndex);
    }
  }

  function goToPreviousStep() {
    if (isFirstStep || isSaving) return;
    setCurrentStepIndex((index) => index - 1);
    clearFeedbackMessages();
  }

  async function handleSubmit() {
    const allErrors = validateAllMemberFormSteps(
      stepIds as MemberFormStepId[],
      formData,
    );
    setErrors(allErrors);

    if (hasValidationErrors(allErrors)) {
      setToast({
        title: "Existem campos obrigatórios pendentes",
        description: "Revise as etapas destacadas antes de salvar o cadastro.",
        variant: "warning",
      });
      goToFirstInvalidStep(allErrors);
      return;
    }

    setIsSaving(true);
    setToast({
      title: "Salvando cadastro",
      description:
        "Estamos registrando o membro e criando os vínculos iniciais.",
      variant: "neutral",
    });

    const result = await createMemberAction(formData);

    if (!result.success) {
      setIsSaving(false);

      if (result.fieldErrors) {
        setErrors(result.fieldErrors);
        goToFirstInvalidStep(result.fieldErrors);
      }

      setToast({
        title: "Não foi possível salvar",
        description: result.message,
        variant: "danger",
      });
      return;
    }

    setSuccessMessage(result.message);
    setToast({
      title: result.warningMessage
        ? "Cadastro salvo com atenção"
        : "Cadastro salvo",
      description:
        result.warningMessage ??
        "Você será redirecionado para a tela de membros.",
      variant: result.warningMessage ? "warning" : "success",
    });

    window.setTimeout(() => {
      router.push("/membros");
      router.refresh();
    }, 1400);
  }

  function goToNextStep() {
    clearFeedbackMessages();

    if (isSaving) return;

    if (isLastStep) {
      void handleSubmit();
      return;
    }

    if (!validateCurrentStep()) return;
    setCurrentStepIndex((index) => index + 1);
  }

  function renderPersonalStep() {
    return (
      <S.FieldsGrid>
        <S.FieldFull>
          <Input
            id="full_name"
            label="Nome completo *"
            placeholder="Ex.: João da Silva"
            value={formData.full_name}
            error={errors.full_name}
            onChange={handleInputChange("full_name")}
          />
        </S.FieldFull>

        <Select
          id="gender"
          label="Sexo"
          value={formData.gender}
          options={genderOptions}
          onChange={handleInputChange("gender")}
        />

        <Input
          id="birth_date"
          label="Data de nascimento"
          type="date"
          value={formData.birth_date}
          onChange={handleInputChange("birth_date")}
        />

        <Select
          id="marital_status"
          label="Estado civil"
          value={formData.marital_status}
          options={maritalStatusOptions}
          onChange={handleInputChange("marital_status")}
        />

        <Input
          id="wedding_date"
          label="Data de casamento"
          type="date"
          value={formData.wedding_date}
          onChange={handleInputChange("wedding_date")}
        />

        <Input
          id="nationality"
          label="Nacionalidade"
          value={formData.nationality}
          onChange={handleInputChange("nationality")}
        />

        <Input
          id="natural_city"
          label="Naturalidade"
          placeholder="Cidade de nascimento"
          value={formData.natural_city}
          onChange={handleInputChange("natural_city")}
        />

        <Select
          id="natural_state"
          label="Estado de nascimento"
          value={formData.natural_state}
          options={brazilianStateOptions}
          onChange={handleInputChange("natural_state")}
        />

        <Input
          id="cpf"
          label="CPF"
          placeholder="000.000.000-00"
          value={formData.cpf}
          onChange={handleInputChange("cpf")}
        />

        <Input
          id="rg"
          label="RG"
          placeholder="Documento de identidade"
          value={formData.rg}
          onChange={handleInputChange("rg")}
        />

        <Input
          id="issuing_agency"
          label="Órgão emissor"
          placeholder="Ex.: SSP-GO"
          value={formData.issuing_agency}
          onChange={handleInputChange("issuing_agency")}
        />

        <Input
          id="profession"
          label="Profissão"
          placeholder="Ex.: Professor"
          value={formData.profession}
          onChange={handleInputChange("profession")}
        />

        <Select
          id="education_level"
          label="Escolaridade"
          value={formData.education_level}
          options={educationLevelOptions}
          onChange={handleInputChange("education_level")}
        />
      </S.FieldsGrid>
    );
  }

  function renderContactStep() {
    return (
      <S.FieldGroup>
        <S.FieldsGrid>
          <Input
            id="phone"
            label="Telefone"
            placeholder="(00) 0000-0000"
            value={formData.phone}
            onChange={handleInputChange("phone")}
          />

          <Input
            id="whatsapp"
            label="WhatsApp"
            placeholder="(00) 00000-0000"
            value={formData.whatsapp}
            onChange={handleInputChange("whatsapp")}
          />

          <S.FieldFull>
            <Input
              id="email"
              label="E-mail"
              type="email"
              placeholder="nome@email.com"
              value={formData.email}
              onChange={handleInputChange("email")}
            />
          </S.FieldFull>
        </S.FieldsGrid>

        <S.GroupTitle>Endereço</S.GroupTitle>

        <S.FieldsGrid>
          <Input
            id="zip_code"
            label="CEP"
            placeholder="00000-000"
            value={formData.zip_code}
            onChange={handleInputChange("zip_code")}
          />

          <Input
            id="address"
            label="Endereço"
            placeholder="Rua, avenida, travessa..."
            value={formData.address}
            onChange={handleInputChange("address")}
          />

          <Input
            id="number"
            label="Número"
            placeholder="Ex.: 123"
            value={formData.number}
            onChange={handleInputChange("number")}
          />

          <Input
            id="complement"
            label="Complemento"
            placeholder="Casa, lote, quadra..."
            value={formData.complement}
            onChange={handleInputChange("complement")}
          />

          <Input
            id="district"
            label="Bairro"
            placeholder="Ex.: Centro"
            value={formData.district}
            onChange={handleInputChange("district")}
          />

          <Input
            id="city"
            label="Cidade *"
            placeholder="Ex.: Porangatu"
            value={formData.city}
            error={errors.city}
            onChange={handleInputChange("city")}
          />

          <Select
            id="state"
            label="Estado *"
            value={formData.state}
            error={errors.state}
            options={brazilianStateOptions}
            onChange={handleInputChange("state")}
          />

          <Input
            id="country"
            label="País *"
            value={formData.country}
            error={errors.country}
            onChange={handleInputChange("country")}
          />
        </S.FieldsGrid>
      </S.FieldGroup>
    );
  }

  function renderFamilyStep() {
    return (
      <S.FieldGroup>
        <S.InfoBox>
          <Info aria-hidden="true" />
          <p>
            Esta etapa é leve de propósito. As informações familiares ajudam em
            relatórios e no cuidado pastoral, mas não devem tornar o cadastro
            cansativo.
          </p>
        </S.InfoBox>

        <S.FieldsGrid>
          <Input
            id="father_name"
            label="Nome do pai"
            placeholder="Nome completo do pai"
            value={formData.father_name}
            onChange={handleInputChange("father_name")}
          />

          <Input
            id="mother_name"
            label="Nome da mãe"
            placeholder="Nome completo da mãe"
            value={formData.mother_name}
            onChange={handleInputChange("mother_name")}
          />

          <Input
            id="spouse_name"
            label="Nome do cônjuge"
            placeholder="Quando houver"
            value={formData.spouse_name}
            onChange={handleInputChange("spouse_name")}
          />

          <Input
            id="guardian_name"
            label="Responsável legal"
            placeholder="Principalmente para criança/menor"
            value={formData.guardian_name}
            onChange={handleInputChange("guardian_name")}
          />

          <Input
            id="guardian_phone"
            label="Telefone do responsável"
            placeholder="(00) 00000-0000"
            value={formData.guardian_phone}
            onChange={handleInputChange("guardian_phone")}
          />
        </S.FieldsGrid>
      </S.FieldGroup>
    );
  }

  function renderMinisterialStep() {
    return (
      <S.FieldGroup>
        {options.hasLoadError && (
          <S.WarningBox>
            <AlertCircle aria-hidden="true" />
            <p>{options.loadErrorMessage}</p>
          </S.WarningBox>
        )}

        <S.FieldsGrid>
          <Select
            id="church_id"
            label="Igreja / Campo *"
            placeholder="Selecione a igreja/campo"
            value={formData.church_id}
            error={errors.church_id}
            options={options.churches}
            onChange={handleInputChange("church_id")}
          />

          <Select
            id="congregation_id"
            label="Congregação *"
            placeholder="Selecione a congregação"
            value={formData.congregation_id}
            error={errors.congregation_id}
            options={options.congregations}
            onChange={handleInputChange("congregation_id")}
          />

          <Select
            id="member_type"
            label="Tipo de cadastro *"
            value={formData.member_type}
            error={errors.member_type}
            options={memberTypeOptions}
            onChange={handleInputChange("member_type")}
          />

          <Select
            id="member_status"
            label="Status *"
            value={formData.member_status}
            error={errors.member_status}
            options={memberStatusOptions}
            onChange={handleInputChange("member_status")}
          />

          <Select
            id="main_role_id"
            label="Cargo principal"
            placeholder="Selecione um cargo"
            value={formData.main_role_id}
            options={options.roles}
            onChange={handleInputChange("main_role_id")}
          />

          <Select
            id="ministry_id"
            label="Ministério principal"
            placeholder="Selecione um ministério"
            value={formData.ministry_id}
            options={options.ministries}
            onChange={handleInputChange("ministry_id")}
          />
        </S.FieldsGrid>

        <S.GroupTitle>Indicadores ministeriais</S.GroupTitle>

        <S.CheckGrid>
          <S.CheckCard>
            <Checkbox
              id="is_public_worker"
              label="É obreiro/liderança"
              checked={formData.is_public_worker}
              onChange={(event) =>
                updateBooleanField("is_public_worker", event.target.checked)
              }
            />
          </S.CheckCard>

          <S.CheckCard>
            <Checkbox
              id="is_active_in_ministry"
              label="Está ativo em ministério"
              checked={formData.is_active_in_ministry}
              onChange={(event) =>
                updateBooleanField(
                  "is_active_in_ministry",
                  event.target.checked,
                )
              }
            />
          </S.CheckCard>

          <S.CheckCard>
            <Checkbox
              id="can_receive_notifications"
              label="Pode receber notificações"
              checked={formData.can_receive_notifications}
              onChange={(event) =>
                updateBooleanField(
                  "can_receive_notifications",
                  event.target.checked,
                )
              }
            />
          </S.CheckCard>
        </S.CheckGrid>
      </S.FieldGroup>
    );
  }

  function renderEcclesiasticalStep() {
    return (
      <S.FieldGroup>
        <S.FieldsGrid>
          <Input
            id="joined_at"
            label="Data de entrada"
            type="date"
            value={formData.joined_at}
            onChange={handleInputChange("joined_at")}
          />

          <Input
            id="conversion_date"
            label="Data de conversão"
            type="date"
            value={formData.conversion_date}
            onChange={handleInputChange("conversion_date")}
          />

          <Input
            id="baptism_date"
            label="Data de batismo nas águas"
            type="date"
            value={formData.baptism_date}
            onChange={handleInputChange("baptism_date")}
          />

          <Input
            id="baptism_church"
            label="Igreja do batismo"
            placeholder="Onde foi batizado"
            value={formData.baptism_church}
            onChange={handleInputChange("baptism_church")}
          />

          <Input
            id="child_presentation_date"
            label="Data de apresentação da criança"
            type="date"
            value={formData.child_presentation_date}
            onChange={handleInputChange("child_presentation_date")}
          />

          <Input
            id="previous_church"
            label="Igreja anterior"
            placeholder="Quando houver"
            value={formData.previous_church}
            onChange={handleInputChange("previous_church")}
          />

          <Select
            id="received_by"
            label="Recebido por"
            placeholder="Selecione a forma de recebimento"
            value={formData.received_by}
            options={receivedByOptions}
            onChange={handleInputChange("received_by")}
          />

          <Input
            id="received_date"
            label="Data de recebimento"
            type="date"
            value={formData.received_date}
            onChange={handleInputChange("received_date")}
          />

          <Input
            id="letter_origin_church"
            label="Igreja de origem da carta"
            placeholder="Obrigatório se recebido por carta"
            value={formData.letter_origin_church}
            error={errors.letter_origin_church}
            onChange={handleInputChange("letter_origin_church")}
          />

          <Input
            id="letter_destination_church"
            label="Igreja de destino"
            placeholder="Em caso de transferência"
            value={formData.letter_destination_church}
            error={errors.letter_destination_church}
            onChange={handleInputChange("letter_destination_church")}
          />

          <Input
            id="transfer_date"
            label="Data de transferência"
            type="date"
            value={formData.transfer_date}
            error={errors.transfer_date}
            onChange={handleInputChange("transfer_date")}
          />

          <S.FieldFull>
            <TextAreaField
              id="inactive_reason"
              label="Motivo de inativação"
              placeholder="Preencha somente quando o status for inativo."
              value={formData.inactive_reason}
              error={errors.inactive_reason}
              onChange={updateField}
            />
          </S.FieldFull>
        </S.FieldsGrid>

        <S.GroupTitle>Batismo com Espírito Santo</S.GroupTitle>

        <S.FieldsGrid>
          <S.CheckCard>
            <Checkbox
              id="has_holy_spirit_baptism"
              label="Possui batismo com Espírito Santo"
              checked={formData.has_holy_spirit_baptism}
              onChange={(event) =>
                updateBooleanField(
                  "has_holy_spirit_baptism",
                  event.target.checked,
                )
              }
            />
          </S.CheckCard>

          <Input
            id="holy_spirit_baptism_date"
            label="Data do batismo com Espírito Santo"
            type="date"
            value={formData.holy_spirit_baptism_date}
            error={errors.holy_spirit_baptism_date}
            onChange={handleInputChange("holy_spirit_baptism_date")}
          />
        </S.FieldsGrid>
      </S.FieldGroup>
    );
  }

  function renderReviewCard(
    title: string,
    items: { label: string; value: string }[],
  ) {
    return (
      <S.ReviewCard>
        <S.ReviewTitle>{title}</S.ReviewTitle>
        <S.ReviewList>
          {items.map((item) => (
            <S.ReviewItem key={`${title}-${item.label}`}>
              <S.ReviewLabel>{item.label}</S.ReviewLabel>
              <S.ReviewValue>{item.value}</S.ReviewValue>
            </S.ReviewItem>
          ))}
        </S.ReviewList>
      </S.ReviewCard>
    );
  }

  function renderReviewStep() {
    return (
      <S.FieldGroup>
        <S.InfoBox>
          <ShieldCheck aria-hidden="true" />
          <p>
            As observações pastorais são informações sensíveis. Nesta primeira
            versão elas ficam no formulário, mas depois poderemos controlar quem
            pode visualizar esse campo.
          </p>
        </S.InfoBox>

        <S.FieldsGrid>
          <S.FieldFull>
            <TextAreaField
              id="notes"
              label="Observações gerais"
              placeholder="Informações úteis para a secretaria."
              value={formData.notes}
              onChange={updateField}
            />
          </S.FieldFull>

          <S.FieldFull>
            <TextAreaField
              id="pastoral_notes"
              label="Observações pastorais"
              placeholder="Informações sensíveis para acompanhamento pastoral."
              value={formData.pastoral_notes}
              onChange={updateField}
            />
          </S.FieldFull>
        </S.FieldsGrid>

        <S.GroupTitle>Resumo do cadastro</S.GroupTitle>

        <S.ReviewGrid>
          {renderReviewCard("Dados pessoais", [
            { label: "Nome completo", value: displayValue(formData.full_name) },
            {
              label: "Nome preferido",
              value: displayValue(formData.preferred_name),
            },
            {
              label: "Sexo",
              value: getOptionLabel(genderOptions, formData.gender),
            },
            { label: "Nascimento", value: displayValue(formData.birth_date) },
            {
              label: "Estado civil",
              value: getOptionLabel(
                maritalStatusOptions,
                formData.marital_status,
              ),
            },
            { label: "CPF", value: displayValue(formData.cpf) },
          ])}

          {renderReviewCard("Contato e endereço", [
            { label: "Telefone", value: displayValue(formData.phone) },
            { label: "WhatsApp", value: displayValue(formData.whatsapp) },
            { label: "E-mail", value: displayValue(formData.email) },
            { label: "Cidade", value: displayValue(formData.city) },
            { label: "Estado", value: displayValue(formData.state) },
            { label: "País", value: displayValue(formData.country) },
          ])}

          {renderReviewCard("Dados ministeriais", [
            {
              label: "Igreja/Campo",
              value: getOptionLabel(options.churches, formData.church_id),
            },
            {
              label: "Congregação",
              value: getOptionLabel(
                options.congregations,
                formData.congregation_id,
              ),
            },
            {
              label: "Tipo",
              value: getOptionLabel(memberTypeOptions, formData.member_type),
            },
            {
              label: "Status",
              value: getOptionLabel(
                memberStatusOptions,
                formData.member_status,
              ),
            },
            {
              label: "Cargo",
              value: getOptionLabel(options.roles, formData.main_role_id),
            },
            {
              label: "Ministério",
              value: getOptionLabel(options.ministries, formData.ministry_id),
            },
          ])}

          {renderReviewCard("Histórico eclesiástico", [
            { label: "Entrada", value: displayValue(formData.joined_at) },
            {
              label: "Conversão",
              value: displayValue(formData.conversion_date),
            },
            {
              label: "Batismo nas águas",
              value: displayValue(formData.baptism_date),
            },
            {
              label: "Batismo com Espírito Santo",
              value: getBooleanLabel(formData.has_holy_spirit_baptism),
            },
            {
              label: "Recebido por",
              value: getOptionLabel(receivedByOptions, formData.received_by),
            },
            {
              label: "Data de recebimento",
              value: displayValue(formData.received_date),
            },
          ])}
        </S.ReviewGrid>

        {successMessage && (
          <S.SuccessBox>
            <CheckCircle2 aria-hidden="true" />
            <p>{successMessage}</p>
          </S.SuccessBox>
        )}
      </S.FieldGroup>
    );
  }

  function renderCurrentStep() {
    if (currentStep.id === "personal") return renderPersonalStep();
    if (currentStep.id === "contact") return renderContactStep();
    if (currentStep.id === "family") return renderFamilyStep();
    if (currentStep.id === "ministerial") return renderMinisterialStep();
    if (currentStep.id === "ecclesiastical") return renderEcclesiasticalStep();
    return renderReviewStep();
  }

  return (
    <S.FormLayout>
      <MemberFormProgress
        steps={memberFormSteps}
        currentStepIndex={currentStepIndex}
      />

      <S.FormCard>
        <S.FormHeader>
          <div>
            <S.FormTitle>Novo membro</S.FormTitle>
            <S.FormDescription>
              Informações básicas de identificação.
            </S.FormDescription>
          </div>
        </S.FormHeader>

        <S.FormBody>
          <S.StepHeader>
            <S.StepEyebrow>Etapa {currentStepIndex + 1}</S.StepEyebrow>
            <S.StepTitle>{currentStep.title}</S.StepTitle>
            <S.StepDescription>{currentStep.description}</S.StepDescription>
          </S.StepHeader>

          {renderCurrentStep()}
        </S.FormBody>

        <MemberFormFooter
          isFirstStep={isFirstStep}
          isLastStep={isLastStep}
          onBack={goToPreviousStep}
          onNext={goToNextStep}
          saving={isSaving}
        />
      </S.FormCard>

      {toast ? (
        <S.ToastPosition>
          <Toast
            title={toast.title}
            description={toast.description}
            variant={toast.variant}
            filled
            timeLabel="agora"
            brandLabel="Eclésia"
            onClose={() => setToast(null)}
          />
        </S.ToastPosition>
      ) : null}
    </S.FormLayout>
  );
}
