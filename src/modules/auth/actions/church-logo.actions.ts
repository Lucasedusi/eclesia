"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath, updateTag } from "next/cache";
import { cacheTags } from "@/lib/cache-tags";
import { createClient } from "@/lib/supabase/server";
import { PERMISSIONS } from "../constants/permissions";
import { requireAccessContext } from "../services/access-context.service";
import { CHURCH_LOGO_BUCKET, validateChurchLogoFile } from "../services/church-logo.service";
import type { ActionState } from "../types/auth.types";

export async function uploadChurchCredentialLogoAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const context = await requireAccessContext(PERMISSIONS.settingsUpdate);
  const file = formData.get("logo");
  if (!(file instanceof File)) return { status: "error", message: "Selecione uma imagem para a logo." };
  const validated = await validateChurchLogoFile(file);
  if (!validated) return { status: "error", message: "Use uma imagem PNG, JPG ou WebP válida de até 2 MB." };

  const supabase = await createClient();
  const settings = await supabase.from("app_settings")
    .select("id")
    .eq("church_id", context.church.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (settings.error || !settings.data) return { status: "error", message: "Configurações da igreja não encontradas." };

  const objectPath = `${context.church.id}/${randomUUID()}.${validated.extension}`;
  const storage = supabase.storage.from(CHURCH_LOGO_BUCKET);
  const uploaded = await storage.upload(objectPath, validated.bytes, {
    contentType: validated.mimeType,
    cacheControl: "3600",
    upsert: false,
  });
  if (uploaded.error) return { status: "error", message: "Não foi possível enviar a logo." };

  const updated = await supabase.from("app_settings")
    .update({ logo_url: `${CHURCH_LOGO_BUCKET}/${objectPath}` })
    .eq("id", settings.data.id)
    .eq("church_id", context.church.id)
    .is("deleted_at", null)
    .select("id")
    .single();
  if (updated.error || !updated.data) {
    await storage.remove([objectPath]);
    return { status: "error", message: "Não foi possível salvar a logo da igreja." };
  }

  updateTag(cacheTags.appSettings(context.church.id));
  revalidatePath("/configuracoes");
  return { status: "success", message: "Logo da carteirinha atualizada." };
}
