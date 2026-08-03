import type { OrganizationActionState } from "../types/organization.types";

type DatabaseError = {
  code?: string;
  message?: string;
  details?: string;
};

const knownMessages: Array<[string, string]> = [
  ["Regional possui", "Esta Regional possui Congregações vinculadas. Mova ou inative as Congregações antes de continuar."],
  ["Congregação Sede", "A Congregação Sede não pode ser inativada, excluída ou transformada em Congregação comum."],
  ["Selecione uma Regional", "Selecione uma Regional ativa para a Congregação."],
  ["Regional deve estar ativa", "A Regional selecionada não está ativa ou não pertence a esta igreja."],
  ["dependência(s)", "Esta Congregação possui vínculos que precisam ser preservados. Inative-a em vez de excluir."],
  ["documentos ativos", "Esta Congregação possui documentos anexados. Exclua os documentos ou inative a Congregação."],
  ["vínculos com membros", "Este Cargo já possui vínculo com membros e deve ser apenas inativado."],
  ["exclusiva de Administradores", "Esta ação é exclusiva de Administradores."],
  ["Acesso negado", "Você não possui autorização para realizar esta ação."],
];

export function databaseActionError(
  error: DatabaseError,
  duplicateMessage: string,
  fallbackMessage: string,
): OrganizationActionState {
  if (error.code === "23505") {
    return { status: "error", message: duplicateMessage };
  }

  const technicalMessage = `${error.message ?? ""} ${error.details ?? ""}`;
  const regionCount = technicalMessage.match(/A Regional possui (\d+) Congrega/);
  if (regionCount) {
    return {
      status: "error",
      message: `Esta Regional possui ${regionCount[1]} Congregação(ões) vinculada(s). Mova ou inative os vínculos antes de continuar.`,
    };
  }

  const dependencyCount = technicalMessage.match(/Congregação possui (\d+) dependência/);
  if (dependencyCount) {
    return {
      status: "error",
      message: `Esta Congregação possui ${dependencyCount[1]} dependência(s) que precisam ser preservadas. Inative-a em vez de excluir.`,
    };
  }

  const known = knownMessages.find(([fragment]) => technicalMessage.includes(fragment));

  return {
    status: "error",
    message: known?.[1] ?? fallbackMessage,
  };
}
