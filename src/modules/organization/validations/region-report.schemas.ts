import { z } from "zod";

const status = z.enum(["ALL", "ACTIVE", "INACTIVE"]);
export const regionReportSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("simplified"),
    format: z.enum(["pdf", "xlsx"]),
    status: status.default("ALL"),
    search: z.string().trim().max(200).default(""),
    sort: z.enum(["ORDER", "NAME", "CREATED"]).default("ORDER"),
  }).strict(),
  z.object({
    kind: z.literal("individual"),
    format: z.literal("pdf"),
    regionId: z.uuid(),
    congregationStatus: status.default("ALL"),
  }).strict(),
]);

export type RegionReportOptions = z.infer<typeof regionReportSchema>;
