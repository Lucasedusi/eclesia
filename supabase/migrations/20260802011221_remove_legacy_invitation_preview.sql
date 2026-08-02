-- A prévia pública era utilizada pelo fluxo antigo de convites. O fluxo atual
-- valida o token exclusivamente no servidor com a chave administrativa.
drop function if exists public.get_church_invitation_preview(text);
