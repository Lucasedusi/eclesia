import { z } from "zod";
import { MEMBER_REPORT_OPTIONAL_FIELDS, type MemberReportOptionalKey } from "../constants/member-report-fields";

const optionalId = z.union([z.literal(""), z.uuid()]).default("");
export const memberReportFiltersSchema = z.object({
  search: z.string().trim().max(80).default(""), congregationId: optionalId, regionId: optionalId, roleId: optionalId, importBatchId: optionalId,
  status: z.enum(["", "ACTIVE", "INACTIVE", "TRANSFERRED", "DISCIPLINED", "DECEASED"]).default(""),
  memberType: z.enum(["", "MEMBER", "CONGREGATED", "VISITOR", "CHILD"]).default(""), archived: z.boolean().default(false),
  sort: z.enum(["name_asc", "name_desc", "recent", "oldest", "code"]).default("name_asc"),
}).strict();
const filters = memberReportFiltersSchema.default(() => memberReportFiltersSchema.parse({}));
const format = z.enum(["pdf", "xlsx"]);
const fieldKeys = MEMBER_REPORT_OPTIONAL_FIELDS.map((f) => f.key) as [MemberReportOptionalKey, ...MemberReportOptionalKey[]];
export const memberReportSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("simplified"), format, filters }).strict(),
  z.object({ kind: z.literal("complete"), format: z.literal("xlsx"), filters }).strict(),
  z.object({ kind: z.literal("custom"), format, filters, fields: z.array(z.enum(fieldKeys)).max(4).refine((keys) => new Set(keys).size === keys.length, "Escolha campos diferentes.") }).strict(),
]);
export type MemberReportOptions = z.infer<typeof memberReportSchema>;
export type MemberReportFilters = z.infer<typeof memberReportFiltersSchema>;
