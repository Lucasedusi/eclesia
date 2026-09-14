# Supabase change guide

These rules supplement the repository-level `AGENTS.md` for files under `supabase/`.

## Migration history

- Existing migrations are immutable. Do not edit, rename, reorder, delete, combine, or populate historical empty migrations.
- When the Supabase CLI is available, inspect current syntax with `supabase --help` and create migrations with `supabase migration new <descriptive-name>`.
- Keep each migration focused and review its forward-only behavior, locking risk, data backfill, and compatibility with existing application code.
- Never apply or repair migration history on a remote project without explicit approval.
- Put destructive rollback procedures under `supabase/rollback/` only when operationally justified, and mark them clearly as manual and destructive.

## Multi-tenant schema rules

- Tenant-owned tables require a non-null `church_id` unless there is a documented reason otherwise.
- Enforce cross-table tenant ownership with composite unique constraints and foreign keys that include `church_id`.
- Add indexes for foreign keys and real query predicates. Do not add speculative indexes without evidence.
- Preserve soft-delete fields, active-row uniqueness, status constraints, audit actors, and immutable ownership columns.
- Keep sensitive identity, pastoral, payment, token, webhook, and operational data separated from broadly readable records.

## Grants, RLS, and functions

- Enable RLS on every table in an exposed schema and declare explicit least-privilege grants.
- Write policies for the actual permission and scope model; never rely on `TO authenticated` alone.
- UPDATE access requires a compatible SELECT policy and tenant-aware `USING` plus `WITH CHECK`.
- Prefer `(select auth.uid())` in policies and never authorize with user-editable metadata.
- Prefer `SECURITY INVOKER`.
- A required `SECURITY DEFINER` function must:
  - use `set search_path = ''`;
  - schema-qualify every referenced object;
  - validate authentication, permission, tenant, and resource ownership;
  - revoke execution from `PUBLIC` and unintended roles;
  - receive only the minimal explicit grants;
  - be placed in an unexposed schema when it is an internal helper.
- Exposed views must use `security_invoker = true`.
- Service-role-only tables and RPCs must explicitly deny or revoke access from `anon` and `authenticated`.

## Storage, public flows, and audit

- Storage policies must validate bucket, tenant-scoped path, permission, and ownership.
- Remember that Storage upsert requires appropriate INSERT, SELECT, and UPDATE access.
- Public operations must go through narrowly scoped server-side RPCs or services; do not grant direct anonymous table access as a shortcut.
- Persist hashes rather than raw access, checkout, credential, or verification tokens.
- Preserve idempotency, row locking, capacity/stock invariants, and transactional updates for payments, registrations, imports, and check-in.
- Audit sensitive mutations without copying secrets or unnecessary personal data into audit payloads.

## Database verification

For every schema change, in a local or explicitly approved development environment:

- verify migration ordering and applied state;
- run the relevant scripts under `supabase/tests/` and `supabase/verification/`;
- test `anon`, `authenticated`, cross-tenant, wrong-scope, and authorized cases;
- inspect grants, policies, function privileges, `search_path`, Storage policies, and supporting indexes;
- run Supabase Security and Performance Advisors;
- regenerate `src/lib/supabase/database.types.ts`;
- report any step that could not run and the exact prerequisite that was missing.
