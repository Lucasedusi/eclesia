type SupabaseLikeError = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

function getErrorText(error: SupabaseLikeError) {
  return [error.message, error.details, error.hint]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function getFriendlyMemberCreateError(error: SupabaseLikeError) {
  const errorText = getErrorText(error);

  if (error.code === "23505" && errorText.includes("cpf")) {
    return "Já existe um membro cadastrado com este CPF.";
  }

  if (error.code === "23505" && errorText.includes("member_code")) {
    return "Já existe um membro cadastrado com este código interno.";
  }

  if (errorText.includes("congregation_id")) {
    return "Selecione uma congregação válida para continuar.";
  }

  if (errorText.includes("church_id")) {
    return "Selecione uma igreja/campo válida para continuar.";
  }

  return "Não foi possível salvar agora. Tente novamente.";
}
