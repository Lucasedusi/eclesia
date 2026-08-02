"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAccessContext } from "../services/access-context.service";
import { PERMISSIONS } from "../constants/permissions";
import type { ActionState } from "../types/auth.types";

const schema = z.object({
  name: z.string().trim().min(3, "Informe o nome da igreja."),
  legalName: z.string().trim().max(180).optional().default(""),
  document: z.string().trim().max(24).optional().default(""),
  email: z.string().trim().refine((value)=>!value || z.email().safeParse(value).success,"Informe um e-mail válido."),
  phone: z.string().trim().max(24).optional().default(""),
  whatsapp: z.string().trim().max(24).optional().default(""),
  seniorPastorName: z.string().trim().max(180).optional().default(""),
  seniorPastorSpouseName: z.string().trim().max(180).optional().default(""),
  displayName: z.string().trim().min(2),
  memberCodePrefix: z.string().trim().min(1).max(8).regex(/^[A-Za-z0-9]+$/),
  memberCodePadding: z.coerce.number().int().min(1).max(10),
});

export async function updateChurchSettingsAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = schema.safeParse({
    name: formData.get("name"), legalName: formData.get("legalName") || "", document: formData.get("document") || "",
    email: formData.get("email") || "", phone: formData.get("phone") || "", whatsapp: formData.get("whatsapp") || "",
    seniorPastorName: formData.get("seniorPastorName") || "", seniorPastorSpouseName: formData.get("seniorPastorSpouseName") || "",
    displayName: formData.get("displayName"), memberCodePrefix: formData.get("memberCodePrefix"), memberCodePadding: formData.get("memberCodePadding"),
  });
  if (!parsed.success) return { status: "error", message: "Revise os campos destacados.", fieldErrors: parsed.error.flatten().fieldErrors };
  const context = await requireAccessContext(PERMISSIONS.churchUpdate);
  const supabase = await createClient();
  const [churchResult, settingsResult] = await Promise.all([
    supabase.from("churches").update({
      name: parsed.data.name, legal_name: parsed.data.legalName || null, document: parsed.data.document || null,
      email: parsed.data.email || null, phone: parsed.data.phone || null, whatsapp: parsed.data.whatsapp || null,
      senior_pastor_name: parsed.data.seniorPastorName || null, senior_pastor_spouse_name: parsed.data.seniorPastorSpouseName || null,
    }).eq("id", context.church.id),
    supabase.from("app_settings").update({
      display_church_name: parsed.data.displayName,
      member_code_prefix: parsed.data.memberCodePrefix.toUpperCase(),
      member_code_padding: parsed.data.memberCodePadding,
    }).eq("church_id", context.church.id).is("deleted_at", null),
  ]);
  if (churchResult.error || settingsResult.error) return { status: "error", message: "Não foi possível salvar todas as configurações." };
  revalidatePath("/", "layout");
  return { status: "success", message: "Configurações atualizadas com sucesso." };
}
