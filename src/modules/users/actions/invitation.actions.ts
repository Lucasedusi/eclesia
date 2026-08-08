"use server";

import { cookies } from "next/headers";
import { redirect, RedirectType } from "next/navigation";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { CHURCH_CONTEXT_COOKIE } from "@/modules/auth/services/access-context.service";
import type { ActionState } from "@/modules/auth/types/auth.types";
import {
  getInvitationByToken,
  resolveInvitationAccount,
} from "../services/invitation.service";

const invitationActivationSchema = z
  .object({
    token: z
      .string()
      .trim()
      .regex(/^[a-f0-9]{64}$/i, "Convite inválido."),
    password: z.string().min(1, "Informe sua senha."),
    passwordConfirmation: z.string(),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    path: ["passwordConfirmation"],
    message: "As senhas não coincidem.",
  });

const newInvitationPasswordSchema = z.object({
  password: z
    .string()
    .min(8, "A senha deve ter no mínimo 8 caracteres.")
    .regex(/[A-Za-zÀ-ÿ]/, "Inclua pelo menos uma letra.")
    .regex(/[0-9]/, "Inclua pelo menos um número."),
});

export async function acceptInvitationAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = invitationActivationSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    passwordConfirmation: formData.get("passwordConfirmation"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Revise os campos destacados.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const invitation = await getInvitationByToken(parsed.data.token);
  if (!invitation) {
    return {
      status: "error",
      message: "Este convite é inválido, expirou ou já foi utilizado.",
    };
  }

  const admin = createAdminClient();
  const account = await resolveInvitationAccount(invitation);
  if (account.mode !== "SIGN_IN") {
    const strongPassword = newInvitationPasswordSchema.safeParse({
      password: parsed.data.password,
    });
    if (!strongPassword.success) {
      return {
        status: "error",
        message: "Crie uma senha segura para continuar.",
        fieldErrors: strongPassword.error.flatten().fieldErrors,
      };
    }
  }
  const configuredAt = new Date().toISOString();
  let userId: string;
  let createdNow = false;

  if (account.mode === "CREATE") {
    const { data, error } = await admin.auth.admin.createUser({
      email: invitation.email,
      password: parsed.data.password,
      email_confirm: true,
      user_metadata: {
        full_name: invitation.invitedName,
        account_origin: "INVITATION",
        credentials_configured_at: configuredAt,
      },
    });

    if (error || !data.user) {
      return {
        status: "error",
        message: "Não foi possível criar sua conta. Solicite um novo convite ao Administrador.",
      };
    }

    userId = data.user.id;
    createdNow = true;
  } else if (account.mode === "RECOVER_INVITATION") {
    const { data, error } = await admin.auth.admin.updateUserById(account.userId, {
      password: parsed.data.password,
      email_confirm: true,
      user_metadata: {
        ...account.userMetadata,
        full_name: invitation.invitedName,
        account_origin: "INVITATION",
        credentials_configured_at: configuredAt,
      },
    });

    if (error || !data.user) {
      return {
        status: "error",
        message: "Não foi possível concluir a configuração desta conta.",
      };
    }

    userId = data.user.id;
  } else {
    userId = account.userId;
  }

  const supabase = await createClient();
  const { data: signInData, error: signInError } =
    await supabase.auth.signInWithPassword({
      email: invitation.email,
      password: parsed.data.password,
    });

  if (signInError || !signInData.user || signInData.user.id !== userId) {
    if (createdNow) await admin.auth.admin.deleteUser(userId);
    return {
      status: "error",
      message:
        account.mode === "SIGN_IN"
          ? "Este e-mail já possui uma conta. Informe a senha atual dessa conta."
          : "A conta foi preparada, mas não foi possível iniciar o acesso. Tente novamente.",
    };
  }

  const { data, error } = await supabase.rpc("accept_church_invitation", {
    p_token: parsed.data.token,
  });

  if (error) {
    await supabase.auth.signOut({ scope: "local" });
    if (createdNow) await admin.auth.admin.deleteUser(userId);

    const belongsToAnotherEmail = error.message.includes("outro e-mail");
    const unavailableInvitation = error.message.includes(
      "Convite inválido ou expirado",
    );
    const unavailableProfile = error.message.includes("Perfil indisponível");

    return {
      status: "error",
      message: belongsToAnotherEmail
        ? "Este convite pertence a outro e-mail. Entre com a conta correta."
        : unavailableInvitation
          ? "Este convite é inválido, expirou ou já foi utilizado."
          : unavailableProfile
            ? "Seu perfil está indisponível. Solicite a liberação ao Administrador."
            : "Não foi possível concluir a ativação da conta. Tente novamente ou solicite um novo convite ao Administrador.",
    };
  }

  const churchId = typeof data === "string" ? data : "";
  if (churchId) {
    const cookieStore = await cookies();
    cookieStore.set(CHURCH_CONTEXT_COOKIE, churchId, {
      httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
      path: "/", maxAge: 60 * 60 * 24 * 180,
    });
  }

  redirect("/", RedirectType.replace);
}
