import "server-only";
import { createClient } from "@/lib/supabase/server";
import { hasPermission, PERMISSIONS } from "@/modules/auth/constants/permissions";
import type { AuthContext } from "@/modules/auth/types/auth.types";
import { formatBrazilPhone } from "@/utils/input-masks";
import { MemberReportError } from "../types/member-report.types";
import { whatsappUrl } from "../utils/member-formatters";
import type { BirthdayFilters, BirthdayRange } from "../validations/member-birthdays";

export const BIRTHDAY_PAGE_SIZE = 20;
type Client = Awaited<ReturnType<typeof createClient>>;
type BirthdayRow = {
  id: string; full_name: string; member_code: string | null; birth_date: string;
  whatsapp?: string; gender?: string;
  congregations: { name: string; regions: { name: string } | null } | null;
  active_roles?: { title_variant: string; roles: { name: string; female_name: string | null } | null }[];
};

function requireBirthdayScope(context: AuthContext) {
  const { scope, regionId, congregationId, ministryId } = context.access;
  const valid = scope === "CHURCH" || (scope === "REGION" && regionId)
    || (scope === "CONGREGATION" && congregationId)
    || (scope === "MINISTRY" && ministryId && hasPermission(context.permissions, PERMISSIONS.ministriesView));
  if (!valid || !hasPermission(context.permissions, PERMISSIONS.membersViewBasic)) {
    throw new MemberReportError("MEMBER_REPORT_PERMISSION_DENIED");
  }
}

