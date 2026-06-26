import { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type AppSettingsRow = {
  id: string;
  enable_member_auto_code: boolean | null;
  member_code_prefix: string | null;
  member_code_next_number: number | null;
  member_code_padding: number | null;
};

export type GeneratedMemberCode = {
  memberCode: string | null;
  settingsId: string | null;
  nextNumberToSave: number | null;
  autoCodeEnabled: boolean;
};

function normalizePrefix(prefix: string | null) {
  const normalizedPrefix = prefix?.trim();
  return normalizedPrefix && normalizedPrefix.length > 0
    ? normalizedPrefix
    : "MEM";
}

function normalizePadding(padding: number | null) {
  if (!padding || Number.isNaN(padding)) return 4;
  if (padding < 1) return 1;
  if (padding > 10) return 10;
  return padding;
}

function normalizeNextNumber(nextNumber: number | null) {
  if (!nextNumber || Number.isNaN(nextNumber) || nextNumber < 1) return 1;
  return nextNumber;
}

function buildMemberCode(prefix: string, number: number, padding: number) {
  return `${prefix}${String(number).padStart(padding, "0")}`;
}

async function findAppSettings(
  supabase: SupabaseServerClient,
  churchId: string,
): Promise<AppSettingsRow | null> {
  const { data, error } = await supabase
    .from("app_settings")
    .select(
      "id, enable_member_auto_code, member_code_prefix, member_code_next_number, member_code_padding",
    )
    .eq("church_id", churchId)
    .eq("status", "ACTIVE")
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Não foi possível ler as configurações de código do membro: ${error.message}`,
    );
  }

  return data;
}

async function memberCodeAlreadyExists(
  supabase: SupabaseServerClient,
  churchId: string,
  memberCode: string,
) {
  const { data, error } = await supabase
    .from("members")
    .select("id")
    .eq("church_id", churchId)
    .eq("member_code", memberCode)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Não foi possível verificar duplicidade do código ${memberCode}: ${error.message}`,
    );
  }

  return Boolean(data?.id);
}

export async function generateNextMemberCode(
  supabase: SupabaseServerClient,
  churchId: string,
): Promise<GeneratedMemberCode> {
  const settings = await findAppSettings(supabase, churchId);

  if (!settings || settings.enable_member_auto_code === false) {
    return {
      memberCode: null,
      settingsId: settings?.id ?? null,
      nextNumberToSave: null,
      autoCodeEnabled: false,
    };
  }

  const prefix = normalizePrefix(settings.member_code_prefix);
  const padding = normalizePadding(settings.member_code_padding);
  const initialNumber = normalizeNextNumber(settings.member_code_next_number);

  for (let offset = 0; offset < 50; offset += 1) {
    const currentNumber = initialNumber + offset;
    const memberCode = buildMemberCode(prefix, currentNumber, padding);
    const alreadyExists = await memberCodeAlreadyExists(
      supabase,
      churchId,
      memberCode,
    );

    if (!alreadyExists) {
      return {
        memberCode,
        settingsId: settings.id,
        nextNumberToSave: currentNumber + 1,
        autoCodeEnabled: true,
      };
    }
  }

  throw new Error(
    "Não foi possível gerar um código livre para o membro. Verifique a sequência em app_settings.",
  );
}

export async function updateNextMemberCodeNumber(
  supabase: SupabaseServerClient,
  settingsId: string | null,
  nextNumberToSave: number | null,
) {
  if (!settingsId || !nextNumberToSave) return null;

  const { error } = await supabase
    .from("app_settings")
    .update({ member_code_next_number: nextNumberToSave })
    .eq("id", settingsId);

  return error;
}
