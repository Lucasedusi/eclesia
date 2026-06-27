import { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type AppSettingsRow = {
  id: string;
  church_id: string | null;
  enable_member_auto_code: boolean | null;
  member_code_prefix?: string | null;
  member_code?: string | null;
  member_code_next_number: number | null;
  member_code_padding: number | null;
};

export type GeneratedMemberCode = {
  memberCode: string | null;
  settingsId: string | null;
  nextNumberToSave: number | null;
  autoCodeEnabled: boolean;
};

type AppSettingsPrefixColumn = "member_code_prefix" | "member_code";

function normalizePrefix(prefix: string | null | undefined) {
  const normalizedPrefix = prefix?.trim();
  return normalizedPrefix && normalizedPrefix.length > 0
    ? normalizedPrefix.toUpperCase()
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

function isMissingColumnError(errorMessage: string, columnName: string) {
  const normalizedMessage = errorMessage.toLowerCase();
  return (
    normalizedMessage.includes(columnName.toLowerCase()) ||
    normalizedMessage.includes("could not find") ||
    normalizedMessage.includes("does not exist")
  );
}

async function queryAppSettings(
  supabase: SupabaseServerClient,
  churchId: string,
  prefixColumn: AppSettingsPrefixColumn,
): Promise<{ data: AppSettingsRow | null; errorMessage: string | null }> {
  const selectColumns = [
    "id",
    "church_id",
    "enable_member_auto_code",
    prefixColumn,
    "member_code_next_number",
    "member_code_padding",
  ].join(", ");

  const { data: settingsByChurch, error: settingsByChurchError } =
    await supabase
      .from("app_settings")
      .select(selectColumns)
      .eq("church_id", churchId)
      .eq("status", "ACTIVE")
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();

  if (settingsByChurchError) {
    return { data: null, errorMessage: settingsByChurchError.message };
  }

  const typedSettingsByChurch = settingsByChurch as AppSettingsRow | null;

  if (typedSettingsByChurch) {
    return { data: typedSettingsByChurch, errorMessage: null };
  }

  // Fallback para desenvolvimento: se ainda existir apenas uma configuração
  // ativa/global, ela também pode ser usada. Isso evita salvar membro sem código
  // quando o church_id da configuração ainda não foi vinculado corretamente.
  const { data: firstActiveSettings, error: firstActiveSettingsError } =
    await supabase
      .from("app_settings")
      .select(selectColumns)
      .eq("status", "ACTIVE")
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();

  if (firstActiveSettingsError) {
    return { data: null, errorMessage: firstActiveSettingsError.message };
  }

  const typedFirstActiveSettings = firstActiveSettings as AppSettingsRow | null;

  return { data: typedFirstActiveSettings, errorMessage: null };
}

async function findAppSettings(
  supabase: SupabaseServerClient,
  churchId: string,
): Promise<AppSettingsRow | null> {
  const preferredColumnResult = await queryAppSettings(
    supabase,
    churchId,
    "member_code_prefix",
  );

  if (!preferredColumnResult.errorMessage) {
    return preferredColumnResult.data;
  }

  // Algumas bases antigas/testes podem ter ficado com a coluna chamada
  // member_code em app_settings. O ideal é usar member_code_prefix, mas
  // este fallback mantém o cadastro funcionando enquanto a tabela é ajustada.
  if (
    isMissingColumnError(
      preferredColumnResult.errorMessage,
      "member_code_prefix",
    )
  ) {
    const legacyColumnResult = await queryAppSettings(
      supabase,
      churchId,
      "member_code",
    );

    if (!legacyColumnResult.errorMessage) {
      return legacyColumnResult.data;
    }

    throw new Error(
      `Não foi possível ler as configurações de código do membro: ${legacyColumnResult.errorMessage}`,
    );
  }

  throw new Error(
    `Não foi possível ler as configurações de código do membro: ${preferredColumnResult.errorMessage}`,
  );
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

  if (!settings) {
    throw new Error(
      "Nenhuma configuração ativa foi encontrada em app_settings. Cadastre uma configuração para a igreja antes de salvar membros.",
    );
  }

  if (settings.enable_member_auto_code === false) {
    return {
      memberCode: null,
      settingsId: settings.id,
      nextNumberToSave: null,
      autoCodeEnabled: false,
    };
  }

  const prefix = normalizePrefix(
    settings.member_code_prefix ?? settings.member_code,
  );
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

  const { data, error } = await supabase
    .from("app_settings")
    .update({ member_code_next_number: nextNumberToSave })
    .eq("id", settingsId)
    .select("id")
    .maybeSingle();

  if (error) return error;

  if (!data?.id) {
    return {
      message:
        "A sequência do código do membro não foi atualizada. Verifique se a policy de UPDATE em app_settings permite alterar esse registro.",
    };
  }

  return null;
}
