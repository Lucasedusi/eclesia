export type EventStatus =
  | "DRAFT"
  | "PUBLISHED"
  | "IN_PROGRESS"
  | "FINISHED"
  | "CANCELLED";

export type EventRegistrationStatus = "OPEN" | "CLOSED";

export type EventScope = "CHURCH" | "REGION" | "CONGREGATION" | "MINISTRY";

export type EventSummary = {
  id: string;
  name: string;
  slug: string | null;
  publicCode: string;
  eventType: string;
  visibility: string;
  scope: EventScope;
  status: EventStatus;
  registrationStatus: EventRegistrationStatus;
  registrationsOpenedAt: string | null;
  registrationsClosedAt: string | null;
  startsAt: string;
  endsAt: string | null;
  location: string | null;
  city: string | null;
  state: string | null;
  capacity: number | null;
  occupied: number;
  waitlist: number;
  bannerUrl: string | null;
  deletedAt: string | null;
};

export type EventStats = { total: number; draft: number; open: number; upcoming: number; finished: number; cancelled: number };
export type EventListData = { events: EventSummary[]; total: number; page: number; pageSize: number; stats: EventStats };

export type EventDetail = EventSummary & {
  hasRegistrations: boolean;
  churchId: string;
  description: string | null;
  timezone: string;
  registrationMode: string;
  requiresPayment: boolean;
  requiresGroupResponsible: boolean;
  requiresPastorInfo: boolean;
  requiresGenderTotals: boolean;
  regionId: string | null;
  congregationId: string | null;
  ministryId: string | null;
  address: string | null;
  number: string | null;
  complement: string | null;
  district: string | null;
  zipCode: string | null;
  country: string;
  notes: string | null;
  settings: Record<string, unknown>;
  paymentSettings: EventPaymentSettings;
  registrationFields: EventRegistrationFieldRow[];
};

export type EventPaymentSettings = {
  allowParticipantList: boolean;
  caravanRegistrationItemId: string;
  pixEnabled: boolean;
  pixKey: string;
  pixHolderName: string;
  pixQrUrl: string | null;
  cashEnabled: boolean;
  whatsappNumber: string;
  paymentInstructions: string;
};

export type RegistrationRow = {
  id: string;
  registrationNumber: string | null;
  memberId: string | null;
  participantName: string;
  participantType: "MEMBER" | "VISITOR";
  participantGender: string | null;
  participantPhone: string | null;
  participantEmail: string | null;
  participantDocument: string | null;
  participantBirthDate: string | null;
  participantCity: string | null;
  participantState: string | null;
  responsibleName: string | null;
  responsiblePhone: string | null;
  participantRoleId: string | null;
  participantRoleName: string | null;
  congregationId: string | null;
  congregationName: string | null;
  regionId: string | null;
  regionName: string | null;
  preferredPaymentMethod: string | null;
  status: string;
  paymentStatus: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  registeredAt: string;
  updatedAt: string;
  groupId: string | null;
  itemIds: string[];
  itemNames: string[];
  itemQuantities: Record<string, number>;
  customFieldValues: Record<string, unknown>;
};

export type PaymentRow = {
  id: string;
  paymentNumber: string | null;
  registrationId: string | null;
  groupId: string | null;
  method: string;
  status: string;
  amount: number;
  paidAt: string | null;
  payerName: string | null;
  receiptFileName: string | null;
  receiptMimeType: string | null;
  receiptFileSize: number | null;
  receiptStoragePath: string | null;
  source: "INTERNAL" | "PUBLIC";
  notes: string | null;
  createdAt: string;
  confirmedBy: string | null;
};

