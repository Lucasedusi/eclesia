"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { PERMISSIONS } from "@/modules/auth/constants/permissions";
import { requireAccessContext } from "@/modules/auth/services/access-context.service";
import type {
  OrganizationActionState,
  OrganizationStatus,
} from "../types/organization.types";
import {
  congregationSchema,
  entityIdSchema,
  positionSchema,
  regionSchema,
} from "../validations/organization.schemas";
import { databaseActionError } from "../utils/organization-errors";

const statusSchema = z.enum(["ACTIVE", "INACTIVE"]);

function fieldValue(formData: FormData, name: string) {
  return String(formData.get(name) ?? "");
}

function validationError(error: z.ZodError): OrganizationActionState {
  return {
    status: "error",
    message: "Revise os campos destacados.",
    fieldErrors: error.flatten().fieldErrors,
  };
}

async function getAdminContext(permission: string) {
  const context = await requireAccessContext(PERMISSIONS.organizationView);
  const authorized =
    context.access.role === "ADMIN" &&
    context.access.scope === "CHURCH" &&
    context.permissions.includes(permission);

  return { context, authorized };
}

function denied(): OrganizationActionState {
  return {
    status: "error",
    message: "Esta ação é exclusiva de Administradores.",
  };
}

function refreshOrganization() {
  revalidatePath("/estrutura-eclesiastica", "layout");
}

function logMutationError(action: string, error: { code?: string; message?: string }) {
  console.error(`[organization] ${action} failed`, {
    code: error.code,
    message: error.message,
  });
}

export async function createRegionAction(
  _previous: OrganizationActionState,
  formData: FormData,
): Promise<OrganizationActionState> {
  const parsed = regionSchema.safeParse({
    id: "",
    name: fieldValue(formData, "name"),
    description: fieldValue(formData, "description"),
    coordinatorName: fieldValue(formData, "coordinatorName"),
    coordinatorPhone: fieldValue(formData, "coordinatorPhone"),
    displayOrder: fieldValue(formData, "displayOrder"),
    status: fieldValue(formData, "status"),
  });
  if (!parsed.success) return validationError(parsed.error);

  const { context, authorized } = await getAdminContext(PERMISSIONS.regionsManage);
  if (!authorized) return denied();

  const supabase = await createClient();
  const { error } = await supabase.from("regions").insert({
    church_id: context.church.id,
    name: parsed.data.name,
    description: parsed.data.description || null,
    coordinator_name: parsed.data.coordinatorName || null,
    coordinator_phone: parsed.data.coordinatorPhone || null,
    display_order: parsed.data.displayOrder,
    status: parsed.data.status,
  });

  if (error) {
    logMutationError("create region", error);
    return databaseActionError(
      error,
      "Já existe uma Regional com este nome.",
      "Não foi possível cadastrar a Regional.",
    );
  }

  refreshOrganization();
  return { status: "success", message: "Regional cadastrada com sucesso." };
}

export async function updateRegionAction(
  _previous: OrganizationActionState,
  formData: FormData,
): Promise<OrganizationActionState> {
  const parsed = regionSchema.safeParse({
    id: fieldValue(formData, "id"),
    name: fieldValue(formData, "name"),
    description: fieldValue(formData, "description"),
    coordinatorName: fieldValue(formData, "coordinatorName"),
    coordinatorPhone: fieldValue(formData, "coordinatorPhone"),
    displayOrder: fieldValue(formData, "displayOrder"),
    status: fieldValue(formData, "status"),
  });
  if (!parsed.success) return validationError(parsed.error);
  if (!parsed.data.id) return { status: "error", message: "Regional inválida." };

  const { context, authorized } = await getAdminContext(PERMISSIONS.regionsManage);
  if (!authorized) return denied();

  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from("regions")
    .update({
      name: parsed.data.name,
      description: parsed.data.description || null,
      coordinator_name: parsed.data.coordinatorName || null,
      coordinator_phone: parsed.data.coordinatorPhone || null,
      display_order: parsed.data.displayOrder,
      status: parsed.data.status,
    })
    .eq("id", parsed.data.id)
    .eq("church_id", context.church.id)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();

  if (error) {
    logMutationError("update region", error);
    return databaseActionError(
      error,
      "Já existe uma Regional com este nome.",
      "Não foi possível atualizar a Regional.",
    );
  }
  if (!updated) return { status: "error", message: "Regional não encontrada." };

  refreshOrganization();
  return { status: "success", message: "Regional atualizada com sucesso." };
}

