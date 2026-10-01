import { z } from "zod";

export const memberSheetOptionsSchema = z.object({
  includeHistory: z.boolean().default(false),
  includeEvents: z.boolean().default(false),
}).strict();
