import "server-only";

import { createClient } from "@/lib/supabase/server";
import { requireAccessContext } from "@/modules/auth/services/access-context.service";
import { PERMISSIONS } from "@/modules/auth/constants/permissions";

export type AuditItem = {
  id: string;
  actor: string;
  module: string;
  action: string;
  entity: string;
  description: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  createdAt: string;
};

export async function getAuditLogs(): Promise<AuditItem[]> {
  const context = await requireAccessContext(PERMISSIONS.auditView);
  const supabase = await createClient();
  const { data } = await supabase
    .from("audit_logs")
    .select("id, actor_email, module, action, entity_label, entity_type, description, severity, created_at")
    .eq("church_id", context.church.id)
    .order("created_at", { ascending: false })
    .limit(100);

  return (data ?? []).map((row) => ({
    id: row.id,
    actor: row.actor_email ?? "Rotina do sistema",
    module: row.module,
    action: row.action,
    entity: row.entity_label ?? row.entity_type ?? "—",
    description: row.description ?? "Ação registrada pelo sistema.",
    severity: row.severity as AuditItem["severity"],
    createdAt: row.created_at,
  }));
}