export function birthdayQuery(client: Client, context: AuthContext, filters: BirthdayFilters, range: [number, number] | null) {
  requireBirthdayScope(context);
  const { scope, regionId, congregationId, ministryId } = context.access;
  const church = context.church.id;
  const organization = hasPermission(context.permissions, PERMISSIONS.organizationView);
  const regional = scope === "REGION" || Boolean(filters.regionId);
  const roles = hasPermission(context.permissions, PERMISSIONS.memberRolesView);
  const contact = hasPermission(context.permissions, PERMISSIONS.membersViewFull);
  const projection = [
    "id,full_name,member_code,birth_date",
    ...(organization || regional ? [`congregations${regional ? "!inner" : ""}(${organization ? "name,regions(name)" : ""})`] : []),
    ...(contact ? ["whatsapp"] : []),
    ...(roles ? ["gender,active_roles:member_roles!member_roles_member_id_fkey(title_variant,roles!member_roles_role_id_fkey(name,female_name))"] : []),
    ...(scope === "MINISTRY" ? ["membership:member_ministries!member_ministries_member_id_fkey!inner()"] : []),
  ].join(",");
  let query = client.from("members").select(projection, { count: "exact" })
    .eq("church_id", church).is("deleted_at", null).eq("member_status", "ACTIVE")
    .in("member_type", ["MEMBER", "CHILD"]).not("birthday_mmdd", "is", null);
  if (organization || regional) {
    query = query.eq("congregations.church_id", church).is("congregations.deleted_at", null);
  }
  if (organization) query = query.eq("congregations.regions.church_id", church).is("congregations.regions.deleted_at", null);
  if (scope === "REGION") query = query.eq("congregations.region_id", regionId!);
  if (scope === "CONGREGATION") query = query.eq("congregation_id", congregationId!);
  if (scope === "MINISTRY") {
    query = query.eq("membership.church_id", church).eq("membership.ministry_id", ministryId!)
      .eq("membership.status", "ACTIVE").is("membership.deleted_at", null);
  }
  if (filters.regionId) query = query.eq("congregations.region_id", filters.regionId);
  if (filters.congregationId) query = query.eq("congregation_id", filters.congregationId);
  if (range) query = query.gte("birthday_mmdd", range[0]).lte("birthday_mmdd", range[1]);
  if (filters.search) {
    // Quote PostgREST operands, keeping wildcard and filter syntax out of name/code searches.
    const term = filters.search.replace(/[^\p{L}\p{M}\p{N}\s'’\-]/gu, " ").replace(/\s+/g, " ").trim();
    if (term) query = query.or(`full_name.ilike."%${term}%",member_code.ilike."%${term}%"`);
    else query = query.is("id", null);
  }
  if (roles) {
    query = query.eq("active_roles.church_id", church).eq("active_roles.status", "ACTIVE").is("active_roles.deleted_at", null)
      .eq("active_roles.roles.church_id", church).is("active_roles.roles.deleted_at", null)
      .order("start_date", { referencedTable: "active_roles", ascending: false })
      .order("id", { referencedTable: "active_roles" });
  }
  return query.order("birthday_mmdd").order("full_name").order("id").returns<BirthdayRow[]>();
}

// A week crossing a month boundary consists of two chronological ranges.
// Split the requested page at that boundary, including December before January.
export async function readBirthdayBatch(client: Client, context: AuthContext, filters: BirthdayFilters, ranges: BirthdayRange[], start: number, end: number) {
  const query = (range: BirthdayRange | null) => birthdayQuery(client, context, filters, range);
  if (ranges.length < 2) return query(ranges[0] ?? null).range(start, end);
  const firstRange = ranges[0];
  const secondRange = ranges[1];
  const firstCount = await query(firstRange).limit(0);
  if (firstCount.error || firstCount.count === null) return firstCount;
  const split = firstCount.count;
  const [first, second] = await Promise.all([
    start < split ? query(firstRange).range(start, Math.min(end, split - 1)) : firstCount,
    end >= split ? query(secondRange).range(Math.max(0, start - split), end - split) : query(secondRange).limit(0),
  ]);
  if (first.error) return first;
  if (second.error) return second;
  if (first.count !== split || second.count === null) throw new MemberReportError("MEMBER_REPORT_LOAD_FAILED");
  return { data: [...first.data, ...second.data], count: split + second.count, error: null };
}

export function birthdayMember(row: BirthdayRow) {
  const link = row.active_roles?.find((link) => link.roles);
  const female = link?.title_variant === "FEMALE" || (link?.title_variant === "AUTO" && row.gender === "FEMALE");
  return {
    id: row.id, name: row.full_name, code: row.member_code, birthDate: row.birth_date,
    congregation: row.congregations?.name, region: row.congregations?.regions?.name,
    role: (female && link?.roles?.female_name) || link?.roles?.name || null,
    whatsapp: row.whatsapp && whatsappUrl(row.whatsapp) ? formatBrazilPhone(row.whatsapp) : null,
  };
}

export type BirthdayMember = ReturnType<typeof birthdayMember>;

export async function listBirthdays(context: AuthContext, filters: BirthdayFilters, ranges: BirthdayRange[], page: number) {
  const client = await createClient();
  const start = (page - 1) * BIRTHDAY_PAGE_SIZE;
  const { data, count, error } = await readBirthdayBatch(client, context, filters, ranges, start, start + BIRTHDAY_PAGE_SIZE - 1);
  if (error?.code === "PGRST103" && page > 1) return { items: [], total: 0, outOfRange: true };
  if (error || !data || count === null) throw new MemberReportError("MEMBER_REPORT_LOAD_FAILED");
  return { items: data.map(birthdayMember), total: count, outOfRange: page > 1 && start >= count };
}

export async function birthdayCongregations(context: AuthContext) {
  requireBirthdayScope(context);
  if (!hasPermission(context.permissions, PERMISSIONS.organizationView)) return [];
  const client = await createClient();
  const church = context.church.id;
  const { scope, regionId, congregationId, ministryId } = context.access;
  type Option = { id: string; name: string; regions: { id: string; name: string } | null };
  const options: Option[] = [];
  for (;;) {
    const membership = scope === "MINISTRY"
      ? ",members!members_congregation_id_fkey!inner(member_ministries!member_ministries_member_id_fkey!inner())" : "";
    let query = client.from("congregations").select(`id,name,regions(id,name)${membership}`)
      .eq("church_id", church).is("deleted_at", null)
      .eq("regions.church_id", church).is("regions.deleted_at", null);
    if (scope === "REGION") query = query.eq("region_id", regionId!);
    if (scope === "CONGREGATION") query = query.eq("id", congregationId!);
    if (scope === "MINISTRY") {
      query = query.eq("members.church_id", church).is("members.deleted_at", null)
        .eq("members.member_status", "ACTIVE").in("members.member_type", ["MEMBER", "CHILD"])
        .not("members.birthday_mmdd", "is", null)
        .eq("members.member_ministries.church_id", church).eq("members.member_ministries.ministry_id", ministryId!)
        .eq("members.member_ministries.status", "ACTIVE").is("members.member_ministries.deleted_at", null);
    }
    const { data, error } = await query.order("name").order("id").range(options.length, options.length + 499).returns<Option[]>();
    if (error || !data) throw new MemberReportError("MEMBER_REPORT_LOAD_FAILED");
    options.push(...data.map(({ id, name, regions }) => ({ id, name, regions })));
    if (data.length < 500) return options;
  }
}
