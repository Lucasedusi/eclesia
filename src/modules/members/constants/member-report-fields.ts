type FieldOptions = { width?: number; weight?: number; format?: "text" | "date"; permission?: "identity" | "roles"; complete?: boolean };
function field<K extends string>(key: K, label: string, group: string, options: FieldOptions = {}) {
  return { key, label, group, width: 24, weight: 1, format: "text" as "text" | "date", complete: true, ...options };
}

export const MEMBER_REPORT_FIELDS = [
  field("member_code", "Matrícula", "Identificação", { width: 16, weight: .7 }),
  field("full_name", "Nome do membro", "Identificação", { width: 40, weight: 2 }),
  field("congregation", "Congregação", "Vínculo", { width: 32, weight: 1.4 }),
  field("region", "Regional", "Vínculo", { width: 30, weight: 1.3 }),
  field("whatsapp", "WhatsApp", "Contato", { width: 23, weight: 1.3 }),
  field("email", "E-mail", "Contato", { width: 36, weight: 1.7 }),
  field("role", "Cargo", "Vínculo", { permission: "roles", weight: 1.2 }),
  field("role_start_date", "Início no cargo", "Vínculo", { permission: "roles", format: "date" }),
  field("member_status", "Situação", "Vínculo"),
  field("member_type", "Tipo de membro", "Vínculo"),
  field("gender", "Sexo", "Dados pessoais"),
  field("birth_date", "Nascimento", "Dados pessoais", { format: "date" }),
  field("marital_status", "Estado civil", "Dados pessoais"),
  field("nationality", "Nacionalidade", "Dados pessoais"),
  field("natural_origin", "Naturalidade / UF", "Dados pessoais", { width: 30, weight: 1.4, complete: false }),
  field("natural_city", "Naturalidade", "Dados pessoais"),
  field("natural_state", "UF de nascimento", "Dados pessoais", { width: 18 }),
  field("profession", "Profissão", "Dados pessoais"),
  field("education_level", "Escolaridade", "Dados pessoais"),
  field("cpf", "CPF", "Documentos", { permission: "identity", width: 20 }),
  field("rg", "RG", "Documentos", { permission: "identity" }),
  field("issuing_agency", "Órgão emissor do RG", "Documentos", { permission: "identity" }),
  field("father_name", "Nome do pai", "Família", { width: 36, weight: 1.5 }),
  field("mother_name", "Nome da mãe", "Família", { width: 36, weight: 1.5 }),
  field("spouse_name", "Cônjuge", "Família", { width: 36, weight: 1.5 }),
  field("full_address", "Endereço completo", "Endereço", { width: 65, weight: 2.5, complete: false }),
  field("zip_code", "CEP", "Endereço", { width: 16 }),
  field("address", "Logradouro", "Endereço", { width: 36, weight: 1.8 }),
  field("number", "Número", "Endereço", { width: 12, weight: .7 }),
  field("complement", "Complemento", "Endereço"),
  field("district", "Bairro", "Endereço"),
  field("city", "Cidade", "Endereço"),
  field("state", "UF", "Endereço", { width: 12, weight: .6 }),
  field("country", "País", "Endereço"),
  field("conversion_date", "Conversão", "Vida eclesiástica", { format: "date" }),
  field("baptism_date", "Batismo nas águas", "Vida eclesiástica", { format: "date" }),
  field("baptism_church", "Igreja do batismo", "Vida eclesiástica", { width: 36, weight: 1.5 }),
  field("has_holy_spirit_baptism", "Batismo no Espírito Santo", "Vida eclesiástica"),
  field("holy_spirit_baptism_date", "Data do batismo no Espírito Santo", "Vida eclesiástica", { format: "date", width: 30 }),
  field("previous_church", "Igreja anterior", "Vida eclesiástica", { width: 36, weight: 1.5 }),
  field("received_by", "Forma de recebimento", "Vida eclesiástica"),
  field("received_date", "Data de recebimento", "Vida eclesiástica", { format: "date" }),
  field("letter_origin_church", "Igreja de origem da carta", "Vida eclesiástica", { width: 36, weight: 1.5 }),
  field("transfer_date", "Data de transferência", "Vida eclesiástica", { format: "date" }),
  field("letter_destination_church", "Igreja de destino", "Vida eclesiástica", { width: 36, weight: 1.5 }),
  field("inactive_reason", "Motivo da inativação", "Vida eclesiástica", { width: 40, weight: 2 }),
  field("notes", "Observações gerais", "Outros", { width: 65, weight: 2.5 }),
  field("created_at", "Data de cadastro", "Outros", { format: "date" }),
  field("updated_at", "Última atualização", "Outros", { format: "date" }),
] as const;
export type MemberReportField = typeof MEMBER_REPORT_FIELDS[number];
export type MemberReportFieldKey = MemberReportField["key"];
export type MemberReportOptionalKey = Exclude<MemberReportFieldKey, "member_code" | "full_name">;
export type MemberReportAccess = { viewRoles: boolean; viewSensitiveIdentity: boolean };
export const MEMBER_REPORT_FIXED_KEYS = ["member_code", "full_name"] as const;
export const MEMBER_REPORT_OPTIONAL_FIELDS = MEMBER_REPORT_FIELDS.filter((f) => f.key !== "member_code" && f.key !== "full_name");
export const MEMBER_REPORT_TITLES = { simplified: "Listagem simplificada de membros", complete: "Listagem completa de membros", custom: "Listagem personalizada de membros" };
export function canUseMemberReportField(field: MemberReportField, access: MemberReportAccess) {
  return field.permission === "identity" ? access.viewSensitiveIdentity : field.permission === "roles" ? access.viewRoles : true;
}
export function getMemberReportColumns(options: { kind: "simplified" | "complete" | "custom"; fields?: readonly MemberReportOptionalKey[] }, access: MemberReportAccess): MemberReportField[] {
  if (options.kind === "complete") return MEMBER_REPORT_FIELDS.filter((f) => f.complete && canUseMemberReportField(f, access));
  const keys: readonly MemberReportFieldKey[] = options.kind === "simplified" ? ["member_code", "full_name", "congregation", "whatsapp", "role"] : [...MEMBER_REPORT_FIXED_KEYS, ...options.fields ?? []];
  return keys.map((key) => MEMBER_REPORT_FIELDS.find((f) => f.key === key)!);
}
