import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { AuthContext } from "@/modules/auth/types/auth.types";
import { MemberCredentialError } from "../types/member-credential.types";
import { buildMemberCredentialPreview } from "./member-credential.logic";
import { createMemberCredentialPdf } from "./member-credential-pdf.service";

// Relation shapes are dynamic because the shared client is not parameterized
// with the generated database type. Keep the cast isolated at this boundary.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

const MEMBER_CREDENTIAL_SELECT = [
  "id",
  "full_name",
  "gender",
  "member_code",
  "member_status",
  "member_type",
  "deleted_at",
  "baptism_date",
  "mother_name",
  "father_name",
  "congregations!inner(name)",
  "active_roles:member_roles!member_roles_member_id_fkey(status, deleted_at, title_variant, role:roles!member_roles_role_id_fkey(name, female_name))",
].join(", ");

function first<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export async function loadMemberCredentialPreview(
  context: AuthContext,
  memberId: string,
  issuedAt = new Date().toISOString(),
) {
  const supabase = await createClient();
  const [memberResult, settingsResult] = await Promise.all([
    supabase
      .from("members")
      .select(MEMBER_CREDENTIAL_SELECT)
      .eq("id", memberId)
      .eq("church_id", context.church.id)
      .is("deleted_at", null)
      .eq("active_roles.status", "ACTIVE")
      .is("active_roles.deleted_at", null)
      .maybeSingle(),
    supabase
      .from("app_settings")
      .select("display_church_name, primary_color")
      .eq("church_id", context.church.id)
      .maybeSingle(),
  ]);

  if (memberResult.error || settingsResult.error) {
    throw new MemberCredentialError("MEMBER_CREDENTIAL_LOAD_FAILED");
  }
  if (!memberResult.data) {
    throw new MemberCredentialError("MEMBER_CREDENTIAL_NOT_FOUND");
  }

  const row = memberResult.data as unknown as AnyRow;
  const settings = (settingsResult.data ?? {}) as AnyRow;
  const congregation = first<AnyRow>(row.congregations);
  const activeRoleLink = ((row.active_roles ?? []) as AnyRow[]).find(
    (link) => link.status === "ACTIVE" && !link.deleted_at,
  );
  const role = first<AnyRow>(activeRoleLink?.role);

  return buildMemberCredentialPreview({
    issuedAt,
    churchName: settings.display_church_name?.trim() || context.church.name,
    primaryColor: settings.primary_color ?? null,
    member: {
      id: row.id,
      fullName: row.full_name,
      gender: row.gender,
      memberCode: row.member_code,
      memberStatus: row.member_status,
      memberType: row.member_type,
      deletedAt: row.deleted_at,
      congregationName: congregation?.name ?? null,
      baptismDate: row.baptism_date,
      motherName: row.mother_name,
      fatherName: row.father_name,
      activeRole: role
        ? {
            titleVariant: activeRoleLink?.title_variant ?? null,
            name: role.name,
            femaleName: role.female_name,
          }
        : null,
    },
  });
}

export async function generateMemberCredentialDownload(
  context: AuthContext,
  memberId: string,
) {
  const preview = await loadMemberCredentialPreview(context, memberId);
  const body = await createMemberCredentialPdf(preview);
  const supabase = await createClient();
  const { error } = await supabase.rpc("log_audit", {
    p_church_id: context.church.id,
    p_module: "MEMBERS",
    p_action: "ISSUE_MEMBER_PHYSICAL_CREDENTIAL",
    p_entity_type: "MEMBER",
    p_entity_id: memberId,
    p_entity_label: null,
    p_description: "Credencial física de membro emitida",
    p_old_values: null,
    p_new_values: null,
    p_metadata: { format: "pdf", sides: 2, qr_mode: "DEMONSTRATIVE" },
    p_severity: "INFO",
  });
  if (error) {
    throw new MemberCredentialError("MEMBER_CREDENTIAL_AUDIT_FAILED");
  }
  return { body, fileName: preview.fileName };
}
