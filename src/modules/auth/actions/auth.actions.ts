"use server";

import { headers, cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  CHURCH_CONTEXT_COOKIE,
  getAuthenticatedDestination,
} from "../services/access-context.service";
import type { ActionState } from "../types/auth.types";
import { getSafeRedirect } from "../utils/safe-redirect";
import { getInitialRegistrationAvailability } from "../services/initial-registration.service";
import {
  forgotPasswordSchema,
  loginSchema,
  signUpSchema,
  updatePasswordSchema,
} from "../validations/auth.schemas";
import { z } from "zod";

function validationFailure(error: {
  flatten: () => { fieldErrors: Record<string, string[]> };
}): ActionState {
  return {
    status: "error",
    message: "Revise os campos destacados.",
    fieldErrors: error.flatten().fieldErrors,
  };
}

async function getSiteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  }

  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";
  return host ? `${protocol}://${host}` : "http://localhost:3000";
}

export async function loginAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") || undefined,
  });

  if (!parsed.success) return validationFailure(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return {
      status: "error",
      message: "Não foi possível entrar. Confira seus dados e tente novamente.",
    };
  }

  const automaticDestination = await getAuthenticatedDestination();
  const requestedDestination = getSafeRedirect(
    parsed.data.next,
    automaticDestination,
  );
  const isPreparationDestination =
    requestedDestination === "/redefinir-senha";
  const redirectTo =
    automaticDestination === "/" || isPreparationDestination
      ? requestedDestination
      : automaticDestination;

  return {
    status: "success",
    message: "Login realizado com sucesso.",
    redirectTo,
  };
}

export async function signUpAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = signUpSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
    passwordConfirmation: formData.get("passwordConfirmation"),
    acceptedTerms: formData.get("acceptedTerms"),
  });

  if (!parsed.success) return validationFailure(parsed.error);

  let registrationAvailable = false;

  try {
    registrationAvailable = (
      await getInitialRegistrationAvailability()
    ).available;
  } catch {
    return {
      status: "error",
      message:
        "Não foi possível validar o cadastro inicial. Confira a configuração do servidor e tente novamente.",
    };
  }

  if (!registrationAvailable) {
    return {
      status: "error",
      message:
        "O cadastro inicial já foi concluído. Novos usuários devem entrar por convite do Administrador.",
    };
  }

  const admin = createAdminClient();
  const configuredAt = new Date().toISOString();
  const { data: createdUser, error: createError } =
    await admin.auth.admin.createUser({
      email: parsed.data.email,
      password: parsed.data.password,
      email_confirm: true,
      user_metadata: {
        full_name: parsed.data.fullName,
        accepted_terms: true,
        account_origin: "INITIAL_ADMIN",
        credentials_configured_at: configuredAt,
      },
      app_metadata: {
        account_origin: "INITIAL_ADMIN",
      },
    });

  if (createError || !createdUser.user) {
    return {
      status: "error",
      message:
        createError?.status === 422
          ? "O cadastro inicial já foi iniciado. Entre com a conta criada ou recupere sua senha."
          : "Não foi possível criar a conta administrativa. Tente novamente.",
    };
  }

  const supabase = await createClient();
  const destination = "/onboarding";

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (signInError) {
    await admin.auth.admin.deleteUser(createdUser.user.id);
    return {
      status: "error",
      message:
        "A conta não pôde ser iniciada com segurança. Tente criar o cadastro novamente.",
    };
  }

  return {
    status: "success",
    message: "Conta administrativa criada. Vamos configurar sua igreja.",
    redirectTo: destination,
  };
}

export async function forgotPasswordAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });
  if (!parsed.success) return validationFailure(parsed.error);

  const supabase = await createClient();
  const siteUrl = await getSiteUrl();

  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${siteUrl}/auth/callback?next=/redefinir-senha`,
  });

  return {
    status: "success",
    message:
      "Se o e-mail estiver cadastrado, você receberá as instruções para redefinir sua senha.",
  };
}

export async function updatePasswordAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = updatePasswordSchema.safeParse({
    password: formData.get("password"),
    passwordConfirmation: formData.get("passwordConfirmation"),
  });
  if (!parsed.success) return validationFailure(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    return {
      status: "error",
      message:
        "O link pode ter expirado. Solicite uma nova recuperação de senha.",
    };
  }

  return {
    status: "success",
    message: "Senha alterada com sucesso.",
    redirectTo: "/",
  };
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const cookieStore = await cookies();
  cookieStore.delete(CHURCH_CONTEXT_COOKIE);
  redirect("/login");
}

export async function switchChurchAction(formData: FormData) {
  const churchId = String(formData.get("churchId") ?? "");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !churchId) return;

  const { count } = await supabase
    .from("user_church_access")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", user.id)
    .eq("church_id", churchId)
    .eq("status", "ACTIVE")
    .is("deleted_at", null);

  if (!count) return;

  const cookieStore = await cookies();
  cookieStore.set(CHURCH_CONTEXT_COOKIE, churchId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  });

  revalidatePath("/", "layout");
  redirect("/");
}

const profileSchema = z.object({
  fullName: z.string().trim().min(3, "Informe seu nome completo."),
  displayName: z.string().trim().min(2, "Informe como deseja ser chamado."),
  phone: z.string().trim().max(24).optional().default(""),
  whatsapp: z.string().trim().max(24).optional().default(""),
  locale: z.enum(["pt-BR"]),
  timezone: z.string().trim().min(3),
});

export async function updateProfileAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = profileSchema.safeParse({
    fullName: formData.get("fullName"),
    displayName: formData.get("displayName"),
    phone: formData.get("phone") || "",
    whatsapp: formData.get("whatsapp") || "",
    locale: formData.get("locale") || "pt-BR",
    timezone: formData.get("timezone") || "America/Sao_Paulo",
  });
  if (!parsed.success) return validationFailure(parsed.error);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "Sua sessão expirou." };

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.fullName,
      display_name: parsed.data.displayName,
      phone: parsed.data.phone || null,
      whatsapp: parsed.data.whatsapp || null,
      locale: parsed.data.locale,
      timezone: parsed.data.timezone,
    })
    .eq("id", user.id);

  if (error)
    return {
      status: "error",
      message: "Não foi possível atualizar seu perfil.",
    };
  revalidatePath("/", "layout");
  return { status: "success", message: "Perfil atualizado com sucesso." };
}
