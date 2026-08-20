import { z } from "zod";
import { isValidCpf } from "@/utils/input-masks";

const optionalText = z.string().trim().max(500).optional().default("");
const optionalUuid = z.union([z.literal(""), z.uuid()]).optional().default("");
const dateTime = z.string().min(1, "Informe a data e hora.").refine((value) => !Number.isNaN(Date.parse(value)), "Data inválida.");

export const eventIdSchema = z.uuid("Evento inválido.");
export const eventListSchema = z.object({
  search: z.string().trim().max(120).default(""),
  status: z.string().trim().max(40).default(""),
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
  registrationStartsAt: z.string().optional().default(""),
  registrationEndsAt: z.string().optional().default(""),
  timezone: z.string().trim().min(1).max(80).default("America/Sao_Paulo"),
  registrationMode: z.enum(["INDIVIDUAL", "GROUP", "MIXED"]),
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
}).superRefine((data, ctx) => {
  if (data.endsAt && Date.parse(data.endsAt) < Date.parse(data.startsAt)) ctx.addIssue({ code: "custom", path: ["endsAt"], message: "O término não pode anteceder o início." });
  if (data.registrationStartsAt && data.registrationEndsAt && Date.parse(data.registrationEndsAt) < Date.parse(data.registrationStartsAt)) ctx.addIssue({ code: "custom", path: ["registrationEndsAt"], message: "O encerramento não pode anteceder a abertura." });
  if (data.registrationEndsAt && Date.parse(data.registrationEndsAt) >= Date.parse(data.startsAt)) ctx.addIssue({ code: "custom", path: ["registrationEndsAt"], message: "As inscrições devem encerrar antes do início do evento." });
  const target = data.eventScope === "REGION" ? data.regionId : data.eventScope === "CONGREGATION" ? data.congregationId : data.eventScope === "MINISTRY" ? data.ministryId : "church";
  if (data.eventScope !== "CHURCH" && !target) ctx.addIssue({ code: "custom", path: [`${data.eventScope.toLowerCase()}Id`], message: "Selecione o alvo do escopo." });
});

const registrationBaseSchema = z.object({
  eventId: z.uuid(),
  participantKind: z.enum(["MEMBER", "VISITOR"]),
  memberId: optionalUuid,
  regionId: optionalUuid,
  congregationId: optionalUuid,
  participantName: z.string().trim().min(3, "Informe o nome completo.").max(180),
  participantGender: z.enum(["MALE", "FEMALE"], { message: "Informe o sexo." }),
  participantPhone: z.string().trim().min(8, "Informe um telefone válido.").max(30),
  preferredPaymentMethod: z.enum(["PIX", "CASH", "CREDIT_CARD", "DEBIT_CARD", "NOT_APPLICABLE"]),
  items: z.array(z.object({ itemId: z.uuid(), quantity: z.coerce.number().int().min(1) })).default([]),
});

export const registrationSchema = registrationBaseSchema.superRefine((data, ctx) => {
  if (data.participantKind === "MEMBER" && !data.memberId) ctx.addIssue({ code: "custom", path: ["memberId"], message: "Selecione um membro cadastrado." });
});

export const publicRegistrationSchema = registrationBaseSchema.omit({ memberId: true, regionId: true }).extend({
  participantKind: z.literal("VISITOR").default("VISITOR"),
  consentAccepted: z.coerce.boolean().refine(Boolean, "Aceite o aviso de privacidade."),
  consentVersion: z.string().trim().max(40).default("2026-08"),
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

export const groupSchema = z.object({
  eventId: z.uuid(),
  originChurchName: optionalText,
  originFieldName: optionalText,
  originCity: z.string().trim().min(2).max(100),
  originState: z.string().trim().length(2),
  responsibleName: z.string().trim().min(3).max(180),
  responsiblePhone: optionalText,
  responsibleEmail: z.union([z.literal(""), z.email()]).optional().default(""),
  pastorName: optionalText,
  pastorPhone: optionalText,
  notes: z.string().trim().max(1000).optional().default(""),
  participants: z.array(z.object({
    participantName: z.string().trim().min(3).max(180),
    participantType: z.enum(["MEMBER", "CONGREGATED", "VISITOR", "EXTERNAL", "CHILD", "WORKER", "PASTOR"]).default("VISITOR"),
    participantGender: z.enum(["", "MALE", "FEMALE"]).default(""),
    participantDocument: optionalText,
    participantPhone: optionalText,
    participantEmail: z.union([z.literal(""), z.email()]).optional().default(""),
    congregationId: optionalUuid,
    items: z.array(z.object({ itemId: z.uuid(), quantity: z.number().int().min(1) })).default([]),
  })).min(1).max(200),
});

export const lifecycleSchema = z.object({ eventId: z.uuid(), action: z.enum(["PUBLISH", "OPEN_REGISTRATION", "CLOSE_REGISTRATION", "REOPEN_REGISTRATION", "START", "FINISH", "CANCEL"]), reason: z.string().trim().max(1000).optional().default("") });
export const cancelRegistrationSchema = z.object({ registrationId: z.uuid(), reason: z.string().trim().min(3).max(1000) });
export const paymentSchema = z.object({ eventId: z.uuid(), registrationId: z.uuid(), amount: z.coerce.number().positive(), receiptPath: z.string().trim().max(900).optional().default(""), receiptFileName: z.string().trim().max(220).optional().default(""), receiptMimeType: z.string().trim().max(100).optional().default(""), receiptFileSize: z.coerce.number().int().min(0).max(10 * 1024 * 1024).optional().default(0) });
export const paymentStatusSchema = z.object({ paymentId: z.uuid(), status: z.enum(["CONFIRMED", "FAILED", "CANCELLED", "REFUNDED"]), reason: z.string().trim().max(1000).optional().default("") });
export const checkinSchema = z.object({ eventId: z.uuid(), registrationId: optionalUuid, qrToken: z.string().trim().max(300).optional().default(""), method: z.enum(["QR_CODE", "MANUAL", "SEARCH"]).default("MANUAL"), notes: z.string().trim().max(500).optional().default("") }).refine((data) => Boolean(data.registrationId || data.qrToken), { message: "Informe a inscrição ou leia o QR Code." });
export const reverseCheckinSchema = z.object({ checkinId: z.uuid(), reason: z.string().trim().min(3).max(500) });
export const itemSchema = z.object({ id: optionalUuid, eventId: z.uuid(), name: z.string().trim().min(2).max(120), description: z.string().trim().max(500).optional().default(""), itemType: z.enum(["REGISTRATION", "SHIRT", "FOOD", "LODGING", "TRANSPORT", "KIT", "DONATION", "OTHER"]), price: z.coerce.number().min(0), isRequired: z.coerce.boolean().default(false), isActive: z.coerce.boolean().default(true), allowQuantity: z.coerce.boolean().default(false), minQuantity: z.coerce.number().int().min(0).default(1), maxQuantity: z.union([z.literal(""), z.coerce.number().int().min(1)]).optional().default(""), availableQuantity: z.union([z.literal(""), z.coerce.number().int().min(0)]).optional().default("") });
export const quotaSchema = z.object({ id: optionalUuid, eventId: z.uuid(), congregationId: z.uuid("Selecione a congregação."), quotaTotal: z.coerce.number().int().min(1, "Informe uma meta maior que zero.") });
