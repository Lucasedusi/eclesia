import type { z } from "zod";
import type { contributorSearchSchema } from "../utils/finance-contributor";
export type ContributorSearch = z.infer<typeof contributorSearchSchema>;
export type ContributorOption = {
  id: string;
  name: string;
  memberCode: string | null;
  congregationName: string;
  suggestedClassificationId: string | null;
};
