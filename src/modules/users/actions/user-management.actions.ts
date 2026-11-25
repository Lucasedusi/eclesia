"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { sendInvitationEmail } from "@/lib/email/invitation-email";
import { requireAccessContext } from "@/modules/auth/services/access-context.service";
import { PERMISSIONS } from "@/modules/auth/constants/permissions";
import { ACCESS_ROLES, type ActionState } from "@/modules/auth/types/auth.types";

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Informe um e-mail válido."));
const accessSchema = z.object({
  accessId: z.uuid(),
  accountantUnits: z.array(z.uuid()).default([]),
  role: z.enum(ACCESS_ROLES),
  scope: z.enum(["CHURCH", "REGION", "CONGREGATION", "MINISTRY"]),
  status: z.enum(["ACTIVE", "INACTIVE", "BLOCKED"]),
  targetId: z.string().optional().default(""),
  notes: z.string().trim().max(500).optional().default(""),
});
const inviteSchema = accessSchema
  .omit({ accessId: true, status: true })
  .extend({
    name: z.string().trim().min(3, "Informe o nome do convidado."),
    email: emailSchema,
  });

function validationError(error: z.ZodError): ActionState {
  return {
    status: "error",
    message: "Revise os campos destacados.",
    fieldErrors: error.flatten().fieldErrors,
  };
}

function resolveTargets(scope: string, targetId: string) {
  return {
    p_region_id: scope === "REGION" ? targetId || null : null,
    p_congregation_id: scope === "CONGREGATION" ? targetId || null : null,
    p_ministry_id: scope === "MINISTRY" ? targetId || null : null,
  };
}

function validateRoleScope(role: string, scope: string): ActionState | null {
  if (role === "ACCOUNTANT" && scope !== "CONGREGATION") {
    return { status: "error", message: "Selecione a congregação autorizada para o contador." };
  }
  if (role === "ADMIN" && scope !== "CHURCH") {
    return {
      status: "error",
      message: "Administrador deve possuir acesso a toda a igreja.",
    };
  }
  if (role === "MINISTRY_LEADER" && scope !== "MINISTRY") {
    return {
      status: "error",
      message: "Líder de Ministério deve estar vinculado a um ministério.",
    };
  }
  return null;
}

async function getSiteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL)
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const store = await headers();
  const host = store.get("x-forwarded-host") ?? store.get("host");
  const protocol = store.get("x-forwarded-proto") ?? "http";
  return host ? `${protocol}://${host}` : "http://localhost:3000";
}

async function deliverInvitation(
  email: string,
  token: string,
  invitedName: string,
  churchName: string,
  expiresAt: string,
) {
  const siteUrl = await getSiteUrl();
  const invitePath = `/convite/${encodeURIComponent(token)}`;
  const result = await sendInvitationEmail({
    to: email,
    invitedName,
    churchName,
    invitationUrl: `${siteUrl}${invitePath}`,
    expiresAt,
  });

  return { invitePath, delivered: result.ok };
}

export async function inviteUserAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = inviteSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    role: formData.get("role"),
    scope: formData.get("scope"),
    targetId: formData.get("targetId") || "",
    accountantUnits: formData.getAll("accountantUnits"),
    notes: formData.get("notes") || "",
  });
  if (!parsed.success) return validationError(parsed.error);
  const roleScopeError = validateRoleScope(parsed.data.role, parsed.data.scope);
  if (roleScopeError) return roleScopeError;
  if (parsed.data.role === "ACCOUNTANT" && !parsed.data.accountantUnits.length)
    return { status: "error", message: "Selecione pelo menos uma congregação para o contador." };
  if (parsed.data.role !== "ACCOUNTANT" && parsed.data.scope !== "CHURCH" && !parsed.data.targetId) {
    return {
      status: "error",
      message: "Selecione o alvo do escopo.",
      fieldErrors: { targetId: ["Selecione uma opção."] },
    };
  }

  const context = await requireAccessContext(PERMISSIONS.usersInvite);
  const supabase = await createClient();
  const targets = resolveTargets(parsed.data.scope, parsed.data.targetId);
  const { data, error } = parsed.data.role === "ACCOUNTANT"
    ? await supabase.rpc("invite_finance_accountant", {
        p_church: context.church.id, p_name: parsed.data.name, p_email: parsed.data.email,
        p_units: parsed.data.accountantUnits, p_notes: parsed.data.notes,
      })
    : await supabase.rpc("create_church_invitation", {
    p_church_id: context.church.id,
    p_name: parsed.data.name,
    p_email: parsed.data.email,
    p_role: parsed.data.role,
    p_scope: parsed.data.scope,
    ...targets,
    p_notes: parsed.data.notes || null,
    p_permission_overrides: [],
  });

  if (error || typeof data !== "string") {
    return {
      status: "error",
      message:
        error?.code === "23505"
          ? "Já existe um convite pendente para este e-mail e escopo."
          : "Não foi possível criar o convite.",
    };
  }

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const delivery = await deliverInvitation(
    parsed.data.email,
    data,
    parsed.data.name,
    context.church.name,
    expiresAt,
  );
  revalidatePath("/usuarios");
  return {
    status: "success",
    message: !delivery.delivered
      ? "Convite criado, mas o e-mail não pôde ser enviado. Copie o link abaixo e encaminhe ao usuário."
      : "Convite criado e enviado por e-mail com validade de sete dias.",
    meta: { invitationPath: delivery.invitePath },
  };
}

