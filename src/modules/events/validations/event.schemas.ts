import { z } from "zod";
import { isValidCpf } from "@/utils/input-masks";

const optionalText = z.string().trim().max(500).optional().default("");
const optionalUuid = z.union([z.literal(""), z.uuid()]).optional().default("");
const dateTime = z.string().min(1, "Informe a data e hora.").refine((value) => !Number.isNaN(Date.parse(value)), "Data inválida.");

export const registrationFieldSchema = z.object({
  id: optionalUuid,
  key: z.string().trim().regex(/^[a-z][a-z0-9_]{1,79}$/),
  kind: z.enum(["STANDARD", "CUSTOM"]),
  label: z.string().trim().min(2).max(150),
  helpText: z.string().trim().max(300).optional().default(""),
  type: z.enum(["SHORT_TEXT", "LONG_TEXT", "DATE", "NUMBER", "SINGLE_SELECT", "BOOLEAN"]),
  visibility: z.enum(["HIDDEN", "OPTIONAL", "REQUIRED"]),
  options: z.array(z.string().trim().min(1).max(80)).max(50).default([]),
  sortOrder: z.coerce.number().int().min(0),
  active: z.coerce.boolean(),
  systemLocked: z.coerce.boolean(),
}).superRefine((data, ctx) => {
  if (data.type === "SINGLE_SELECT" && data.kind === "CUSTOM" && data.options.length === 0) {
    ctx.addIssue({ code: "custom", path: ["options"], message: "Informe ao menos uma opção." });
  }
});

export const eventIdSchema = z.uuid("Evento inválido.");
export const eventListSchema = z.object({
  search: z.string().trim().max(120).default(""),
  status: z.string().trim().max(40).default("OPEN").transform((value) => value || "OPEN"),
  type: z.string().trim().max(40).default(""),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(10).max(100).default(20),
});

export const eventFormSchema = z.object({
  id: optionalUuid,
  name: z.string().trim().min(3, "Informe um nome com ao menos 3 caracteres.").max(160),
  slug: z.string().trim().max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use somente letras minúsculas, números e hífens.").or(z.literal("")),
  description: z.string().trim().max(5000).optional().default(""),
  eventType: z.enum(["CONFERENCE", "CAMP", "RETREAT", "COURSE", "MEETING", "SERVICE", "CONGRESS", "TRAINING", "DINNER", "SYMPOSIUM", "OTHER"]),
  visibility: z.enum(["PUBLIC", "INTERNAL", "PRIVATE"]),
  eventScope: z.enum(["CHURCH", "REGION", "CONGREGATION", "MINISTRY"]),
  regionId: optionalUuid,
  congregationId: optionalUuid,
  ministryId: optionalUuid,
  startsAt: dateTime,
  endsAt: z.string().optional().default(""),
  timezone: z.string().trim().min(1).max(80).default("America/Sao_Paulo"),
  registrationMode: z.enum(["INDIVIDUAL", "MIXED"]),
  capacity: z.union([z.literal(""), z.coerce.number().int().min(0)]).optional().default(""),
  requiresPayment: z.coerce.boolean().default(false),
  requiresGroupResponsible: z.coerce.boolean().default(false),
  requiresPastorInfo: z.coerce.boolean().default(false),
  requiresGenderTotals: z.coerce.boolean().default(false),
  locationName: optionalText,
  zipCode: optionalText,
  address: optionalText,
  number: optionalText,
  complement: optionalText,
  district: optionalText,
  city: optionalText,
  state: z.string().trim().max(2).optional().default(""),
  country: z.string().trim().max(80).default("Brasil"),
  notes: z.string().trim().max(3000).optional().default(""),
  caravanSettings: z.object({
    allowParticipantList: z.coerce.boolean().default(true),
    caravanRegistrationItemId: optionalUuid,
    pixEnabled: z.coerce.boolean().default(false),
    pixKey: z.string().trim().max(220).optional().default(""),
    pixHolderName: z.string().trim().max(180).optional().default(""),
    cashEnabled: z.coerce.boolean().default(false),
    whatsappNumber: z.string().trim().max(30).optional().default(""),
    paymentInstructions: z.string().trim().max(1500).optional().default(""),
  }).default({ allowParticipantList:true,caravanRegistrationItemId:"",pixEnabled:false,pixKey:"",pixHolderName:"",cashEnabled:false,whatsappNumber:"",paymentInstructions:"" }),
  registrationFields: z.array(registrationFieldSchema).max(40).default([]),
}).superRefine((data, ctx) => {
  if (data.endsAt && Date.parse(data.endsAt) < Date.parse(data.startsAt)) ctx.addIssue({ code: "custom", path: ["endsAt"], message: "O término não pode anteceder o início." });
  const target = data.eventScope === "REGION" ? data.regionId : data.eventScope === "CONGREGATION" ? data.congregationId : data.eventScope === "MINISTRY" ? data.ministryId : "church";
  if (data.eventScope !== "CHURCH" && !target) ctx.addIssue({ code: "custom", path: [`${data.eventScope.toLowerCase()}Id`], message: "Selecione o alvo do escopo." });
  if (data.registrationMode === "MIXED" && data.caravanSettings.pixEnabled) {
    if (!data.caravanSettings.pixKey) ctx.addIssue({ code: "custom", path: ["caravanSettings", "pixKey"], message: "Informe a chave Pix do evento." });
    if (!data.caravanSettings.pixHolderName) ctx.addIssue({ code: "custom", path: ["caravanSettings", "pixHolderName"], message: "Informe o titular da chave Pix." });
  }
});

