import "server-only";

import type { createClient } from "@/lib/supabase/server";

export function memberSearchQuery(
  client: Awaited<ReturnType<typeof createClient>>,
  churchId: string,
  search: string,
  canSearchCpf: boolean,
  columns: string,
  options?: { count?: "exact"; head?: boolean },
) {
  // PostgREST treats an asterisk as a wildcard even inside a quoted ILIKE term.
  const term = search.replaceAll("*", "").trim();
  const digits = term.replace(/\D/g, "");
  const matchCpf = canSearchCpf && digits.length >= 3;
  const projection = matchCpf
    ? `${columns},cpf_match:member_sensitive_identity!member_sensitive_identity_member_id_fkey()`
    : columns;
  let query = client.from("members").select(projection, options).eq("church_id", churchId);
  if (term.length < 3) return query;

  // Escape the LIKE pattern first, then quote the value for PostgREST's OR syntax.
  const literal = term.replace(/[\\%_]/g, "\\$&");
  const pattern = `"%${literal.replace(/["\\]/g, "\\$&")}%"`;
  const matches = [`full_name.ilike.${pattern}`, `member_code.ilike.${pattern}`];
  if (matchCpf) {
    query = query.eq("cpf_match.church_id", churchId).is("cpf_match.deleted_at", null)
      .ilike("cpf_match.cpf", `%${digits}%`);
    matches.push("cpf_match.not.is.null");
  }
  return query.or(matches.join(","));
}
