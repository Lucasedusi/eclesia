# Supabase Migration History Normalization Implementation Plan

> **Execution note:** Follow this plan sequentially. Do not run a remote write until the local replay, schema comparison, and rollback evidence are complete.

**Goal:** Make the repository's immutable migration files reproducible in Docker and align the linked Supabase migration-history table with them without changing production schema or business data.

**Architecture:** Treat the 54 existing files in `supabase/migrations/` as an immutable candidate history. Rebuild a fresh local Supabase stack, compare its user-owned schema with the linked project, and only then repair remote history metadata in small, reversible batches. If the replayed schema is not equivalent, add a new forward-only reconciliation migration and repeat the gates.

**Stack:** Docker Desktop for Apple Silicon, Supabase CLI 2.117.0, PostgreSQL 17, npm, Vitest, Next.js 16, TypeScript.

**Design:** `docs/superpowers/specs/2026-09-15-supabase-migration-history-normalization-design.md`

---

## Task 1: Establish the isolated execution workspace

**Files:**

- Verify: `.gitignore`
- Verify: `docs/superpowers/specs/2026-09-15-supabase-migration-history-normalization-design.md`

1. Confirm the feature branch is clean and contains the approved design:

   ```bash
   git status --short --branch
   git log -2 --oneline
   ```

2. Switch the primary checkout back to `main` and create an isolated worktree for the existing feature branch under `/private/tmp/eclesia-supabase-history-normalization`:

   ```bash
   git switch main
   git worktree add /private/tmp/eclesia-supabase-history-normalization codex/supabase-history-normalization
   ```

3. In the worktree, verify that `git status --short --branch` is clean and that `git diff main...HEAD --stat` contains only the approved design.

Expected: the main checkout stays on `main`; all following repository changes occur in the temporary worktree.

## Task 2: Install and validate Docker Desktop

**Files:** none

1. Capture the pre-installation state:

   ```bash
   command -v docker || true
   brew --version
   uname -m
   ```

2. Install the Apple Silicon-compatible Docker Desktop cask:

   ```bash
   brew install --cask docker
   ```

3. Open Docker Desktop and complete any macOS confirmation required for the license or privileged helper.

4. Wait for the engine to become ready, polling in bounded intervals, then verify:

   ```bash
   docker version
   docker info
   ```

Expected: both client and server sections are available. Stop here if the user must complete a visible macOS confirmation.

## Task 3: Capture immutable baselines before local execution

**Files:**

- Create later: `docs/supabase/migration-history-normalization-2026-09-15.md`
- Verify: `supabase/migrations/*.sql`

1. Create a private temporary evidence directory with mode `700` and record its absolute path outside the repository.

2. Record file names and SHA-256 hashes for all local migrations:

   ```bash
   find supabase/migrations -maxdepth 1 -type f -name '*.sql' -print | sort
   shasum -a 256 supabase/migrations/*.sql
   ```

3. Record the linked project and the complete local/remote history using read-only commands:

   ```bash
   npx supabase projects list
   npx supabase migration list --linked
   npx supabase db query --linked "select version, name, statements is not null as has_statements from supabase_migrations.schema_migrations order by version"
   ```

4. Export the remote migration-history rows into the protected temporary directory. This backup must contain only `supabase_migrations.schema_migrations`, never application data.

5. Derive four explicit sets and save them in the evidence directory:

   - versions present in both histories;
   - versions only local;
   - versions only remote;
   - same logical names with different versions or statement contents.

Expected: migration counts and sets are reproducible from saved evidence; no remote state was changed.

## Task 4: Make the local reset configuration deterministic

**Files:**

- Modify only if needed: `supabase/config.toml`
- Create only if needed: `supabase/seed.sql`

1. Start with the committed configuration unchanged:

   ```bash
   npx supabase start
   ```

2. Run the first full reset:

   ```bash
   npx supabase db reset --local
   ```

