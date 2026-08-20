export type EventStatus =
  | "DRAFT"
  | "PUBLISHED"
  | "REGISTRATION_OPEN"
  | "REGISTRATION_CLOSED"
  | "IN_PROGRESS"
  | "FINISHED"
  | "CANCELLED";

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
  startsAt: string;
  endsAt: string | null;
  registrationStartsAt: string | null;
  registrationEndsAt: string | null;
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
};

export type RegistrationRow = {
  id: string;
  registrationNumber: string | null;
  memberId: string | null;
  participantName: string;
  participantType: "MEMBER" | "VISITOR";
  participantGender: string | null;
  participantPhone: string | null;
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
  groupId: string | null;
  itemIds: string[];
  itemNames: string[];
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
};

export type CheckinRow = { id: string; registrationId: string; registrationNumber: string | null; participantName: string; method: string; checkedInAt: string | null; status: string };
export type GroupRow = { id: string; responsibleName: string; originChurchName: string | null; originCity: string; originState: string; total: number; status: string };
export type EventItemRow = { id: string; name: string; description: string | null; type: string; price: number; required: boolean; active: boolean; availableQuantity: number | null };
export type EventQuotaRow = { id: string; label: string; quotaTotal: number; used: number; targetId: string };
export type EventDocumentRow = { id: string; title: string; type: string; fileName: string; mimeType: string | null; fileSize: number | null; uploadedAt: string };
export type EventReference = { id: string; name: string };
export type EventCongregationReference = EventReference & { regionId: string | null; regionName: string | null };
export type EventMemberReference = { id: string; fullName: string; congregationId: string; congregationName: string; regionId: string | null; regionName: string | null; phone: string | null; gender: string | null };

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
  references: { regions: EventReference[]; congregations: EventCongregationReference[] };
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
