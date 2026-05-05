import { createClient } from "@/lib/supabase/server";

export async function getAppName() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "app_name")
    .maybeSingle();

  if (error) {
    console.error("Erro ao buscar app_name:", error.message);
    return null;
  }

  return data?.value ?? null;
}