import { createClient } from "@/lib/supabase/server";

export async function getAppName(): Promise<string | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("app_settings")
    .select("app_name")
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Erro ao buscar app_name:", error.message);
    return null;
  }

  return data?.app_name ?? null;
}