export type CheckinRow = { id: string; registrationId: string; registrationNumber: string | null; participantName: string; method: string; checkedInAt: string | null; status: string };
export type GroupItemRow = { id: string; itemId: string; name: string; quantity: number; unitPrice: number; totalPrice: number };
export type GroupRow = {
  id: string;
  groupNumber: string;
  source: "INTERNAL" | "PUBLIC";
  responsibleName: string;
  responsiblePhone: string;
  responsibleEmail: string | null;
  originChurchName: string;
  originCity: string;
  originState: string;
  pastorName: string;
  pastorPhone: string | null;
  total: number;
  maleCount: number;
  femaleCount: number;
  unspecifiedCount: number;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  paymentStatus: string;
  status: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  items: GroupItemRow[];
  listDocumentId: string | null;
  listFileName: string | null;
};
export type EventItemRow = { id: string; name: string; description: string | null; type: string; price: number; required: boolean; active: boolean; allowQuantity: boolean; minQuantity: number; maxQuantity: number | null; availableQuantity: number | null };
export type EventQuotaRow = { id: string; label: string; quotaTotal: number; used: number; targetId: string };
export type EventDocumentRow = { id: string; groupId: string | null; paymentId: string | null; title: string; type: string; fileName: string; mimeType: string | null; fileSize: number | null; uploadedAt: string };
export type EventExpenseRow = {
  id: string;
  name: string;
  expenseDate: string;
  amount: number;
  receiptFileName: string | null;
  receiptMimeType: string | null;
  receiptFileSize: number | null;
  receiptStoragePath: string | null;
  uploadStatus: "NONE" | "PENDING" | "ACTIVE" | "FAILED";
  createdAt: string;
  updatedAt: string;
};
export type EventRegistrationFieldType = "SHORT_TEXT" | "LONG_TEXT" | "DATE" | "NUMBER" | "SINGLE_SELECT" | "BOOLEAN";
export type EventRegistrationFieldVisibility = "HIDDEN" | "OPTIONAL" | "REQUIRED";
export type EventRegistrationFieldRow = {
  id: string;
  key: string;
  kind: "STANDARD" | "CUSTOM";
  label: string;
  helpText: string | null;
  type: EventRegistrationFieldType;
  visibility: EventRegistrationFieldVisibility;
  options: string[];
  sortOrder: number;
  active: boolean;
  systemLocked: boolean;
};
export type EventReference = { id: string; name: string };
export type EventRoleReference = EventReference & { femaleName: string | null };
export type EventCongregationReference = EventReference & { regionId: string | null; regionName: string | null };
export type EventMemberReference = { id: string; fullName: string; congregationId: string; congregationName: string; regionId: string | null; regionName: string | null; phone: string | null; gender: string | null; roleId: string | null; roleName: string | null };

export type EventWorkspaceData = {
  event: EventDetail;
  permissions: string[];
  registrations: RegistrationRow[];
  groups: GroupRow[];
  items: EventItemRow[];
  quotas: EventQuotaRow[];
  payments: PaymentRow[];
  checkins: CheckinRow[];
  documents: EventDocumentRow[];
  expenses: EventExpenseRow[];
  registrationFields: EventRegistrationFieldRow[];
  references: { regions: EventReference[]; congregations: EventCongregationReference[]; roles: EventRoleReference[] };
};

export type EventGeneralReportFilters = {
  regionId: string;
  congregationId: string;
  roleId: string;
  gender: "" | "MALE" | "FEMALE";
  registrationStatus: string;
  paymentMethod: string;
  paymentStatus: string;
  itemId: string;
  registeredFrom: string;
  registeredTo: string;
};

export type EventGeneralReportSections = {
  showSummary: boolean;
  showRegions: boolean;
  showCongregations: boolean;
  showRoles: boolean;
  showGenders: boolean;
  includeZeroCongregations: boolean;
  showAppliedFilters: boolean;
  showIssuedAt: boolean;
};

export type EventGeneralReportColumns = {
  regionalCoordinator: boolean;
  regionalQuota: boolean;
  regionalPercentage: boolean;
  congregationPastor: boolean;
  congregationQuota: boolean;
  congregationPercentage: boolean;
};

export type EventGeneralReportConfig = {
  filters: EventGeneralReportFilters;
  sections: EventGeneralReportSections;
  columns: EventGeneralReportColumns;
  organization: "BY_REGION" | "ALPHABETICAL";
};

export type EventReportRegionSource = {
  id: string;
  name: string;
  coordinatorName: string | null;
  displayOrder: number;
};

export type EventReportCongregationSource = {
  id: string;
  name: string;
  regionId: string | null;
  pastorName: string | null;
  displayOrder: number;
};

export type EventReportRegistrationSource = {
  id: string;
  congregationId: string | null;
  roleId: string | null;
  roleName: string | null;
  gender: string | null;
};

export type EventReportRegionRow = {
  id: string;
  name: string;
  coordinatorName: string | null;
  quota: number | null;
  registrations: number;
  percentage: number | null;
  displayOrder: number;
  unassigned: boolean;
};

export type EventReportCongregationRow = {
  id: string;
  name: string;
  pastorName: string | null;
  regionId: string | null;
  regionName: string;
  regionDisplayOrder: number;
  quota: number | null;
  registrations: number;
  percentage: number | null;
  unassigned: boolean;
};

export type EventReportRoleRow = {
  id: string;
  name: string;
  registrations: number;
  unassigned: boolean;
};

