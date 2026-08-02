import { createClient } from "@/lib/supabase/server";

export async function getAppName(churchId: string): Promise<string | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("app_settings")
    .select("app_name")
    .eq("church_id", churchId)
    .eq("status", "ACTIVE")
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Erro ao buscar app_name:", error.message);
    return null;
  }

  return data?.app_name ?? null;
}
