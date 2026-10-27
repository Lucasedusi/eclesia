import type { ContributorRef } from "../types/finance-command.types";

export function transactionContributor(t: {
  contributorKind: string | null;
  contributorCongregationId?: string | null;
  memberId: string | null;
  personName: string | null;
}): ContributorRef {
  if (t.contributorKind === "CONGREGATION" && t.contributorCongregationId)
    return {
      kind: "CONGREGATION",
      congregationId: t.contributorCongregationId,
    };
  if (t.memberId) return { kind: "MEMBER", memberId: t.memberId };
  if (
    t.contributorKind === "UNREGISTERED" ||
    t.contributorKind === "ORGANIZATION"
  )
    return { kind: t.contributorKind, name: t.personName ?? "" };
  return { kind: "COLLECTIVE" };
}
