begin;

-- One private object per uploaded version. The application stores only its
-- tenant-scoped object path in the existing app_settings.logo_url column.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'church-logos', 'church-logos', false, 2097152,
  array['image/png', 'image/jpeg', 'image/webp']::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists church_credential_logo_select on storage.objects;
create policy church_credential_logo_select on storage.objects for select to authenticated
using (
  bucket_id = 'church-logos'
  and (storage.filename(name)) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(png|jpg|webp)$'
  and (
    (select public.has_permission(public.safe_uuid((storage.foldername(name))[1]), 'settings.view'))
    or (select public.has_permission(public.safe_uuid((storage.foldername(name))[1]), 'members.credentials.issue'))
  )
);

drop policy if exists church_credential_logo_insert on storage.objects;
create policy church_credential_logo_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'church-logos'
  and (storage.filename(name)) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(png|jpg|webp)$'
  and (select public.has_permission(public.safe_uuid((storage.foldername(name))[1]), 'settings.update'))
);

drop policy if exists church_credential_logo_delete on storage.objects;
create policy church_credential_logo_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'church-logos'
  and (select public.has_permission(public.safe_uuid((storage.foldername(name))[1]), 'settings.update'))
);

-- Logo changes were previously absent from the settings audit trigger.
create or replace function public.audit_app_settings_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.app_name is distinct from old.app_name
    or new.display_church_name is distinct from old.display_church_name
    or new.member_code_prefix is distinct from old.member_code_prefix
    or new.member_code_padding is distinct from old.member_code_padding
    or new.primary_color is distinct from old.primary_color
    or new.secondary_color is distinct from old.secondary_color
    or new.logo_url is distinct from old.logo_url then
    perform public.log_audit(new.church_id, 'settings', 'SETTINGS_UPDATED', 'app_settings', new.id,
      new.display_church_name, 'Configurações institucionais alteradas.', null,
      jsonb_build_object('app_name', new.app_name, 'member_code_prefix', new.member_code_prefix,
        'member_code_padding', new.member_code_padding,
        'credential_logo_changed', new.logo_url is distinct from old.logo_url),
      null, 'WARNING');
  end if;
  return new;
end;
$$;

commit;