const registrationBaseSchema = z.object({
  eventId: z.uuid(),
  participantKind: z.enum(["MEMBER", "VISITOR"]),
  memberId: optionalUuid,
  regionId: optionalUuid,
  congregationId: optionalUuid,
  participantName: z.string().trim().min(3, "Informe o nome completo.").max(180),
  participantGender: z.enum(["", "MALE", "FEMALE"]).optional().default(""),
  participantPhone: z.string().trim().max(30).optional().default(""),
  participantEmail: z.union([z.literal(""), z.email("Informe um e-mail válido.")]).optional().default(""),
  participantDocument: z.string().trim().max(40).optional().default(""),
  participantBirthDate: z.string().trim().max(10).optional().default(""),
  participantCity: z.string().trim().max(100).optional().default(""),
  participantState: z.string().trim().max(2).optional().default(""),
  responsibleName: z.string().trim().max(180).optional().default(""),
  responsiblePhone: z.string().trim().max(30).optional().default(""),
  participantRoleId: optionalUuid,
  preferredPaymentMethod: z.enum(["PIX", "CASH", "CREDIT_CARD", "DEBIT_CARD", "NOT_APPLICABLE"]),
  items: z.array(z.object({ itemId: z.uuid(), quantity: z.coerce.number().int().min(1) })).default([]),
  customFields: z.record(z.string(), z.unknown()).default({}),
});

export const registrationSchema = registrationBaseSchema.superRefine((data, ctx) => {
  if (data.participantKind === "MEMBER" && !data.memberId) ctx.addIssue({ code: "custom", path: ["memberId"], message: "Selecione um membro cadastrado." });
});

export const publicRegistrationSchema = registrationBaseSchema.omit({ memberId: true, regionId: true }).extend({
  participantKind: z.literal("VISITOR").default("VISITOR"),
  consentAccepted: z.coerce.boolean().optional().default(true),
  consentVersion: z.string().trim().max(40).default("2026-08"),
});

export const updateRegistrationSchema = registrationBaseSchema.extend({
  registrationId: z.uuid(),
  expectedUpdatedAt: z.string().datetime({ offset: true }),
}).omit({ participantKind: true, memberId: true }).extend({ participantRoleName: z.string().trim().max(150).optional().default("") });

