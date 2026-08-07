export type MemberFormStepId =
  | "personal"
  | "contact"
  | "family"
  | "bond"
  | "ecclesiastical"
  | "review";

export type SelectOption = {
  label: string;
  value: string;
  description?: string;
};

export type MemberFormOptions = {
  churchName: string;
  congregations: SelectOption[];
  roles: SelectOption[];
  canManageSensitiveIdentity: boolean;
  canEditPastoralNotes: boolean;
  canManageRoles: boolean;
  hasLoadError: boolean;
  loadErrorMessage?: string;
};

export type MemberFormData = {
  full_name: string;
  gender: string;
  birth_date: string;
  marital_status: string;
  nationality: string;
  natural_city: string;
  natural_state: string;
  cpf: string;
  rg: string;
  issuing_agency: string;
  profession: string;
  education_level: string;
  whatsapp: string;
  email: string;
  zip_code: string;
  address: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
  country: string;
  father_name: string;
  mother_name: string;
  spouse_name: string;
  congregation_id: string;
  member_type: string;
  main_role_id: string;
  role_start_date: string;
  conversion_date: string;
  baptism_date: string;
  baptism_church: string;
  has_holy_spirit_baptism: boolean;
  holy_spirit_baptism_date: string;
  previous_church: string;
  received_by: string;
  received_date: string;
  letter_origin_church: string;
  notes: string;
  pastoral_notes: string;
};

export type MemberFormErrors = Partial<Record<keyof MemberFormData, string>>;

export type MemberFormStep = {
  id: MemberFormStepId;
  title: string;
  description: string;
};

export type MemberFormMode = "create" | "edit";

export type MemberFormInitialData = MemberFormData & {
  id: string;
  updated_at: string;
};
