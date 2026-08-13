import type { SelectOption } from "./member-form.types";

export type MemberStatus = "ACTIVE" | "INACTIVE" | "TRANSFERRED" | "DISCIPLINED" | "DECEASED";
export type MemberType = "MEMBER" | "CONGREGATED" | "VISITOR" | "CHILD";
export type MemberSort = "name_asc" | "name_desc" | "recent" | "oldest" | "code";

export type MemberListParams = {
  page: number;
  pageSize: 20 | 50 | 100;
  search: string;
  congregationId: string;
  regionId: string;
  roleId: string;
  status: string;
  memberType: string;
  importBatchId: string;
  archived: boolean;
  sort: MemberSort;
};

export type MemberListItem = {
  id: string;
  memberCode: string | null;
  fullName: string;
  gender: string | null;
  memberStatus: MemberStatus;
  memberType: MemberType;
  whatsapp: string | null;
  congregationId: string;
  congregationName: string;
  regionName: string | null;
  role: string | null;
  createdAt: string;
  updatedAt: string;
  archived: boolean;
};

export type MemberListResult = {
  items: MemberListItem[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

export type MemberStats = {
  total: number;
  active: number;
  inactive: number;
  visitors: number;
  archived: number;
};

export type MemberFilters = {
  congregations: SelectOption[];
  regions: SelectOption[];
  roles: SelectOption[];
};

export type MemberCapabilities = {
  create: boolean;
  update: boolean;
  changeStatus: boolean;
  transfer: boolean;
  archive: boolean;
  restore: boolean;
  viewFull: boolean;
  viewSensitiveIdentity: boolean;
  manageSensitiveIdentity: boolean;
  viewPastoralNotes: boolean;
  editPastoralNotes: boolean;
  viewHistory: boolean;
  createHistory: boolean;
  viewSensitiveHistory: boolean;
  viewFinance: boolean;
  viewDocuments: boolean;
  manageDocuments: boolean;
  viewSensitiveDocuments: boolean;
  viewRoles: boolean;
  manageRoles: boolean;
  import: boolean;
};

export type MemberCoreDetails = {
  id: string;
  memberCode: string | null;
  fullName: string;
  gender: string | null;
  birthDate: string | null;
  maritalStatus: string | null;
  nationality: string | null;
  naturalCity: string | null;
  naturalState: string | null;
  profession: string | null;
  educationLevel: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string;
  fatherName: string | null;
  motherName: string | null;
  spouseName: string | null;
  congregationName: string;
  regionName: string | null;
  memberStatus: MemberStatus;
  memberType: MemberType;
  conversionDate: string | null;
  baptismDate: string | null;
  baptismChurch: string | null;
  hasHolySpiritBaptism: boolean;
  holySpiritBaptismDate: string | null;
  previousChurch: string | null;
  receivedBy: string | null;
  receivedDate: string | null;
  letterOriginChurch: string | null;
  notes: string | null;
  pastoralNotes: string | null;
  cpf: string | null;
  rg: string | null;
  issuingAgency: string | null;
  roles: MemberRoleItem[];
  createdAt: string;
  updatedAt: string;
  archived: boolean;
};

export type MemberRoleItem = {
  id: string;
  roleId: string;
  name: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  notes: string | null;
};

export type MemberHistoryItem = {
  id: string;
  type: string;
  title: string;
  description: string | null;
  oldValue: string | null;
  newValue: string | null;
  eventDate: string;
  sensitive: boolean;
  createdAt: string;
};

export type MemberFinanceItem = {
  id: string;
  transactionNumber: string | null;
  transactionType: string;
  description: string | null;
  amount: number;
  transactionDate: string;
  status: string;
  category: string;
  paymentMethod: string | null;
};

export type MemberDocumentItem = {
  id: string;
  type: string;
  title: string;
  description: string | null;
  fileName: string;
  mimeType: string | null;
  fileSize: number | null;
  sensitive: boolean;
  uploadedAt: string;
};

export type PaginatedTab<T> = { items: T[]; total: number; page: number; pageCount: number };

export type MemberLifecycleInput = {
  memberId: string;
  action: "MOVE_CONGREGATION" | "INACTIVATE" | "REACTIVATE" | "TRANSFER" | "DISCIPLINE" | "END_DISCIPLINE" | "DECEASED" | "ARCHIVE" | "RESTORE";
  eventDate: string;
  reason: string;
  targetCongregationId?: string;
  destinationChurch?: string;
  expectedEndDate?: string;
  endRoles?: boolean;
  reactivateRole?: boolean;
};

export type MemberActionResponse<T = undefined> =
  | { success: true; message: string; data?: T }
  | { success: false; message: string };