export const expenseSchema = z.object({
  id: optionalUuid,
  eventId: z.uuid(),
  name: z.string().trim().min(2, "Informe o nome da despesa.").max(150),
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data válida.").refine((value) => {
    const [year, month, day] = value.split("-").map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
  }, "Informe uma data válida."),
  amount: z.coerce.number().positive("O valor deve ser maior que zero."),
  expectedUpdatedAt: z.string().optional().default(""),
  receiptPath: z.string().trim().max(900).optional().default(""),
  receiptFileName: z.string().trim().max(220).optional().default(""),
  receiptMimeType: z.string().trim().max(100).optional().default(""),
  receiptFileSize: z.coerce.number().int().min(0).max(10 * 1024 * 1024).optional().default(0),
});

export const publicCheckoutTokenSchema = z.object({
  checkoutToken: z.string().trim().min(40).max(120).regex(/^[A-Za-z0-9_-]+$/),
  refreshProvider: z.coerce.boolean().default(false),
});

export const publicPixPaymentSchema = z.object({
  checkoutToken: z.string().trim().min(40).max(120).regex(/^[A-Za-z0-9_-]+$/),
  payerEmail: z.email("Informe um e-mail válido.").max(180),
  payerCpf: z.string().trim().refine(isValidCpf, "Informe um CPF válido.").transform((value) => value.replace(/\D/g, "")),
});

const caravanItemSchema = z.object({ itemId: z.uuid(), quantity: z.coerce.number().int().min(1) });

const groupBaseSchema = z.object({
  eventId: z.uuid(),
  groupId: optionalUuid,
  expectedUpdatedAt: z.string().optional().default(""),
  originChurchName: z.string().trim().min(2).max(180),
  originFieldName: optionalText,
  originCity: z.string().trim().min(2).max(100),
  originState: z.string().trim().length(2),
  responsibleName: z.string().trim().min(3).max(180),
  responsiblePhone: z.string().trim().min(8).max(30),
  responsibleEmail: z.union([z.literal(""), z.email()]).optional().default(""),
  pastorName: z.string().trim().min(2).max(180),
  pastorPhone: optionalText,
  totalRegistrations: z.coerce.number().int().min(1).max(10000),
  maleCount: z.coerce.number().int().min(0).max(10000),
  femaleCount: z.coerce.number().int().min(0).max(10000),
  items: z.array(caravanItemSchema).min(1).max(100),
  notes: z.string().trim().max(1000).optional().default(""),
});

function validateCaravanTotals(data:z.infer<typeof groupBaseSchema>,ctx:z.RefinementCtx){
  if (data.totalRegistrations !== data.maleCount + data.femaleCount) ctx.addIssue({ code: "custom", path: ["totalRegistrations"], message: "O total deve ser igual à soma de masculino e feminino." });
  if (new Set(data.items.map((item) => item.itemId)).size !== data.items.length) ctx.addIssue({ code: "custom", path: ["items"], message: "Um item foi selecionado mais de uma vez." });
  if (data.groupId && !data.expectedUpdatedAt) ctx.addIssue({ code: "custom", path: ["expectedUpdatedAt"], message: "Recarregue a caravana antes de editar." });
}
export const groupSchema=groupBaseSchema.superRefine(validateCaravanTotals);

export const caravanPaymentSchema = z.object({
  eventId: z.uuid(), groupId: z.uuid(), amount: z.coerce.number().positive(),
  paymentMethod: z.enum(["PIX", "CASH", "BANK_TRANSFER", "OTHER"]).default("PIX"),
  notes: z.string().trim().max(1000).optional().default(""),
  receiptPath: z.string().trim().max(900).optional().default(""), receiptFileName: z.string().trim().max(220).optional().default(""),
  receiptMimeType: z.string().trim().max(100).optional().default(""), receiptFileSize: z.coerce.number().int().min(0).max(10 * 1024 * 1024).optional().default(0),
});

