export type MemberFormStepId =
  | "personal"
  | "contact"
  | "family"
  | "ministerial"
  | "ecclesiastical"
  | "review";

export type SelectOption = {
  label: string;
  value: string;
  description?: string;
};

export type MemberFormOptions = {
  churches: SelectOption[];
  congregations: SelectOption[];
  roles: SelectOption[];
  ministries: SelectOption[];
  hasLoadError: boolean;
  loadErrorMessage?: string;
};

export type MemberFormData = {
  photo_url: string;
  full_name: string;
  preferred_name: string;
  gender: string;
  birth_date: string;
  marital_status: string;
  wedding_date: string;
  nationality: string;
  natural_city: string;
  natural_state: string;
  cpf: string;
  rg: string;
  issuing_agency: string;
  profession: string;
  education_level: string;
  physical_file_number: string;

  phone: string;
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
  guardian_name: string;
  guardian_phone: string;

  church_id: string;
  congregation_id: string;
  member_type: string;
  member_status: string;
  main_role_id: string;
  ministry_id: string;
  is_public_worker: boolean;
  is_active_in_ministry: boolean;
  can_receive_notifications: boolean;

  joined_at: string;
  conversion_date: string;
  baptism_date: string;
  baptism_church: string;
  child_presentation_date: string;
  has_holy_spirit_baptism: boolean;
  holy_spirit_baptism_date: string;
  previous_church: string;
  received_by: string;
  received_date: string;
  letter_origin_church: string;
  letter_destination_church: string;
  transfer_date: string;
  inactive_reason: string;

  notes: string;
  pastoral_notes: string;
};

export type MemberFormErrors = Partial<Record<keyof MemberFormData, string>>;

export type MemberFormStep = {
  id: MemberFormStepId;
  title: string;
  description: string;
};
