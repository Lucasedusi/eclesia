import { z } from "zod";

const text = z.string().trim().min(1).max(1000);
export const digitalReceiptSnapshotSchema = z.object({
  number: text,
  congregationName: text,
  personName: z.string().max(1000).nullable(),
  date: z.iso.date(),
  paymentMethodName: text,
  totalCents: z.number().int().positive().safe(),
  items: z.array(z.object({
    categoryName: text,
    departmentName: text,
    classificationName: z.string().max(1000).nullable(),
    amountCents: z.number().int().positive().safe(),
  })).min(1).max(1000),
}).refine((data) => data.items.reduce((sum, item) => sum + item.amountCents, 0) === data.totalCents);