export const publicCaravanSchema = groupBaseSchema.omit({ groupId: true, expectedUpdatedAt: true }).extend({
  sessionKey: z.string().trim().min(20).max(80).regex(/^[A-Za-z0-9_-]+$/),
  paymentMethod: z.enum(["PIX", "CASH", "NOT_APPLICABLE"]),
  paymentAmount: z.coerce.number().min(0).default(0),
  paymentReceiptPath: z.string().trim().max(900).optional().default(""),
  paymentReceiptFileName: z.string().trim().max(220).optional().default(""),
  paymentReceiptMimeType: z.string().trim().max(100).optional().default(""),
  paymentReceiptFileSize: z.coerce.number().int().min(0).max(10 * 1024 * 1024).optional().default(0),
  listPath: z.string().trim().max(900).optional().default(""), listFileName: z.string().trim().max(220).optional().default(""),
  listMimeType: z.string().trim().max(120).optional().default(""), listFileSize: z.coerce.number().int().min(0).max(10 * 1024 * 1024).optional().default(0),
}).superRefine((data,ctx)=>{
  validateCaravanTotals({...data,groupId:"",expectedUpdatedAt:""},ctx);
  if(data.paymentReceiptPath&&data.paymentAmount<=0)ctx.addIssue({code:"custom",path:["paymentAmount"],message:"Informe o valor correspondente ao comprovante."});
  if(!data.paymentReceiptPath&&data.paymentAmount>0)ctx.addIssue({code:"custom",path:["paymentReceiptPath"],message:"Anexe o comprovante do valor informado."});
  if(data.paymentReceiptPath&&(!data.paymentReceiptFileName||!data.paymentReceiptMimeType||data.paymentReceiptFileSize<=0))ctx.addIssue({code:"custom",path:["paymentReceiptPath"],message:"Os dados do comprovante estão incompletos."});
  if(data.listPath&&(!data.listFileName||!data.listMimeType||data.listFileSize<=0))ctx.addIssue({code:"custom",path:["listPath"],message:"Os dados da lista estão incompletos."});
});

export const publicCaravanDraftSchema = groupBaseSchema.omit({ groupId: true, expectedUpdatedAt: true }).extend({
  sessionKey: z.string().trim().min(20).max(80).regex(/^[A-Za-z0-9_-]+$/),
}).superRefine((data,ctx)=>validateCaravanTotals({...data,groupId:"",expectedUpdatedAt:""},ctx));

export const lifecycleSchema = z.object({ eventId: z.uuid(), action: z.enum(["PUBLISH", "OPEN_REGISTRATION", "CLOSE_REGISTRATION", "REOPEN_REGISTRATION", "START", "FINISH", "CANCEL"]), reason: z.string().trim().max(1000).optional().default("") });
export const cancelRegistrationSchema = z.object({ registrationId: z.uuid(), reason: z.string().trim().min(3).max(1000) });
export const paymentSchema = z.object({ eventId: z.uuid(), registrationId: z.uuid(), amount: z.coerce.number().positive(), receiptPath: z.string().trim().max(900).optional().default(""), receiptFileName: z.string().trim().max(220).optional().default(""), receiptMimeType: z.string().trim().max(100).optional().default(""), receiptFileSize: z.coerce.number().int().min(0).max(10 * 1024 * 1024).optional().default(0) });
export const paymentStatusSchema = z.object({ paymentId: z.uuid(), status: z.enum(["CONFIRMED", "FAILED", "CANCELLED", "REFUNDED"]), reason: z.string().trim().max(1000).optional().default("") });
export const checkinSchema = z.object({ eventId: z.uuid(), registrationId: optionalUuid, qrToken: z.string().trim().max(300).optional().default(""), method: z.enum(["QR_CODE", "MANUAL", "SEARCH"]).default("MANUAL"), notes: z.string().trim().max(500).optional().default("") }).refine((data) => Boolean(data.registrationId || data.qrToken), { message: "Informe a inscrição ou leia o QR Code." });
export const reverseCheckinSchema = z.object({ checkinId: z.uuid(), reason: z.string().trim().min(3).max(500) });
export const itemSchema = z.object({ id: optionalUuid, eventId: z.uuid(), name: z.string().trim().min(2).max(120), description: z.string().trim().max(500).optional().default(""), itemType: z.enum(["REGISTRATION", "SHIRT", "FOOD", "LODGING", "TRANSPORT", "KIT", "DONATION", "OTHER"]), price: z.coerce.number().min(0), isRequired: z.coerce.boolean().default(false), isActive: z.coerce.boolean().default(true), allowQuantity: z.coerce.boolean().default(false), minQuantity: z.coerce.number().int().min(0).default(1), maxQuantity: z.union([z.literal(""), z.coerce.number().int().min(1)]).optional().default(""), availableQuantity: z.union([z.literal(""), z.coerce.number().int().min(0)]).optional().default("") });
export const quotaSchema = z.object({ id: optionalUuid, eventId: z.uuid(), congregationId: z.uuid("Selecione a congregação."), quotaTotal: z.coerce.number().int().min(1, "Informe uma meta maior que zero.") });