export async function changeRegionStatusAction(input: {
  id: string;
  status: OrganizationStatus;
}): Promise<OrganizationActionState> {
  const id = entityIdSchema.safeParse(input.id);
  const status = statusSchema.safeParse(input.status);
  if (!id.success || !status.success) return { status: "error", message: "Ação inválida." };

  const { context, authorized } = await getAdminContext(PERMISSIONS.regionsManage);
  if (!authorized) return denied();

  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from("regions")
    .update({ status: status.data })
    .eq("id", id.data)
    .eq("church_id", context.church.id)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();

  if (error) {
    logMutationError("change region status", error);
    return databaseActionError(
      error,
      "A Regional já está cadastrada.",
      "Não foi possível alterar a situação da Regional.",
    );
  }
  if (!updated) return { status: "error", message: "Regional não encontrada." };

  refreshOrganization();
  return {
    status: "success",
    message: status.data === "ACTIVE" ? "Regional reativada." : "Regional inativada.",
  };
}

export async function archiveRegionAction(idValue: string): Promise<OrganizationActionState> {
  const id = entityIdSchema.safeParse(idValue);
  if (!id.success) return { status: "error", message: "Regional inválida." };

  const { context, authorized } = await getAdminContext(PERMISSIONS.regionsManage);
  if (!authorized) return denied();

  const supabase = await createClient();
  const { count, error } = await supabase
    .from("regions")
    .update({ deleted_at: new Date().toISOString() }, { count: "exact" })
    .eq("id", id.data)
    .eq("church_id", context.church.id)
    .is("deleted_at", null);

  if (error) {
    logMutationError("archive region", error);
    return databaseActionError(
      error,
      "A Regional já está cadastrada.",
      "Não foi possível excluir a Regional.",
    );
  }
  if (count !== 1) return { status: "error", message: "Regional não encontrada." };

  refreshOrganization();
  return { status: "success", message: "Regional excluída com sucesso." };
}

export async function createCongregationAction(
  _previous: OrganizationActionState,
  formData: FormData,
): Promise<OrganizationActionState> {
  const parsed = congregationSchema.safeParse({
    id: "",
    name: fieldValue(formData, "name"),
    code: fieldValue(formData, "code"),
    regionId: fieldValue(formData, "regionId"),
    displayOrder: fieldValue(formData, "displayOrder"),
    pastorName: fieldValue(formData, "pastorName"),
    pastorSpouseName: fieldValue(formData, "pastorSpouseName"),
    phone: fieldValue(formData, "phone"),
    whatsapp: fieldValue(formData, "whatsapp"),
    email: fieldValue(formData, "email"),
    zipCode: fieldValue(formData, "zipCode"),
    address: fieldValue(formData, "address"),
    number: fieldValue(formData, "number"),
    complement: fieldValue(formData, "complement"),
    district: fieldValue(formData, "district"),
    city: fieldValue(formData, "city"),
    state: fieldValue(formData, "state"),
    country: fieldValue(formData, "country"),
    notes: fieldValue(formData, "notes"),
    status: fieldValue(formData, "status"),
  });
  if (!parsed.success) return validationError(parsed.error);
  if (!parsed.data.regionId) {
    return {
      status: "error",
      message: "Selecione uma Regional ativa.",
      fieldErrors: { regionId: ["Selecione uma Regional ativa."] },
    };
  }

  const { context, authorized } = await getAdminContext(PERMISSIONS.congregationsManage);
  if (!authorized) return denied();

  const supabase = await createClient();
  const { error } = await supabase.from("congregations").insert({
    church_id: context.church.id,
    region_id: parsed.data.regionId,
    name: parsed.data.name,
    code: parsed.data.code || null,
    pastor_name: parsed.data.pastorName || null,
    pastor_spouse_name: parsed.data.pastorSpouseName || null,
    phone: parsed.data.phone || null,
    whatsapp: parsed.data.whatsapp || null,
    email: parsed.data.email || null,
    zip_code: parsed.data.zipCode || null,
    address: parsed.data.address || null,
    number: parsed.data.number || null,
    complement: parsed.data.complement || null,
    district: parsed.data.district || null,
    city: parsed.data.city || null,
    state: parsed.data.state || null,
    country: parsed.data.country,
    notes: parsed.data.notes || null,
    is_headquarters: false,
    display_order: parsed.data.displayOrder,
    status: parsed.data.status,
  });

  if (error) {
    logMutationError("create congregation", error);
    return databaseActionError(
      error,
      "Já existe uma Congregação com este nome ou código.",
      "Não foi possível cadastrar a Congregação.",
    );
  }

  refreshOrganization();
  return { status: "success", message: "Congregação cadastrada com sucesso." };
}

