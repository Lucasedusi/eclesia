import { afterEach, expect, it, vi } from "vitest";
import {
  recordDeliverySchema,
  deliveryDeadlineSchema,
  rankingOptionsSchema,
  deliveryOptionsSchema,
} from "./finance-administrative.schemas";
afterEach(() => vi.useRealTimers());
const receipt = {
  congregationId: "30000000-0000-4000-8000-000000000001",
  month: "2026-09",
  deliveryDate: "2026-10-08",
  action: "RECEIVE",
  reason: "",
  expectedRevision: 0,
  operationKey: "30000000-0000-4000-8000-000000000002",
};
it("accepts past receipt date, rejects future, invalid civil date, and reference-month date", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-22T12:00:00Z"));
  expect(recordDeliverySchema.safeParse(receipt).success).toBe(true);
  for (const deliveryDate of ["2026-10-23", "2026-02-30", "2026-09-30", null])
    expect(
      recordDeliverySchema.safeParse({ ...receipt, deliveryDate }).success,
    ).toBe(false);
});
it("requires reason for corrections and undo and rejects untrusted ownership", () => {
  expect(
    recordDeliverySchema.safeParse({ ...receipt, action: "CORRECT" }).success,
  ).toBe(false);
  expect(
    recordDeliverySchema.safeParse({
      ...receipt,
      action: "UNDO",
      deliveryDate: null,
      reason: "Registro incorreto",
    }).success,
  ).toBe(true);
  expect(
    recordDeliverySchema.safeParse({ ...receipt, churchId: "fake" }).success,
  ).toBe(false);
});
it("validates deadline day and prevents retroactive policy changes", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-22T12:00:00Z"));
  const value = {
    day: 31,
    effectiveMonth: "2026-10",
    expectedRevision: 0,
    operationKey: receipt.operationKey,
  };
  expect(deliveryDeadlineSchema.safeParse(value).success).toBe(true);
  expect(
    deliveryDeadlineSchema.safeParse({ ...value, effectiveMonth: "2026-09" })
      .success,
  ).toBe(false);
  expect(deliveryDeadlineSchema.safeParse({ ...value, day: 32 }).success).toBe(
    false,
  );
});
it("rejects reversed and excessive ranking periods and injected cashbox filters", () => {
  const value = {
    type: "RANKING",
    startMonth: "2026-01",
    endMonth: "2026-12",
    includePrebend: true,
    includeTransfer: true,
    includeInactive: false,
  };
  expect(rankingOptionsSchema.safeParse(value).success).toBe(true);
  for (const invalid of [
    { startMonth: "2027-01" },
    { endMonth: "2031-01" },
    { cashboxId: receipt.congregationId },
  ])
    expect(
      rankingOptionsSchema.safeParse({ ...value, ...invalid }).success,
    ).toBe(false);
  expect(
    deliveryOptionsSchema.safeParse({
      type: "DELIVERIES",
      month: "2026-09",
      includeInactive: false,
      filter: "HACK",
    }).success,
  ).toBe(false);
});