const reportDate = z.union([
  z.literal(""),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
]);

const eventReportFiltersSchema = z.object({
  regionId: optionalUuid,
  congregationId: optionalUuid,
  roleId: optionalUuid,
  gender: z.enum(["", "MALE", "FEMALE"]),
  registrationStatus: z.enum(["", "PENDING", "CONFIRMED", "CHECKED_IN", "CANCELLED", "EXPIRED", "NO_SHOW"]),
  paymentMethod: z.enum(["", "PIX", "CASH", "CREDIT_CARD", "DEBIT_CARD", "NOT_APPLICABLE"]),
  paymentStatus: z.enum(["", "NOT_REQUIRED", "PENDING", "PARTIAL", "PAID", "FAILED", "CANCELLED", "REFUNDED"]),
  itemId: optionalUuid,
  registeredFrom: reportDate,
  registeredTo: reportDate,
});

function validateReportPeriod(data: { filters: { registeredFrom: string; registeredTo: string } }, ctx: z.RefinementCtx) {
  if (data.filters.registeredFrom && data.filters.registeredTo && data.filters.registeredFrom > data.filters.registeredTo) {
    ctx.addIssue({ code: "custom", path: ["filters", "registeredTo"], message: "A data final não pode anteceder a data inicial." });
  }
}

export const eventGeneralReportConfigSchema = z.object({
  filters: eventReportFiltersSchema,
  sections: z.object({
    showSummary: z.boolean(),
    showRegions: z.boolean(),
    showCongregations: z.boolean(),
    showRoles: z.boolean(),
    showGenders: z.boolean(),
    includeZeroCongregations: z.boolean(),
    showAppliedFilters: z.boolean(),
    showIssuedAt: z.boolean(),
  }),
  columns: z.object({
    regionalCoordinator: z.boolean(),
    regionalQuota: z.boolean(),
    regionalPercentage: z.boolean(),
    congregationPastor: z.boolean(),
    congregationQuota: z.boolean(),
    congregationPercentage: z.boolean(),
  }),
  organization: z.enum(["BY_REGION", "ALPHABETICAL"]),
}).superRefine((data, ctx) => {
  if (!data.sections.showSummary && !data.sections.showRegions && !data.sections.showCongregations && !data.sections.showRoles && !data.sections.showGenders) {
    ctx.addIssue({ code: "custom", path: ["sections"], message: "Selecione ao menos uma seção de dados." });
  }
  validateReportPeriod(data, ctx);
});

export const eventGeneralReportRequestSchema = z.object({
  mode: z.enum(["preview", "pdf"]),
  disposition: z.enum(["inline", "attachment"]).optional().default("attachment"),
  config: eventGeneralReportConfigSchema,
});

