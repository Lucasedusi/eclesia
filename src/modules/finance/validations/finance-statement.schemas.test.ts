import { it, expect } from "vitest";
import { statementRulesSchema } from "./finance-statement.schemas";
const base = {
  congregationId: "30000000-0000-4000-8000-000000000001",
  effectiveMonth: "2026-10",
};
it("rejects dependency cycles and multiple gross prebends", () => {
  const gross = {
    name: "Prebenda",
    destination: "LOCAL_PASTOR",
    role: "GROSS_PREBEND",
    calculation: "ELIGIBLE_INCOME_PERCENT",
    percentage: "35",
    capCents: 400000,
  };
  expect(
    statementRulesSchema.safeParse({ ...base, items: [gross] }).success,
  ).toBe(true);
  expect(
    statementRulesSchema.safeParse({ ...base, items: [gross, gross] }).success,
  ).toBe(false);
  expect(
    statementRulesSchema.safeParse({
      ...base,
      items: [{ ...gross, calculation: "GROSS_PREBEND_PERCENT" }],
    }).success,
  ).toBe(false);
  expect(
    statementRulesSchema.safeParse({
      ...base,
      items: [
        {
          name: "Desconto",
          destination: "CATHEDRAL",
          role: "PREBEND_DEDUCTION",
          calculation: "GROSS_PREBEND_PERCENT",
          percentage: "10",
        },
      ],
    }).success,
  ).toBe(false);
});

it("requires a nonnegative integer cap only for gross prebend", () => {
  const gross = {
    name: "Prebenda",
    destination: "LOCAL_PASTOR",
    role: "GROSS_PREBEND",
    calculation: "ELIGIBLE_INCOME_PERCENT",
    percentage: "35",
  };
  for (const capCents of [0, 400000])
    expect(
      statementRulesSchema.safeParse({
        ...base,
        items: [{ ...gross, capCents }],
      }).success,
    ).toBe(true);
  for (const capCents of [undefined, null, -1, 1.5, "400000", 1000000000000])
    expect(
      statementRulesSchema.safeParse({
        ...base,
        items: [{ ...gross, capCents }],
      }).success,
    ).toBe(false);
  expect(
    statementRulesSchema.safeParse({
      ...base,
      items: [
        {
          name: "Contador",
          destination: "CATHEDRAL",
          role: "DISTRIBUTION",
          calculation: "FIXED",
          amountCents: 15000,
          capCents: 100,
        },
      ],
    }).success,
  ).toBe(false);
});