export type EventReportGenderRow = {
  id: "FEMALE" | "MALE" | "UNSPECIFIED";
  name: string;
  registrations: number;
};

export type EventGeneralReportPreview = {
  event: { id: string; name: string; publicCode: string };
  churchName: string;
  issuedAt: string;
  orientation: "portrait" | "landscape";
  totalRegistrations: number;
  regionCount: number;
  congregationCount: number;
  roleCount: number;
  genderCount: number;
  activeFilterCount: number;
  periodLabel: string | null;
  appliedFilters: { label: string; value: string }[];
  regions: EventReportRegionRow[];
  congregations: EventReportCongregationRow[];
  roles: EventReportRoleRow[];
  genders: EventReportGenderRow[];
  config: EventGeneralReportConfig;
};

export type EventParticipantReportColumns = {
  index: boolean;
  registrationNumber: boolean;
  role: boolean;
  gender: boolean;
  phone: boolean;
  registrationStatus: boolean;
  paymentMethod: boolean;
  paymentStatus: boolean;
  registeredAt: boolean;
  items: boolean;
};

export type EventParticipantReportConfig = {
  filters: EventGeneralReportFilters;
  columns: EventParticipantReportColumns;
  organization: "BY_REGION" | "ALPHABETICAL";
  showAppliedFilters: boolean;
  showIssuedAt: boolean;
};

export type EventParticipantReportSource = {
  id: string;
  registrationNumber: string | null;
  participantName: string;
  participantGender: string | null;
  participantPhone: string | null;
  roleName: string | null;
  congregationId: string | null;
  congregationName: string | null;
  congregationDisplayOrder: number;
  regionId: string | null;
  regionName: string | null;
  regionDisplayOrder: number;
  registrationStatus: string;
  paymentMethod: string | null;
  paymentStatus: string;
  registeredAt: string;
  itemNames: string[];
};

export type EventParticipantReportRow = EventParticipantReportSource & {
  index: number;
  congregationAndRegion: string;
};

export type EventParticipantReportPreview = {
  event: { id: string; name: string; publicCode: string };
  churchName: string;
  issuedAt: string;
  orientation: "portrait";
  totalParticipants: number;
  regionCount: number;
  congregationCount: number;
  selectedColumnCount: number;
  activeFilterCount: number;
  appliedFilters: { label: string; value: string }[];
  participants: EventParticipantReportRow[];
  config: EventParticipantReportConfig;
};

export type EventFinancialReportSections = {
  showSummary: boolean;
  showPaymentMethods: boolean;
  showItems: boolean;
  showExpenses: boolean;
  showAppliedFilters: boolean;
  showIssuedAt: boolean;
};

export type EventFinancialReportColumns = {
  summaryExpectedAmount: boolean;
  summaryPendingAmount: boolean;
  summaryPaidRegistrationCount: boolean;
  paymentConfirmedCount: boolean;
  paymentPercentage: boolean;
  itemParticipantCount: boolean;
  itemExpectedAmount: boolean;
  expenseIndex: boolean;
  expenseReceipt: boolean;
};

export type EventFinancialReportConfig = {
  scope: "GENERAL" | "ENTRIES_ONLY" | "EXPENSES_ONLY" | "CUSTOM";
  filters: EventGeneralReportFilters;
  expenseFilters: { name: string; from: string; to: string };
  sections: EventFinancialReportSections;
  columns: EventFinancialReportColumns;
  organization: "HIGHEST_VALUE" | "HIGHEST_QUANTITY" | "ALPHABETICAL";
  expenseOrganization: "DATE_DESC" | "HIGHEST_VALUE" | "ALPHABETICAL";
};

export type EventFinancialRegistrationSource = {
  id: string;
  groupId: string | null;
  paymentStatus: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
};

export type EventFinancialPaymentSource = {
  id: string;
  registrationId: string | null;
  groupId: string | null;
  method: string;
  status: string;
  amount: number;
  paidAt: string | null;
};

export type EventFinancialItemSource = {
  id: string;
  registrationId: string | null;
  groupId: string | null;
  itemId: string;
  itemName: string;
  quantity: number;
  expectedAmount: number;
};

export type EventFinancialPaymentMethodRow = {
  id: string;
  name: string;
  confirmedPaymentCount: number;
  amountReceived: number;
  percentage: number;
};

export type EventFinancialItemRow = {
  id: string;
  name: string;
  participantCount: number;
  units: number;
  expectedAmount: number;
};

export type EventFinancialExpenseSource = {
  id: string;
  name: string;
  expenseDate: string;
  amount: number;
  hasReceipt: boolean;
};