export const eventParticipantReportConfigSchema = z.object({
  filters: eventReportFiltersSchema,
  columns: z.object({
    index: z.boolean(),
    registrationNumber: z.boolean(),
    role: z.boolean(),
    gender: z.boolean(),
    phone: z.boolean(),
    registrationStatus: z.boolean(),
    paymentMethod: z.boolean(),
    paymentStatus: z.boolean(),
    registeredAt: z.boolean(),
    items: z.boolean(),
  }),
  organization: z.enum(["BY_REGION", "ALPHABETICAL"]),
  showAppliedFilters: z.boolean(),
  showIssuedAt: z.boolean(),
}).superRefine(validateReportPeriod);

export const eventParticipantReportRequestSchema = z.object({
  mode: z.enum(["preview", "pdf"]),
  disposition: z.enum(["inline", "attachment"]).optional().default("attachment"),
  config: eventParticipantReportConfigSchema,
});

export const eventFinancialReportConfigSchema = z.object({
  scope: z.enum(["GENERAL", "ENTRIES_ONLY", "EXPENSES_ONLY", "CUSTOM"]),
  filters: eventReportFiltersSchema,
  expenseFilters: z.object({ name: z.string().trim().max(150), from: reportDate, to: reportDate }),
  sections: z.object({
    showSummary: z.boolean(),
    showPaymentMethods: z.boolean(),
    showItems: z.boolean(),
    showExpenses: z.boolean(),
    showAppliedFilters: z.boolean(),
    showIssuedAt: z.boolean(),
  }),
  columns: z.object({
    summaryExpectedAmount: z.boolean(),
    summaryPendingAmount: z.boolean(),
    summaryPaidRegistrationCount: z.boolean(),
    paymentConfirmedCount: z.boolean(),
    paymentPercentage: z.boolean(),
    itemParticipantCount: z.boolean(),
    itemExpectedAmount: z.boolean(),
    expenseIndex: z.boolean(),
    expenseReceipt: z.boolean(),
  }),
  organization: z.enum(["HIGHEST_VALUE", "HIGHEST_QUANTITY", "ALPHABETICAL"]),
  expenseOrganization: z.enum(["DATE_DESC", "HIGHEST_VALUE", "ALPHABETICAL"]),
}).superRefine((data, ctx) => {
  if (!data.sections.showSummary && !data.sections.showPaymentMethods && !data.sections.showItems && !data.sections.showExpenses) {
    ctx.addIssue({ code: "custom", path: ["sections"], message: "Selecione ao menos uma seção de dados." });
  }
  validateReportPeriod(data, ctx);
  if (data.expenseFilters.from && data.expenseFilters.to && data.expenseFilters.from > data.expenseFilters.to) {
    ctx.addIssue({ code: "custom", path: ["expenseFilters", "to"], message: "A data final não pode anteceder a data inicial." });
  }
});

export const eventFinancialReportRequestSchema = z.object({
  mode: z.enum(["preview", "pdf"]),
  disposition: z.enum(["inline", "attachment"]).optional().default("attachment"),
  config: eventFinancialReportConfigSchema,
});

export const eventCaravanReportConfigSchema = z.object({
  filters: z.object({
    city: z.string().trim().max(120),
    state: z.union([z.literal(""),z.string().trim().regex(/^[A-Z]{2}$/)]),
    source: z.enum(["","INTERNAL","PUBLIC"]),
    paymentStatus: z.enum(["","NOT_REQUIRED","PENDING","PARTIAL","PAID","REFUNDED"]),
    registeredFrom: reportDate,
    registeredTo: reportDate,
  }),
  columns: z.object({index:z.boolean(),originChurch:z.boolean(),responsible:z.boolean()}),
  organization: z.enum(["HIGHEST_REGISTRATIONS","ALPHABETICAL"]),
  showAppliedFilters:z.boolean(),
  showIssuedAt:z.boolean(),
}).superRefine((data,ctx)=>validateReportPeriod(data,ctx));

export const eventCaravanReportRequestSchema=z.object({
  mode:z.enum(["preview","pdf"]),
  disposition:z.enum(["inline","attachment"]).optional().default("attachment"),
  config:eventCaravanReportConfigSchema,
});
