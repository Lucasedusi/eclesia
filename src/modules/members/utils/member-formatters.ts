import type { MemberStatus, MemberType } from "../types/member.types";

export const memberStatusLabels: Record<MemberStatus, string> = {
  ACTIVE: "Ativo",
  INACTIVE: "Inativo",
  TRANSFERRED: "Transferido",
  DISCIPLINED: "Disciplinado",
  DECEASED: "Falecido",
};

export const memberTypeLabels: Record<MemberType, string> = {
  MEMBER: "Membro",
  CONGREGATED: "Congregado",
  VISITOR: "Visitante",
  CHILD: "Criança",
};

export const receivedByLabels: Record<string, string> = {
  BAPTISM: "Batismo",
  LETTER: "Carta de transferência",
  ACCLAMATION: "Aclamação",
  RECONCILIATION: "Reconciliação",
  TRANSFER: "Transferência",
  OTHER: "Outro",
};

export const memberRoleStatusLabels: Record<string, string> = {
  ACTIVE: "Ativo",
  INACTIVE: "Inativo",
  SUSPENDED: "Suspenso",
  ENDED: "Encerrado",
};

export function formatGender(value: string | null | undefined) {
  if (value === "MALE") return "Masculino";
  if (value === "FEMALE") return "Feminino";
  return "Não informado";
}

export function formatMaritalStatus(value: string | null | undefined, gender?: string | null) {
  const feminine = gender === "FEMALE";
  const labels: Record<string, string> = {
    SINGLE: feminine ? "Solteira" : "Solteiro",
    MARRIED: feminine ? "Casada" : "Casado",
    DIVORCED: feminine ? "Divorciada" : "Divorciado",
    WIDOWED: feminine ? "Viúva" : "Viúvo",
    STABLE_UNION: "União estável",
    OTHER: "Outro",
  };
  return value ? labels[value] ?? value : "Não informado";
}
