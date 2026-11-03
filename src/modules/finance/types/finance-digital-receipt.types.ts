import type { z } from "zod";
import type { digitalReceiptSnapshotSchema } from "../validations/finance-digital-receipt.schemas";

export type DigitalReceipt = z.infer<typeof digitalReceiptSnapshotSchema> & {
  direction: "INCOME" | "EXPENSE";
  churchName: string;
  churchDocument: string | null;
  congregationAddress: string | null;
  logoDataUri: string | null;
  registeredAt: string;
};
export type DigitalReceiptLink = { url: string; expiresAt: string };
