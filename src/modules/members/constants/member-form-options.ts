import type {
  MemberFormData,
  MemberFormStep,
  SelectOption,
} from "../types/member-form.types";

export const memberFormSteps: MemberFormStep[] = [
  {
    id: "personal",
    title: "Dados Pessoais",
    description: "Informações básicas de identificação.",
  },
  {
    id: "contact",
    title: "Contato e Endereço",
    description: "Contatos e localização para relatórios.",
  },
  {
    id: "family",
    title: "Família",
    description: "Vínculos familiares do membro.",
  },
  {
    id: "bond",
    title: "Vínculo e Cargo",
    description: "Congregação, tipo de cadastro e Cargo.",
  },
  {
    id: "ecclesiastical",
    title: "Histórico Eclesiástico",
    description: "Informações espirituais e histórico.",
  },
  {
    id: "review",
    title: "Observações e Revisão",
    description: "Observações finais",
  },
];

export const initialMemberFormData: MemberFormData = {
  full_name: "",
  gender: "",
  birth_date: "",
  marital_status: "",
  nationality: "Brasileira",
  natural_city: "",
  natural_state: "",
  cpf: "",
  rg: "",
  issuing_agency: "",
  profession: "",
  education_level: "",

  whatsapp: "",
  email: "",
  zip_code: "",
  address: "",
  number: "",
  complement: "",
  district: "",
  city: "",
  state: "",
  country: "Brasil",

  father_name: "",
  mother_name: "",
  spouse_name: "",
  congregation_id: "",
  member_type: "MEMBER",
  main_role_id: "",
  role_start_date: "",

  conversion_date: "",
  baptism_date: "",
  baptism_church: "",
  has_holy_spirit_baptism: false,
  holy_spirit_baptism_date: "",
  previous_church: "",
  received_by: "",
  received_date: "",
  letter_origin_church: "",

  notes: "",
  pastoral_notes: "",
};

export const genderOptions: SelectOption[] = [
  { label: "Masculino", value: "MALE" },
  { label: "Feminino", value: "FEMALE" },
];

export const maritalStatusOptions: SelectOption[] = [
  { label: "Solteiro(a)", value: "SINGLE" },
  { label: "Casado(a)", value: "MARRIED" },
  { label: "Divorciado(a)", value: "DIVORCED" },
  { label: "Viúvo(a)", value: "WIDOWED" },
  { label: "União estável", value: "STABLE_UNION" },
  { label: "Outro", value: "OTHER" },
];

export const memberStatusOptions: SelectOption[] = [
  { label: "Ativo", value: "ACTIVE" },
  { label: "Inativo", value: "INACTIVE" },
  { label: "Transferido", value: "TRANSFERRED" },
  { label: "Disciplinado", value: "DISCIPLINED" },
  { label: "Falecido", value: "DECEASED" },
];

export const memberTypeOptions: SelectOption[] = [
  { label: "Membro", value: "MEMBER" },
  { label: "Congregado", value: "CONGREGATED" },
  { label: "Visitante", value: "VISITOR" },
  { label: "Criança", value: "CHILD" },
];

export const receivedByOptions: SelectOption[] = [
  { label: "Batismo", value: "BAPTISM" },
  { label: "Carta de transferência", value: "LETTER" },
  { label: "Aclamação", value: "ACCLAMATION" },
  { label: "Reconciliação", value: "RECONCILIATION" },
  { label: "Transferência", value: "TRANSFER" },
  { label: "Outro", value: "OTHER" },
];

export const educationLevelOptions: SelectOption[] = [
  {
    label: "Ensino fundamental incompleto",
    value: "Ensino fundamental incompleto",
  },
  {
    label: "Ensino fundamental completo",
    value: "Ensino fundamental completo",
  },
  { label: "Ensino médio incompleto", value: "Ensino médio incompleto" },
  { label: "Ensino médio completo", value: "Ensino médio completo" },
  { label: "Ensino superior incompleto", value: "Ensino superior incompleto" },
  { label: "Ensino superior completo", value: "Ensino superior completo" },
  { label: "Pós-graduação", value: "Pós-graduação" },
  { label: "Outro", value: "Outro" },
];

export const brazilianStateOptions: SelectOption[] = [
  { label: "AC", value: "AC" },
  { label: "AL", value: "AL" },
  { label: "AP", value: "AP" },
  { label: "AM", value: "AM" },
  { label: "BA", value: "BA" },
  { label: "CE", value: "CE" },
  { label: "DF", value: "DF" },
  { label: "ES", value: "ES" },
  { label: "GO", value: "GO" },
  { label: "MA", value: "MA" },
  { label: "MT", value: "MT" },
  { label: "MS", value: "MS" },
  { label: "MG", value: "MG" },
  { label: "PA", value: "PA" },
  { label: "PB", value: "PB" },
  { label: "PR", value: "PR" },
  { label: "PE", value: "PE" },
  { label: "PI", value: "PI" },
  { label: "RJ", value: "RJ" },
  { label: "RN", value: "RN" },
  { label: "RS", value: "RS" },
  { label: "RO", value: "RO" },
  { label: "RR", value: "RR" },
  { label: "SC", value: "SC" },
  { label: "SP", value: "SP" },
  { label: "SE", value: "SE" },
  { label: "TO", value: "TO" },
];