3. If reset fails only because `[db.seed]` references the absent `supabase/seed.sql`, create `supabase/seed.sql` containing a comment that the project intentionally has no seed data. Do not disable migrations and do not add production data.

4. Repeat `npx supabase db reset --local`.

Expected: failure, if any, now identifies a migration or database object rather than missing Docker/seed infrastructure.

5. Commit only a necessary seed/config support change:

   ```bash
   git add supabase/config.toml supabase/seed.sql
   git commit -m "chore: estabiliza reset local do Supabase"
   ```

## Task 5: Prove the immutable migrations replay from an empty database

**Files:**

- Do not modify: `supabase/migrations/*.sql`
- Verify: `supabase/tests/events_verification.sql`
- Verify: `supabase/verification/performance_audit.sql`

1. Run a clean reset and capture the full output:

   ```bash
   npx supabase db reset --local
   npx supabase migration list --local
   ```

2. Compare the local applied versions with the 54 migration filenames. Every filename version must be present exactly once.

3. Run the versioned database checks against local Postgres:

   ```bash
   npx supabase db query --local --file supabase/tests/events_verification.sql
   npx supabase db query --local --file supabase/verification/performance_audit.sql
   npx supabase db lint --local --schema public --level warning --fail-on error
   ```

4. Inspect local Security and Performance Advisors with supported CLI/API commands. Save results in the evidence directory and separate pre-existing advisories from normalization regressions.

5. If an old migration itself fails, stop. Do not edit it. Diagnose whether the failure is caused by an unsupported local platform assumption or proves that the history is not replayable; document the exact version before selecting a forward-only/baseline recovery strategy.

Expected: all migrations replay successfully, the Events verification emits its success marker, and no historical file changes hash.

## Task 6: Compare the replayed schema with the linked project

**Files:**

- Create later: `docs/supabase/migration-history-normalization-2026-09-15.md`
- Potentially create: `supabase/migrations/<timestamp>_reconcile_replayed_schema.sql`

1. Generate a direct review diff for user-owned schemas without creating a migration automatically:

   ```bash
   npx supabase db diff --from migrations --to linked --schema public,storage --output /private/tmp/supabase-schema-diff.sql
   ```

2. Produce independent schema-only dumps for local and linked databases, restricted to the same schemas, into the protected evidence directory:

   ```bash
   npx supabase db dump --local --schema public,storage --file <evidence-dir>/local-schema.sql
   npx supabase db dump --linked --schema public,storage --file <evidence-dir>/remote-schema.sql
   ```

3. Review every difference. Classify only explicitly identified owner/platform/version noise as ignorable. Check tables, columns, types, defaults, constraints, indexes, functions, triggers, RLS, policies, grants, publications, and Storage policies.

4. If the schemas are equivalent, record the empty/ignorable diff and continue.

5. If there is a functional difference and the full replay reached the end, create one new forward-only reconciliation migration:

   ```bash
   npx supabase migration new reconcile_replayed_schema
   ```

6. Add only reviewed SQL to the new migration, rerun Tasks 5 and 6, and require an empty/justified diff. Never modify the 54 historical files.

Expected: either structural equivalence is proven or a new tested reconciliation migration makes it so. No production write has occurred.

## Task 7: Verify generated types and application behavior

**Files:**

- Verify: `src/lib/supabase/database.types.ts`
- Verify: affected Events and Members tests

1. Generate local types to a temporary file and compare them with the committed types:

   ```bash
   npx supabase gen types typescript --local > /private/tmp/database.types.local.ts
   diff -u src/lib/supabase/database.types.ts /private/tmp/database.types.local.ts
   ```

2. If differences expose a legitimate stale generated type, regenerate the committed file through the CLI and review the complete diff. Do not hand-edit it.

3. Run the application gates:

   ```bash
   npm run lint -- --max-warnings=0
   npm run typecheck
   npm test
   npm run build
   ```

4. Recompute historical migration hashes and compare with Task 3.

Expected: all gates pass and every historical migration hash is unchanged.