export type EventFinancialExpenseRow = EventFinancialExpenseSource & { index: number };

export type EventFinancialReportPreview = {
  event: { id: string; name: string; publicCode: string };
  churchName: string;
  issuedAt: string;
  orientation: "portrait";
  totalReceived: number;
  totalExpenses: number;
  balance: number;
  expectedAmount: number;
  pendingAmount: number;
  paidRegistrationCount: number;
  filteredRegistrationCount: number;
  paymentMethodCount: number;
  itemCount: number;
  totalItemUnits: number;
  selectedSectionCount: number;
  activeFilterCount: number;
  appliedFilters: { label: string; value: string }[];
  paymentMethods: EventFinancialPaymentMethodRow[];
  items: EventFinancialItemRow[];
  expenses: EventFinancialExpenseRow[];
  config: EventFinancialReportConfig;
};

export type EventCaravanReportFilters = {
  city: string;
  state: string;
  source: "" | "INTERNAL" | "PUBLIC";
  paymentStatus: string;
  registeredFrom: string;
  registeredTo: string;
};

export type EventCaravanReportColumns = {
  index: boolean;
  originChurch: boolean;
  responsible: boolean;
};

export type EventCaravanReportConfig = {
  filters: EventCaravanReportFilters;
  columns: EventCaravanReportColumns;
  organization: "HIGHEST_REGISTRATIONS" | "ALPHABETICAL";
  showAppliedFilters: boolean;
  showIssuedAt: boolean;
};

export type EventCaravanReportSource = {
  id: string;
  city: string;
  state: string;
  originChurch: string;
  pastorName: string;
  responsibleName: string;
  totalRegistrations: number;
  source: "INTERNAL" | "PUBLIC";
  paymentStatus: string;
  registeredAt: string;
};

export type EventCaravanReportRow = EventCaravanReportSource & { index: number; cityAndState: string };

export type EventCaravanReportPreview = {
  event: { id: string; name: string; publicCode: string };
  churchName: string;
  issuedAt: string;
  orientation: "portrait";
  totalCaravans: number;
  totalRegistrations: number;
  cityCount: number;
  selectedColumnCount: number;
  activeFilterCount: number;
  appliedFilters: { label: string; value: string }[];
  caravans: EventCaravanReportRow[];
  config: EventCaravanReportConfig;
};

export type ActionResult<T = undefined> = T extends undefined
  ? { status: "success"; message: string } | { status: "error"; message: string; fieldErrors?: Record<string, string[]> }
  : { status: "success"; message: string; data: T } | { status: "error"; message: string; fieldErrors?: Record<string, string[]> };

export type PublicCheckoutItem = {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
};

export type PublicCheckoutStatus = {
  checkoutId: string;
  eventId: string;
  eventName: string;
  eventStartsAt: string;
  eventLocation: string | null;
  registrationId: string;
  registrationNumber: string;
  participantName: string;
  congregationName: string | null;
  regionName: string | null;
  registeredAt: string;
  confirmedAt: string | null;
  registrationStatus: string;
  paymentStatus: string;
  paymentMethod: "PIX" | "CASH" | "DEBIT_CARD" | "CREDIT_CARD" | "NOT_APPLICABLE";
  checkoutStatus: string;
  totalAmount: number;
  items: PublicCheckoutItem[];
  expiresAt: string | null;
  credentialToken: string | null;
  providerPaymentId: string | null;
  providerStatus: string | null;
  paymentSimulationEnabled: boolean;
  isSimulatedPayment: boolean;
  pix?: {
    qrCode: string | null;
    qrCodeBase64: string | null;
    ticketUrl: string | null;
    isSimulated: boolean;
  } | null;
};

export type PublicCaravanTrackingStatus = {
  eventId: string;
  eventName: string;
  eventStartsAt: string;
  eventLocation: string | null;
  groupId: string;
  groupNumber: string;
  originChurchName: string;
  originCity: string;
  originState: string;
  responsibleName: string;
  responsiblePhone: string;
  pastorName: string;
  totalRegistrations: number;
  maleCount: number;
  femaleCount: number;
  registrationStatus: string;
  paymentStatus: string;
  paymentMethod: "PIX" | "CASH" | "NOT_APPLICABLE";
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  registeredAt: string;
  updatedAt: string;
  items: PublicCheckoutItem[];
};

export type PublicTrackingStatus =
  | { kind: "INDIVIDUAL"; status: string; data: PublicCheckoutStatus }
  | { kind: "CARAVAN"; status: string; data: PublicCaravanTrackingStatus };
