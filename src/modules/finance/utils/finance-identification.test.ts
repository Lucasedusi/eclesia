import { expect, it } from "vitest";
import { transactionContributor } from "./finance-identification";

it("restores congregation and organization without using the accounting unit", () => {
  expect(
    transactionContributor({
      contributorKind: "CONGREGATION",
      contributorCongregationId: "payer",
      memberId: null,
      personName: "Congregação",
    }),
  ).toEqual({ kind: "CONGREGATION", congregationId: "payer" });
  expect(
    transactionContributor({
      contributorKind: "ORGANIZATION",
      memberId: null,
      personName: "Empresa",
    }),
  ).toEqual({ kind: "ORGANIZATION", name: "Empresa" });
});
it("preserves legacy identity without inferring organization from a free beneficiary", () => {
  expect(
    transactionContributor({
      contributorKind: "COLLECTIVE",
      memberId: null,
      personName: null,
    }),
  ).toEqual({ kind: "COLLECTIVE" });
  expect(
    transactionContributor({
      contributorKind: "UNREGISTERED",
      memberId: null,
      personName: "Pessoa",
    }),
  ).toEqual({ kind: "UNREGISTERED", name: "Pessoa" });
});