## Task 8: Produce the exact remote repair and rollback plan

**Files:**

- Create: `docs/supabase/migration-history-normalization-2026-09-15.md`

1. Write the evidence report with:

   - linked project name/ref without credentials;
   - Docker, Supabase CLI and PostgreSQL versions;
   - local/remote counts before repair;
   - exact local-only and remote-only version lists;
   - replay, SQL checks, lint, advisors, type generation and application results;
   - schema diff classification;
   - exact `migration repair` batches;
   - inverse rollback batches;
   - explicit statement that production schema/data were not changed.

2. Validate that the repair sets are disjoint and derived from the latest `migration list --linked`, not stale earlier output.

3. Commit the report before remote mutation:

   ```bash
   git add docs/supabase/migration-history-normalization-2026-09-15.md
   git commit -m "docs: registra plano de reparo do histórico Supabase"
   ```

Expected: another engineer can audit and reverse every proposed metadata change.

## Task 9: Repair only the linked migration-history metadata

**Files:** none

**Gate:** Run only if Tasks 5–8 passed and the final report proves schema equivalence.

1. Re-read remote history immediately before the write and confirm the version list is unchanged from the report.

2. Mark remote-only versions as reverted in small batches:

   ```bash
   npx supabase migration repair --linked --status reverted <verified-remote-only-versions>
   npx supabase migration list --linked
   ```

3. Mark local-only versions already represented by the equivalent production schema as applied in small batches:

   ```bash
   npx supabase migration repair --linked --status applied <verified-local-only-versions>
   npx supabase migration list --linked
   ```

4. Stop after any unexpected list result. Use only the recorded inverse batch to restore the preceding history state.

5. Verify the final no-op deployment state:

   ```bash
   npx supabase migration list --linked
   npx supabase db push --linked --dry-run --skip-vault
   ```

Expected: local and remote columns match exactly and dry-run reports no pending migration. Do not run a real `db push` when the dry-run is empty.

## Task 10: Add the future migration runbook

**Files:**

- Create: `docs/supabase/migrations-runbook.md`
- Modify: `docs/supabase/migration-history-normalization-2026-09-15.md`

1. Document the routine workflow:

   ```bash
   npx supabase start
   npx supabase migration new <change_name>
   npx supabase db reset --local
   npx supabase db query --local --file <verification.sql>
   npx supabase db lint --local --schema public --level warning --fail-on error
   npm run lint -- --max-warnings=0
   npm run typecheck
   npm test
   npx supabase db push --linked --dry-run --skip-vault
   ```

2. State that actual online push requires reviewed code, an explicit production gate, and CI/CD secrets. Manual `migration repair` is not part of the normal workflow.

3. Record the final post-repair outputs in the normalization report.

4. Commit documentation and any reviewed generated-type/reconciliation changes:

   ```bash
   git add docs/supabase src/lib/supabase/database.types.ts supabase/migrations supabase/seed.sql supabase/config.toml
   git commit -m "docs: define fluxo seguro de migrations Supabase"
   ```

Expected: future database work has a short, repeatable Docker-first path.

## Task 11: Final verification and handoff

**Files:** all files changed in this plan

1. Run the final clean verification from the worktree:

   ```bash
   git diff main...HEAD --check
   git status --short --branch
   npx supabase db reset --local
   npx supabase migration list --local
   npx supabase migration list --linked
   npx supabase db push --linked --dry-run --skip-vault
   npm run lint -- --max-warnings=0
   npm run typecheck
   npm test
   npm run build
   ```

2. Confirm no secrets or dumps were added:

   ```bash
   git diff main...HEAD --name-only
   git status --ignored --short
   ```

3. Update the evidence report with exact final results and commit it if necessary.

4. Review the branch diff, present the commits, and keep the Docker stack running only if the user wants it available for immediate development; otherwise stop it with `npx supabase stop`.

Expected: the branch is clean, Docker replay is deterministic, histories align, dry-run is empty, and all applicable project checks are evidenced.
