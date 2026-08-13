-- A revisão de duplicidades inclui também cadastros arquivados. Administradores
-- possuem members.restore e, portanto, conseguem visualizar o candidato pela
-- mesma política RLS já utilizada no módulo de Membros.

drop function if exists public.get_member_import_duplicate_candidates(uuid, jsonb);

create function public.get_member_import_duplicate_candidates(
  p_church_id uuid,
  p_candidates jsonb
)
returns table (
  candidate_key text,
  member_id uuid,
  full_name text,
  birth_date date,
  congregation_id uuid,
  archived boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  with candidates as (
    select distinct
      nullif(pg_catalog.btrim(candidate.name_key), '') as name_key,
      candidate.birth_date
    from pg_catalog.jsonb_to_recordset(coalesce(p_candidates, '[]'::jsonb))
      as candidate(name_key text, birth_date date)
  )
  select
    candidate.name_key,
    member.id,
    member.full_name,
    member.birth_date,
    member.congregation_id,
    member.deleted_at is not null
  from candidates candidate
  join public.members member
    on member.church_id = p_church_id
   and public.normalize_member_import_name(member.full_name) = candidate.name_key
   and (
     candidate.birth_date is null
     or member.birth_date is null
     or member.birth_date = candidate.birth_date
   )
  where candidate.name_key is not null
    and (select public.has_permission(p_church_id, 'members.import'))
    and (select public.can_access_member(
      member.church_id, member.id, member.congregation_id
    ));
$$;

revoke all on function public.get_member_import_duplicate_candidates(uuid, jsonb) from public, anon;
grant execute on function public.get_member_import_duplicate_candidates(uuid, jsonb) to authenticated;

notify pgrst, 'reload schema';
