import type {
  MemberFormData,
  MemberFormErrors,
  MemberFormStepId,
} from "../types/member-form.types";

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
  }

  if (stepId === "contact") {
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

  if (stepId === "ministerial") {
    addRequiredError(
      errors,
      "church_id",
      data.church_id,
      "Selecione a igreja/campo.",
    );
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
    addRequiredError(
      errors,
      "member_status",
      data.member_status,
      "Selecione o status do cadastro.",
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

    if (data.member_status === "TRANSFERRED") {
      addRequiredError(
        errors,
        "letter_destination_church",
        data.letter_destination_church,
        "Informe a igreja de destino da transferência.",
      );
      addRequiredError(
        errors,
        "transfer_date",
        data.transfer_date,
        "Informe a data da transferência.",
      );
    }

    if (data.member_status === "INACTIVE") {
      addRequiredError(
        errors,
        "inactive_reason",
        data.inactive_reason,
        "Informe o motivo da inativação.",
      );
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
