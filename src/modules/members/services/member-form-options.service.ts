import { createClient } from "@/lib/supabase/server";
import type {
  MemberFormOptions,
  SelectOption,
} from "../types/member-form.types";

type OptionRow = {
  id: string;
  name: string;
  city?: string | null;
  state?: string | null;
  category?: string | null;
  is_global?: boolean | null;
};

function formatLocation(row: Pick<OptionRow, "city" | "state">) {
  const parts = [row.city, row.state].filter(Boolean);
  return parts.length > 0 ? parts.join(" - ") : undefined;
}

function toOption(row: OptionRow): SelectOption {
  return {
    label: row.name,
    value: row.id,
    description: row.category ?? formatLocation(row),
  };
}

function emptyOptions(errorMessage?: string): MemberFormOptions {
  return {
    churches: [],
    congregations: [],
    roles: [],
    ministries: [],
    hasLoadError: Boolean(errorMessage),
    loadErrorMessage: errorMessage,
  };
}

export async function getMemberFormOptions(): Promise<MemberFormOptions> {
  try {
    const supabase = await createClient();

    const [churchesResult, congregationsResult, rolesResult, ministriesResult] =
      await Promise.all([
        supabase
          .from("churches")
          .select("id, name, city, state")
          .eq("status", "ACTIVE")
          .is("deleted_at", null)
          .order("name", { ascending: true }),

        supabase
          .from("congregations")
          .select("id, name, city, state")
          .eq("status", "ACTIVE")
          .is("deleted_at", null)
          .order("name", { ascending: true }),

        supabase
          .from("roles")
          .select("id, name, category")
          .eq("status", "ACTIVE")
          .is("deleted_at", null)
          .order("level", { ascending: true })
          .order("name", { ascending: true }),

        supabase
          .from("ministries")
          .select("id, name, category, is_global")
          .eq("status", "ACTIVE")
          .is("deleted_at", null)
          .order("name", { ascending: true }),
      ]);

    const errors = [
      churchesResult.error,
      congregationsResult.error,
      rolesResult.error,
      ministriesResult.error,
    ].filter(Boolean);

    if (errors.length > 0) {
      console.error(
        "Erro ao carregar opções do formulário de membros:",
        errors.map((error) => error?.message).join(" | "),
      );
    }

    return {
      churches: (churchesResult.data ?? []).map(toOption),
      congregations: (congregationsResult.data ?? []).map(toOption),
      roles: (rolesResult.data ?? []).map(toOption),
      ministries: (ministriesResult.data ?? []).map(toOption),
      hasLoadError: errors.length > 0,
      loadErrorMessage:
        errors.length > 0
          ? "Algumas opções do formulário não foram carregadas. Verifique as policies/RLS das tabelas auxiliares."
          : undefined,
    };
  } catch (error) {
    console.error("Falha inesperada ao carregar opções do formulário:", error);
    return emptyOptions(
      "Não foi possível carregar os dados auxiliares do formulário.",
    );
  }
}
