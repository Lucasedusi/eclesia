import { describe, expect, it } from "vitest";
import { financeFiltersSchema } from "../validations/finance-query.schemas";
import { financeFailure, throwFinanceDatabaseError } from "./finance-errors";
describe("financial query and rule feedback", () => {
  it("accepts the recorded tithe classification and rejects invalid identifiers", () => {
    const input = {
      month: "2026-10",
      titheClassificationId: "30000000-0000-4000-8000-000000000001",
    };
    expect(financeFiltersSchema.safeParse(input).success).toBe(true);
    expect(
      financeFiltersSchema.safeParse({
        ...input,
        titheClassificationId: "invalid",
      }).success,
    ).toBe(false);
  });
  it("identifies the missing revision justification without exposing database details", () => {
    let error: unknown;
    try {
      throwFinanceDatabaseError({
        message: "STATEMENT_REASON_REQUIRED",
        code: "22023",
      });
    } catch (e) {
      error = e;
    }
    const result = financeFailure(error);
    expect(result).toMatchObject({
      ok: false,
      code: "STATEMENT_REASON_REQUIRED",
      fieldErrors: { retroactiveReason: expect.any(Array) },
    });
  });
});
