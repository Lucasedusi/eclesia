"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { CHURCH_CONTEXT_COOKIE } from "@/modules/auth/services/access-context.service";
import type { ActionState } from "@/modules/auth/types/auth.types";
import { onboardingSchema } from "../validations/onboarding.schema";

export async function completeOnboardingAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const rawData = Object.fromEntries(formData.entries());
  const parsed = onboardingSchema.safeParse(rawData);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Revise os campos destacados antes de concluir.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { status: "error", message: "Sua sessão expirou. Entre novamente." };
  }

  const { data, error } = await supabase.rpc("complete_church_onboarding", {
    p_payload: parsed.data,
  });

  if (error) {
    const duplicateDocument =
      error.message.toLowerCase().includes("document") || error.code === "23505";

    return {
      status: "error",
      message: duplicateDocument
        ? "Já existe uma igreja ativa com esse documento ou identificação."
        : error.message.includes("cadastro inicial já foi concluído")
          ? "O cadastro inicial já foi concluído. Solicite um convite ao Administrador."
        : error.message.includes("já possui acesso")
          ? "Sua conta já está vinculada a uma igreja. Atualize a página para continuar."
          : "Não foi possível concluir agora. Seus dados foram preservados; tente novamente.",
    };
  }

  const churchId = typeof data === "string" ? data : "";
  if (!churchId) {
    return { status: "error", message: "A igreja foi criada, mas o contexto não pôde ser confirmado." };
  }

  const cookieStore = await cookies();
  cookieStore.set(CHURCH_CONTEXT_COOKIE, churchId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  });

  return {
    status: "success",
    message: "Tudo pronto! Sua igreja e a Congregação Sede foram configuradas.",
    redirectTo: "/",
  };
}