export async function updateAccessAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = accessSchema.safeParse({
    accessId: formData.get("accessId"),
    role: formData.get("role"),
    scope: formData.get("scope"),
    status: formData.get("status"),
    targetId: formData.get("targetId") || "",
    accountantUnits: formData.getAll("accountantUnits"),
    notes: formData.get("notes") || "",
  });
  if (!parsed.success) return validationError(parsed.error);
  const roleScopeError = validateRoleScope(parsed.data.role, parsed.data.scope);
  if (roleScopeError) return roleScopeError;
  if (parsed.data.role === "ACCOUNTANT" && !parsed.data.accountantUnits.length)
    return { status: "error", message: "Selecione pelo menos uma congregação para o contador." };
  if (parsed.data.role !== "ACCOUNTANT" && parsed.data.scope !== "CHURCH" && !parsed.data.targetId)
    return { status: "error", message: "Selecione o alvo do escopo." };
  const context = await requireAccessContext(PERMISSIONS.usersUpdateAccess);
  const supabase = await createClient();
  const grouped = parsed.data.role === "ACCOUNTANT" || formData.get("previousRole") === "ACCOUNTANT";
  const expected = z.array(z.uuid()).nonempty().safeParse(formData.getAll("expectedAccessIds"));
  if (grouped && !expected.success) return { status: "error", message: "Atualize a página e confira o acesso." };
  const { error } = grouped && expected.success ? await supabase.rpc("update_accountant_scope", {
    p_church: context.church.id, p_access: parsed.data.accessId, p_expected: expected.data,
    p_units: parsed.data.accountantUnits, p_role: parsed.data.role, p_scope: parsed.data.scope,
    p_target: parsed.data.targetId || null!, p_status: parsed.data.status, p_notes: parsed.data.notes,
  }) : await supabase.rpc("update_church_access", {
    p_access_id: parsed.data.accessId,
    p_role: parsed.data.role,
    p_scope: parsed.data.scope,
    p_status: parsed.data.status,
    ...resolveTargets(parsed.data.scope, parsed.data.targetId),
    p_notes: parsed.data.notes || null,
  });
  if (error)
    return {
      status: "error",
      message: error.message.includes("ao menos um Administrador")
        ? "A igreja precisa manter ao menos um Administrador ativo."
        : "Não foi possível alterar este acesso.",
    };
  revalidatePath("/usuarios");
  return { status: "success", message: "Acesso atualizado com sucesso." };
}

export async function setPermissionOverrideAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = z
    .object({
      accessId: z.uuid(),
      permission: z.string().min(3),
      effect: z.enum(["INHERIT", "ALLOW", "DENY"]),
    })
    .safeParse({
      accessId: formData.get("accessId"),
      permission: formData.get("permission"),
      effect: formData.get("effect"),
    });
  if (!parsed.success) return validationError(parsed.error);
  await requireAccessContext(PERMISSIONS.usersManagePermissions);
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_access_permission_override", {
    p_access_id: parsed.data.accessId,
    p_permission_key: parsed.data.permission,
    p_effect: parsed.data.effect,
  });
  if (error)
    return {
      status: "error",
      message: "Não foi possível alterar a permissão.",
    };
  revalidatePath("/usuarios");
  return { status: "success", message: "Permissão atualizada." };
}

export async function cancelInvitationAction(formData: FormData) {
  const id = z.uuid().safeParse(formData.get("invitationId"));
  if (!id.success) return;
  await requireAccessContext(PERMISSIONS.usersInvite);
  const supabase = await createClient();
  await supabase.rpc("cancel_church_invitation", { p_invitation_id: id.data });
  revalidatePath("/usuarios");
}

export async function resendInvitationAction(formData: FormData) {
  const id = z.uuid().safeParse(formData.get("invitationId"));
  if (!id.success) return;
  const context = await requireAccessContext(PERMISSIONS.usersInvite);
  const supabase = await createClient();
  const { data: token } = await supabase.rpc("renew_church_invitation", {
    p_invitation_id: id.data,
  });
  const { data: invitation } = await supabase
    .from("church_invitations")
    .select("email, invited_name, expires_at")
    .eq("id", id.data)
    .eq("church_id", context.church.id)
    .maybeSingle();
  if (invitation?.email && typeof token === "string") {
    await deliverInvitation(
      invitation.email,
      token,
      invitation.invited_name,
      context.church.name,
      invitation.expires_at,
    );
  }
  revalidatePath("/usuarios");
}
