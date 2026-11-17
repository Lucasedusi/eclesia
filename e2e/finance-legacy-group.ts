import { createServerClient } from "@supabase/ssr";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

/** Historical test data for receipt and cancellation flows on a local fixture. */
export async function seedLegacyGroup(name: string, date: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url || new URL(url).hostname !== "127.0.0.1")
    throw new Error("Legacy groups require the local financial fixture.");
  const f = JSON.parse(readFileSync(process.env.E2E_FINANCE_FIXTURE!, "utf8"));
  const session = JSON.parse(
    readFileSync(process.env.E2E_STORAGE_STATE!, "utf8"),
  );
  const client = createServerClient(
    url,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: { getAll: () => session.cookies, setAll: () => {} },
    },
  );
  const { data, error } = await client.rpc("execute_finance_command", {
    p_church_id: f.churchId,
    p_payload: {
      kind: "RECORD",
      mode: "ATTENDANCE",
      direction: "INCOME",
      operationKey: randomUUID(),
      congregationId: f.unitId,
      date,
      cashboxId: f.boxes[f.unitId].cash,
      paymentMethodId: f.cashMethod,
      contributor: { kind: "UNREGISTERED", name },
      issueReceipt: true,
      items: [
        {
          categoryId: f.offeringId,
          departmentId: f.departmentId,
          amountCents: 20000,
        },
        {
          categoryId: f.missionsOfferingId,
          departmentId: f.missionsId,
          amountCents: 5000,
        },
      ],
    },
  });
  if (error) throw error;
  return data.receiptId as string;
}
