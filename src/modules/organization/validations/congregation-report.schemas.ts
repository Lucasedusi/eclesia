import { z } from "zod";

export const congregationReportFieldsSchema = z.object({
  spouse: z.boolean().default(false), phone: z.boolean().default(true), address: z.boolean().default(false),
}).strict();
export const congregationReportSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("simplified"), format: z.enum(["pdf", "xlsx"]),
    search: z.string().trim().max(200).default(""),
    status: z.enum(["ALL", "ACTIVE", "INACTIVE"]).default("ALL"),
    region: z.union([z.literal("ALL"), z.literal("NONE"), z.uuid()]).default("ALL"),
    congregationType: z.enum(["ALL", "HEADQUARTERS", "CONGREGATION"]).default("ALL"),
    sort: z.enum(["ORDER", "NAME", "REGION", "CREATED"]).default("ORDER"),
    fields: congregationReportFieldsSchema.default({ spouse: false, phone: true, address: false }),
  }).strict(),
  z.object({ kind: z.literal("individual"), format: z.literal("pdf"), congregationId: z.uuid() }).strict(),
]);
export type CongregationReportOptions = z.infer<typeof congregationReportSchema>;
export type CongregationReportFields = z.infer<typeof congregationReportFieldsSchema>;
