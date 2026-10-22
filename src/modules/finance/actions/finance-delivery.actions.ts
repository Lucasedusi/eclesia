"use server";
import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { PERMISSIONS } from "@/modules/auth/constants/permissions";
import { requireFinanceContext } from "../services/finance-access.service";
import {
  listFinanceDeliveries,
  recordFinanceDelivery,
  saveFinanceDeliveryDeadline,
} from "../services/finance-administrative.service";
import { financeFailure } from "../utils/finance-errors";
export async function listFinanceDeliveriesAction(input: unknown) {
  try {
    const context = await requireFinanceContext({
      permission: PERMISSIONS.financeView,
    });
    return {
      ok: true as const,
      data: await listFinanceDeliveries(context, input),
    };
  } catch (e) {
    unstable_rethrow(e);
    return financeFailure(e);
  }
}
export async function recordFinanceDeliveryAction(input: unknown) {
  try {
    const context = await requireFinanceContext({
      permission: PERMISSIONS.financeView,
    });
    const data = await recordFinanceDelivery(context, input);
    revalidatePath("/financeiro/relatorios/entregas");
    return { ok: true as const, data };
  } catch (e) {
    unstable_rethrow(e);
    return financeFailure(e);
  }
}
export async function saveFinanceDeliveryDeadlineAction(input: unknown) {
  try {
    const context = await requireFinanceContext({
      permission: PERMISSIONS.financeSettings,
    });
    const data = await saveFinanceDeliveryDeadline(context, input);
    revalidatePath("/financeiro/configuracoes");
    revalidatePath("/financeiro/relatorios/entregas");
    return { ok: true as const, data };
  } catch (e) {
    unstable_rethrow(e);
    return financeFailure(e);
  }
}
