import type {
  MemberFormData,
  MemberFormErrors,
  MemberFormStepId,
} from "../types/member-form.types";
import { isValidCpf, normalizeBrazilPhone } from "@/utils/input-masks";

const requiredMessage = "Este campo é obrigatório.";

function isBlank(value: string) {
  return value.trim().length === 0;
}

function addRequiredError(
  errors: MemberFormErrors,
  field: keyof MemberFormData,
  value: string,
  message = requiredMessage,
) {
  if (isBlank(value)) {
    errors[field] = message;
  }
}

export function validateMemberFormStep(
  stepId: MemberFormStepId,
  data: MemberFormData,
): MemberFormErrors {
  const errors: MemberFormErrors = {};

  if (stepId === "personal") {
    addRequiredError(
      errors,
      "full_name",
      data.full_name,
      "Informe o nome completo do membro.",
    );
    if (data.cpf && !isValidCpf(data.cpf)) {
      errors.cpf = "Informe um CPF válido.";
    }
  }

  if (stepId === "contact") {
    if (data.whatsapp && normalizeBrazilPhone(data.whatsapp).length !== 11) {
      errors.whatsapp = "Informe o WhatsApp com DDD e 9 dígitos.";
    }
    addRequiredError(errors, "country", data.country, "Informe o país.");
    addRequiredError(
      errors,
      "city",
      data.city,
      "Informe a cidade para melhorar os relatórios.",
    );
    addRequiredError(
      errors,
      "state",
      data.state,
      "Informe o estado para melhorar os relatórios.",
    );
  }

  if (stepId === "bond") {
    addRequiredError(
      errors,
      "congregation_id",
      data.congregation_id,
      "Selecione a congregação.",
    );
    addRequiredError(
      errors,
      "member_type",
      data.member_type,
      "Selecione o tipo de cadastro.",
    );
  }

  if (stepId === "ecclesiastical") {
    if (
      data.has_holy_spirit_baptism &&
      isBlank(data.holy_spirit_baptism_date)
    ) {
      errors.holy_spirit_baptism_date =
        "Informe a data ou desmarque a opção de batismo com Espírito Santo.";
    }

    if (data.received_by === "LETTER" && isBlank(data.letter_origin_church)) {
      errors.letter_origin_church = "Informe a igreja de origem da carta.";
    }

  }

  return errors;
}

export function validateAllMemberFormSteps(
  steps: MemberFormStepId[],
  data: MemberFormData,
): MemberFormErrors {
  return steps.reduce<MemberFormErrors>((acc, stepId) => {
    return {
      ...acc,
      ...validateMemberFormStep(stepId, data),
    };
  }, {});
}

export function hasValidationErrors(errors: MemberFormErrors) {
  return Object.keys(errors).length > 0;
}
