export type MemberImportBatchStatus =
  | "DRAFT"
  | "REVIEW"
  | "READY"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED"
  | "ROLLED_BACK";

export type MemberImportClassification =
  | "VALID"
  | "WARNING"
  | "ERROR"
  | "SKIPPED"
  | "IMPORTED";

export type MemberImportDecision = "PENDING" | "IMPORT" | "IMPORT_ANYWAY" | "SKIP";
export type MemberImportIssueSeverity = "INFO" | "WARNING" | "ERROR";

export type MemberImportIssue = {
  code: string;
  field: string;
  severity: MemberImportIssueSeverity;
  message: string;
  resolved: boolean;
  resolution: string | null;
  relatedMemberId?: string | null;
  relatedMemberName?: string | null;
  relatedMemberArchived?: boolean;
};

export type MemberImportSourceData = {
  nome: string;
  fone: string;
  dtnascimento: string;
  cargo: string;
  cpf: string;
  estadocivil: string;
  dtcadastro: string;
  sexo: string;
  cep: string;
  cidade: string;
  estado: string;
  naturalidade_cidade: string;
  naturalidade_uf: string;
  nome_pai: string;
  nome_mae: string;
  data_batismo_agua: string;
  data_batismo_espirito: string;
  data_conversao: string;
};

export type ParsedMemberImportRow = {
  rowNumber: number;
  sourceData: MemberImportSourceData;
  fullName: string;
  normalizedNameKey: string;
  phoneRaw: string;
  whatsapp: string | null;
  birthDate: string | null;
  roleRaw: string;
  cpf: string | null;
  maritalStatusRaw: string;
  maritalStatus: string | null;
  receivedDate: string | null;
  genderRaw: string;
  gender: "MALE" | "FEMALE" | null;
  zipCode: string | null;
  city: string | null;
  state: string | null;
  naturalCity: string | null;
  naturalState: string | null;
  fatherName: string | null;
  motherName: string | null;
  baptismDate: string | null;
  holySpiritBaptismDate: string | null;
  conversionDate: string | null;
  issues: MemberImportIssue[];
};

export type ParsedMemberImportFile = {
  worksheetName: string;
  recognizedColumns: string[];
  ignoredColumns: string[];
  emptyRows: number;
  rows: ParsedMemberImportRow[];
};

export type MemberImportRoleOption = {
  id: string;
  name: string;
  femaleName: string | null;
  abbreviation: string | null;
  femaleAbbreviation: string | null;
  displayOrder: number;
};

export type MemberImportCongregationOption = { id: string; name: string };

export type MemberImportBatch = {
  id: string;
  churchId: string;
  churchName: string;
  congregationId: string;
  congregationName: string;
  originalFilename: string;
  worksheetName: string;
  fileSizeBytes: number;
  fileSha256: string;
  status: MemberImportBatchStatus;
  totalRows: number;
  validRows: number;
  warningRows: number;
  errorRows: number;
  skippedRows: number;
  importedRows: number;
  settingsSnapshot: Record<string, unknown>;
  failureMessage: string | null;
  createdBy: string;
  createdByName: string;
  validatedAt: string | null;
  confirmedAt: string | null;
  completedAt: string | null;
  rolledBackAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MemberImportItem = {
  id: string;
  rowNumber: number;
  sourceData: MemberImportSourceData;
  fullName: string;
  phoneRaw: string | null;
  whatsapp: string | null;
  birthDate: string | null;
  roleRaw: string;
  roleId: string | null;
  roleName: string | null;
  roleTitleVariant: "AUTO" | "DEFAULT" | "FEMALE";
  cpf: string | null;
  maritalStatusRaw: string | null;
  maritalStatus: string | null;
  receivedDate: string | null;
  genderRaw: string | null;
  gender: "MALE" | "FEMALE" | null;
  zipCode: string | null;
  city: string | null;
  state: string | null;
  naturalCity: string | null;
  naturalState: string | null;
  fatherName: string | null;
  motherName: string | null;
  baptismDate: string | null;
  holySpiritBaptismDate: string | null;
  conversionDate: string | null;
  classification: MemberImportClassification;
  decision: MemberImportDecision;
  issues: MemberImportIssue[];
  importedMemberId: string | null;
  importedMemberCode: string | null;
};

export type MemberImportItemsResult = {
  items: MemberImportItem[];
  total: number;
  page: number;
  pageSize: 20 | 50 | 100;
  pageCount: number;
};

export type MemberImportReviewParams = {
  page: number;
  pageSize: 20 | 50 | 100;
  search: string;
  classification: string;
};

export type MemberImportRoleMapping = {
  rawValue: string;
  count: number;
  roleId: string | null;
  roleName: string | null;
  status: "RECOGNIZED" | "REQUIRES_MAPPING";
};

export type MemberImportMaritalMapping = {
  rawValue: string;
  count: number;
  value: string | null;
  label: string | null;
  status: "RECOGNIZED" | "REQUIRES_MAPPING";
};

export type MemberImportHistoryItem = {
  id: string;
  createdAt: string;
  congregationName: string;
  originalFilename: string;
  createdByName: string;
  importedRows: number;
  warningRows: number;
  status: MemberImportBatchStatus;
};

export type MemberImportHistory = {
  items: MemberImportHistoryItem[];
  stats: { completed: number; imported: number; warnings: number; rolledBack: number };
};

export type MemberImportWorkspaceData = {
  congregations: MemberImportCongregationOption[];
  roles: MemberImportRoleOption[];
  batch: MemberImportBatch | null;
  items: MemberImportItemsResult | null;
  roleMappings: MemberImportRoleMapping[];
  maritalMappings: MemberImportMaritalMapping[];
  history: MemberImportHistory;
};

export type MemberImportActionResult<T = undefined> =
  | { success: true; message: string; data: T }
  | { success: false; message: string; code?: string; existingBatchId?: string };