export async function updateCongregationAction(
  _previous: OrganizationActionState,
  formData: FormData,
): Promise<OrganizationActionState> {
  const parsed = congregationSchema.safeParse({
    id: fieldValue(formData, "id"),
    name: fieldValue(formData, "name"),
    code: fieldValue(formData, "code"),
    regionId: fieldValue(formData, "regionId"),
    displayOrder: fieldValue(formData, "displayOrder"),
    pastorName: fieldValue(formData, "pastorName"),
    pastorSpouseName: fieldValue(formData, "pastorSpouseName"),
    phone: fieldValue(formData, "phone"),
    whatsapp: fieldValue(formData, "whatsapp"),
    email: fieldValue(formData, "email"),
    zipCode: fieldValue(formData, "zipCode"),
    address: fieldValue(formData, "address"),
    number: fieldValue(formData, "number"),
    complement: fieldValue(formData, "complement"),
    district: fieldValue(formData, "district"),
    city: fieldValue(formData, "city"),
    state: fieldValue(formData, "state"),
    country: fieldValue(formData, "country"),
    notes: fieldValue(formData, "notes"),
    status: fieldValue(formData, "status"),
  });
  if (!parsed.success) return validationError(parsed.error);
  if (!parsed.data.id) return { status: "error", message: "Congregação inválida." };

  const { context, authorized } = await getAdminContext(PERMISSIONS.congregationsManage);
  if (!authorized) return denied();

  const supabase = await createClient();
  const { data: current, error: currentError } = await supabase
    .from("congregations")
    .select("id, is_headquarters")
    .eq("id", parsed.data.id)
    .eq("church_id", context.church.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (currentError || !current) {
    return { status: "error", message: "Congregação não encontrada." };
  }

  if (!current.is_headquarters && !parsed.data.regionId) {
    return {
      status: "error",
      message: "Selecione uma Regional ativa.",
      fieldErrors: { regionId: ["Selecione uma Regional ativa."] },
    };
  }

  if (current.is_headquarters && parsed.data.status !== "ACTIVE") {
    return {
      status: "error",
      message: "A Congregação Sede não pode ser inativada.",
    };
  }

  const { data: updated, error } = await supabase
    .from("congregations")
    .update({
      region_id: parsed.data.regionId || null,
      name: parsed.data.name,
      code: parsed.data.code || null,
      pastor_name: parsed.data.pastorName || null,
      pastor_spouse_name: parsed.data.pastorSpouseName || null,
      phone: parsed.data.phone || null,
      whatsapp: parsed.data.whatsapp || null,
      email: parsed.data.email || null,
      zip_code: parsed.data.zipCode || null,
      address: parsed.data.address || null,
      number: parsed.data.number || null,
      complement: parsed.data.complement || null,
      district: parsed.data.district || null,
      city: parsed.data.city || null,
      state: parsed.data.state || null,
      country: parsed.data.country,
      notes: parsed.data.notes || null,
      display_order: parsed.data.displayOrder,
      status: parsed.data.status,
    })
    .eq("id", parsed.data.id)
    .eq("church_id", context.church.id)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();

  if (error) {
    logMutationError("update congregation", error);
    return databaseActionError(
      error,
      "Já existe uma Congregação com este nome ou código.",
      "Não foi possível atualizar a Congregação.",
    );
  }
  if (!updated) return { status: "error", message: "Congregação não encontrada." };

  refreshOrganization();
  return { status: "success", message: "Congregação atualizada com sucesso." };
}

export async function changeCongregationStatusAction(input: {
  id: string;
  status: OrganizationStatus;
}): Promise<OrganizationActionState> {
  const id = entityIdSchema.safeParse(input.id);
  const status = statusSchema.safeParse(input.status);
  if (!id.success || !status.success) return { status: "error", message: "Ação inválida." };

  const { context, authorized } = await getAdminContext(PERMISSIONS.congregationsManage);
  if (!authorized) return denied();

  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from("congregations")
    .update({ status: status.data })
    .eq("id", id.data)
    .eq("church_id", context.church.id)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();

  if (error) {
    logMutationError("change congregation status", error);
    return databaseActionError(
      error,
      "A Congregação já está cadastrada.",
      "Não foi possível alterar a situação da Congregação.",
    );
  }
  if (!updated) return { status: "error", message: "Congregação não encontrada." };

  refreshOrganization();
  return {
    status: "success",
    message: status.data === "ACTIVE" ? "Congregação reativada." : "Congregação inativada.",
  };
}

export async function archiveCongregationAction(idValue: string): Promise<OrganizationActionState> {
  const id = entityIdSchema.safeParse(idValue);
  if (!id.success) return { status: "error", message: "Congregação inválida." };

  const { context, authorized } = await getAdminContext(PERMISSIONS.congregationsManage);
  if (!authorized) return denied();

  const supabase = await createClient();
  const { count, error } = await supabase
    .from("congregations")
    .update({ deleted_at: new Date().toISOString() }, { count: "exact" })
    .eq("id", id.data)
    .eq("church_id", context.church.id)
    .eq("is_headquarters", false)
    .is("deleted_at", null);

  if (error) {
    logMutationError("archive congregation", error);
    return databaseActionError(
      error,
      "A Congregação já está cadastrada.",
      "Não foi possível excluir a Congregação. Verifique se existem vínculos ativos ou históricos.",
    );
  }
  if (count !== 1) {
    return {
      status: "error",
      message: "Congregação não encontrada ou protegida por ser a Sede.",
    };
  }

  refreshOrganization();
  return { status: "success", message: "Congregação excluída com sucesso." };
}

export async function createPositionAction(
  _previous: OrganizationActionState,
  formData: FormData,
): Promise<OrganizationActionState> {
  const parsed = positionSchema.safeParse({
    id: "",
    name: fieldValue(formData, "name"),
    femaleName: fieldValue(formData, "femaleName"),
    abbreviation: fieldValue(formData, "abbreviation"),
    femaleAbbreviation: fieldValue(formData, "femaleAbbreviation"),
    description: fieldValue(formData, "description"),
    displayOrder: fieldValue(formData, "displayOrder"),
    status: fieldValue(formData, "status"),
  });
  if (!parsed.success) return validationError(parsed.error);

  const { context, authorized } = await getAdminContext(PERMISSIONS.positionsManage);
  if (!authorized) return denied();

  const supabase = await createClient();
  const { error } = await supabase.from("roles").insert({
    church_id: context.church.id,
    name: parsed.data.name,
    female_name: parsed.data.femaleName || null,
    abbreviation: parsed.data.abbreviation || null,
    female_abbreviation: parsed.data.femaleAbbreviation || null,
    description: parsed.data.description || null,
    category: "ECCLESIASTICAL",
    level: parsed.data.displayOrder,
    display_order: parsed.data.displayOrder,
    status: parsed.data.status,
    created_by: context.profile.id,
    updated_by: context.profile.id,
  });

  if (error) {
    logMutationError("create position", error);
    return databaseActionError(
      error,
      "Já existe um Cargo com este nome.",
      "Não foi possível cadastrar o Cargo.",
    );
  }

  refreshOrganization();
  return { status: "success", message: "Cargo cadastrado com sucesso." };
}

export async function updatePositionAction(
  _previous: OrganizationActionState,
  formData: FormData,
): Promise<OrganizationActionState> {
  const parsed = positionSchema.safeParse({
    id: fieldValue(formData, "id"),
    name: fieldValue(formData, "name"),
    femaleName: fieldValue(formData, "femaleName"),
    abbreviation: fieldValue(formData, "abbreviation"),
    femaleAbbreviation: fieldValue(formData, "femaleAbbreviation"),
    description: fieldValue(formData, "description"),
    displayOrder: fieldValue(formData, "displayOrder"),
    status: fieldValue(formData, "status"),
  });
  if (!parsed.success) return validationError(parsed.error);
  if (!parsed.data.id) return { status: "error", message: "Cargo inválido." };

  const { context, authorized } = await getAdminContext(PERMISSIONS.positionsManage);
  if (!authorized) return denied();

  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from("roles")
    .update({
      name: parsed.data.name,
      female_name: parsed.data.femaleName || null,
      abbreviation: parsed.data.abbreviation || null,
      female_abbreviation: parsed.data.femaleAbbreviation || null,
      description: parsed.data.description || null,
      level: parsed.data.displayOrder,
      display_order: parsed.data.displayOrder,
      status: parsed.data.status,
      updated_by: context.profile.id,
    })
    .eq("id", parsed.data.id)
    .eq("church_id", context.church.id)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();

  if (error) {
    logMutationError("update position", error);
    return databaseActionError(
      error,
      "Já existe um Cargo com este nome.",
      "Não foi possível atualizar o Cargo.",
    );
  }
  if (!updated) return { status: "error", message: "Cargo não encontrado." };

  refreshOrganization();
  return { status: "success", message: "Cargo atualizado com sucesso." };
}

export async function changePositionStatusAction(input: {
  id: string;
  status: OrganizationStatus;
}): Promise<OrganizationActionState> {
  const id = entityIdSchema.safeParse(input.id);
  const status = statusSchema.safeParse(input.status);
  if (!id.success || !status.success) return { status: "error", message: "Ação inválida." };

  const { context, authorized } = await getAdminContext(PERMISSIONS.positionsManage);
  if (!authorized) return denied();

  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from("roles")
    .update({ status: status.data, updated_by: context.profile.id })
    .eq("id", id.data)
    .eq("church_id", context.church.id)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();

  if (error) {
    logMutationError("change position status", error);
    return databaseActionError(
      error,
      "O Cargo já está cadastrado.",
      "Não foi possível alterar a situação do Cargo.",
    );
  }
  if (!updated) return { status: "error", message: "Cargo não encontrado." };

  refreshOrganization();
  return {
    status: "success",
    message: status.data === "ACTIVE" ? "Cargo reativado." : "Cargo inativado.",
  };
}

export async function archivePositionAction(idValue: string): Promise<OrganizationActionState> {
  const id = entityIdSchema.safeParse(idValue);
  if (!id.success) return { status: "error", message: "Cargo inválido." };

  const { context, authorized } = await getAdminContext(PERMISSIONS.positionsManage);
  if (!authorized) return denied();

  const supabase = await createClient();
  const { count, error } = await supabase
    .from("roles")
    .update(
      { deleted_at: new Date().toISOString(), updated_by: context.profile.id },
      { count: "exact" },
    )
    .eq("id", id.data)
    .eq("church_id", context.church.id)
    .is("deleted_at", null);

  if (error) {
    logMutationError("archive position", error);
    return databaseActionError(
      error,
      "O Cargo já está cadastrado.",
      "Não foi possível excluir o Cargo.",
    );
  }
  if (count !== 1) return { status: "error", message: "Cargo não encontrado." };

  refreshOrganization();
  return { status: "success", message: "Cargo excluído com sucesso." };
}
