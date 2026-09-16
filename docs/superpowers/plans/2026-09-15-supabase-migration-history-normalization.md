# Supabase Migration History Normalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the repository's immutable migration files reproducible in Colima and align the linked Supabase migration-history table with them without changing production schema or business data.

**Architecture:** Treat the 54 existing files in `supabase/migrations/` as an immutable candidate history. Rebuild a fresh local Supabase PostgreSQL database, compare its user-owned schema with the linked project, and only then repair remote history metadata in small, reversible batches. If the replayed schema is not equivalent, add a new forward-only reconciliation migration and repeat the gates.

**Tech Stack:** Colima 0.10.3, Docker CLI 29.8.1, Lima 2.2.0, Supabase CLI 2.117.0, PostgreSQL 17, npm, Vitest, Next.js 16, TypeScript.

**Spec:** `docs/superpowers/specs/2026-09-15-supabase-migration-history-normalization-design.md`

## Global Constraints

- Preserve every existing file under `supabase/migrations/` byte for byte.
- Use the Colima profile `eclesia` with `aarch64`, `vz`, Docker runtime, 2 CPUs, 4 GiB RAM, 40 GiB disk, no Rosetta, no Kubernetes, and no automatic startup.
- Start only local PostgreSQL with `npx supabase db start` unless evidence proves that another Supabase service is required.
- Never copy production application data into the local environment.
- Never write to the linked project before local replay, schema equivalence, exact repair sets, and inverse rollback commands are documented.
- Remote normalization may change only `supabase_migrations.schema_migrations`; it must not change production schema or business data.

---

## Task 1: Establish the isolated execution workspace

**Files:**

- Verify: `.gitignore`
- Verify: `docs/superpowers/specs/2026-09-15-supabase-migration-history-normalization-design.md`

- [x] **Step 1: Confirm the feature branch is clean and contains the approved design**

   ```bash
   git status --short --branch
   git log -2 --oneline
   ```

- [x] **Step 2: Keep the primary checkout on `main` and create the isolated worktree**

   ```bash
   git switch main
   git worktree add /private/tmp/eclesia-supabase-history-normalization codex/supabase-history-normalization
   ```

- [x] **Step 3: Install locked dependencies and prove the baseline tests**

   ```bash
   npm ci
   npm test
   ```

   Expected: 31 test files and 168 tests pass before operational changes.

- [x] **Step 4: Verify the worktree after adapting the plan to Colima**

   ```bash
   git status --short --branch
   git diff main...HEAD --stat
   git diff --check
   ```

Expected: the main checkout stays on `main`; all following repository changes occur in the temporary worktree.

## Task 2: Create and validate the lightweight Colima runtime

**Files:** none

- [x] **Step 1: Confirm installed versions and absence of an existing VM**

   ```bash
   colima version
   docker --version
   limactl --version
   colima list
   ```

- [x] **Step 2: Create the isolated ARM64 Colima profile**

   ```bash
   colima start eclesia --runtime docker --vm-type vz --arch aarch64 --cpus 2 --memory 4 --disk 40 --save-config
   ```

- [x] **Step 3: Verify the runtime and active Docker context**

   ```bash
   colima list
   docker context ls
   docker version
   docker info
   ```

Expected: profile `eclesia` is `Running`, architecture is `aarch64`, resources are 2 CPUs/4 GiB/40 GiB, runtime is Docker, and both Docker client and server respond.

## Task 3: Capture immutable baselines before local execution

**Files:**

- Create later: `docs/supabase/migration-history-normalization-2026-09-15.md`
- Verify: `supabase/migrations/*.sql`

- [x] **Step 1: Create a private temporary evidence directory**

   ```bash
   mktemp -d /private/tmp/eclesia-supabase-evidence.XXXXXX | tee /private/tmp/eclesia-supabase-evidence.path
   chmod 700 "$(tr -d '\n' < /private/tmp/eclesia-supabase-evidence.path)"
   ```

   Record the returned absolute path, set mode `700`, and use only that directory for non-versioned evidence.

- [x] **Step 2: Record local migration names and SHA-256 hashes**

   ```bash
   find supabase/migrations -maxdepth 1 -type f -name '*.sql' -print | sort
   shasum -a 256 supabase/migrations/*.sql
   ```

- [x] **Step 3: Record the linked project and complete local/remote histories with read-only commands**

   ```bash
   npx supabase projects list
   npx supabase migration list --linked
   npx supabase db query --linked "select version, name, statements is not null as has_statements from supabase_migrations.schema_migrations order by version"
   ```

- [x] **Step 4: Export only `supabase_migrations.schema_migrations` into the evidence directory**

- [x] **Step 5: Derive and save the four explicit comparison sets**

   - versions present in both histories;
   - versions only local;
   - versions only remote;
   - same logical names with different versions or statement contents.

Expected: migration counts and sets are reproducible from saved evidence; no remote state was changed.

## Task 4: Make the local reset configuration deterministic

**Files:**

- Modify only if needed: `supabase/config.toml`
- Create only if needed: `supabase/seed.sql`

- [x] **Step 1: Start only the local Supabase PostgreSQL database**

   ```bash
   npx supabase db start
   ```

- [x] **Step 2: Run the first full reset**

   ```bash
   npx supabase db reset --local
   ```

- [x] **Step 3: If and only if reset reports the absent configured seed file, create `supabase/seed.sql` containing only `-- Intentionally empty: local schema verification does not use production data.`**

- [x] **Step 4: Repeat `npx supabase db reset --local` after a necessary seed fix**

Expected: failure, if any, now identifies a migration or database object rather than missing Docker/seed infrastructure.

- [x] **Step 5: Commit only a necessary seed/config support change**

   ```bash
   git add supabase/config.toml supabase/seed.sql
   git commit -m "chore: estabiliza reset local do Supabase"
   ```

## Task 5: Prove the immutable migrations replay from an empty database

**Files:**

- Do not modify: `supabase/migrations/*.sql`
- Verify: `supabase/tests/events_verification.sql`
- Verify: `supabase/verification/performance_audit.sql`

- [x] **Step 1: Run a clean reset and capture the full output**

   ```bash
   npx supabase db reset --local
   npx supabase migration list --local
   ```

- [x] **Step 2: Compare local applied versions with all 54 migration filenames**

- [x] **Step 3: Run the versioned database checks against local PostgreSQL**

   ```bash
   npx supabase db query --local --file supabase/tests/events_verification.sql
   npx supabase db query --local --file supabase/verification/performance_audit.sql
   npx supabase db lint --local --schema public --level warning --fail-on error
   ```

- [x] **Step 4: Run local Security and Performance Advisors and save their outputs in the evidence directory**

- [x] **Step 5: Recompute migration hashes and stop if any historical migration changed or failed**

Expected: all migrations replay successfully, the Events verification emits its success marker, and no historical file changes hash.

## Task 6: Compare the replayed schema with the linked project

**Files:**

- Create later: `docs/supabase/migration-history-normalization-2026-09-15.md`
- Potentially create: the CLI-generated `reconcile_replayed_schema` migration under `supabase/migrations/`

- [x] **Step 1: Generate a direct review diff without creating a migration automatically**

   ```bash
   npx supabase db diff --from migrations --to linked --schema public,storage --output /private/tmp/supabase-schema-diff.sql
   ```

- [x] **Step 2: Produce independent schema-only dumps for local and linked databases**

   ```bash
   eclesia_evidence_dir="$(tr -d '\n' < /private/tmp/eclesia-supabase-evidence.path)"
   npx supabase db dump --local --schema public,storage --file "$eclesia_evidence_dir/local-schema.sql"
   npx supabase db dump --linked --schema public,storage --file "$eclesia_evidence_dir/remote-schema.sql"
   ```

- [x] **Step 3: Review every difference and classify only named owner/platform/version noise as ignorable**

- [x] **Step 4: Record equivalence or stop on functional divergence**

- [x] **Step 5: If the replay completed but differs functionally, create one forward-only reconciliation migration with the CLI**

   ```bash
   npx supabase migration new reconcile_replayed_schema
   ```

- [x] **Step 6: Add only reviewed SQL to the new migration, rerun Tasks 5 and 6, and require an empty or fully justified diff**

Expected: either structural equivalence is proven or a new tested reconciliation migration makes it so. No production write has occurred.

## Task 7: Verify generated types and application behavior

**Files:**

- Verify: `src/lib/supabase/database.types.ts`
- Verify: affected Events and Members tests

- [x] **Step 1: Generate local types to a temporary file and compare them with committed types**

   ```bash
   npx supabase gen types typescript --local > /private/tmp/database.types.local.ts
   diff -u src/lib/supabase/database.types.ts /private/tmp/database.types.local.ts
   ```

- [x] **Step 2: Regenerate committed types through the CLI only if the comparison proves they are stale**

- [x] **Step 3: Run all application gates**

   ```bash
   npm run lint -- --max-warnings=0
   npm run typecheck
   npm test
   npm run build
   ```

- [x] **Step 4: Recompute historical migration hashes and compare them with Task 3**

Expected: all gates pass and every historical migration hash is unchanged.

## Task 8: Produce the exact remote repair and rollback plan

**Files:**

- Create: `docs/supabase/migration-history-normalization-2026-09-15.md`

- [x] **Step 1: Write the evidence report with all audit fields**

   - linked project name/ref without credentials;
   - Colima, Docker CLI, Lima, Supabase CLI and PostgreSQL versions;
   - local/remote counts before repair;
   - exact local-only and remote-only version lists;
   - replay, SQL checks, lint, advisors, type generation and application results;
   - schema diff classification;
   - exact `migration repair` batches;
   - inverse rollback batches;
   - explicit statement that production schema/data were not changed.

- [x] **Step 2: Validate that repair sets are disjoint and derived from a fresh linked list**

- [x] **Step 3: Commit the report before any remote mutation**

   ```bash
   git add docs/supabase/migration-history-normalization-2026-09-15.md
   git commit -m "docs: registra plano de reparo do histórico Supabase"
   ```

Expected: another engineer can audit and reverse every proposed metadata change.

## Task 9: Repair only the linked migration-history metadata

**Files:** none

**Gate:** Run only if Tasks 5–8 passed and the final report proves schema equivalence.

- [ ] **Step 1: Re-read remote history immediately before writing and compare it byte-for-byte with the report input**

- [ ] **Step 2: Run the exact remote-only `reverted` batches recorded in the report, checking the list after each batch**

   Copy the concrete `reverted` commands from the committed evidence report and execute them verbatim. After each command, run `npx supabase migration list --linked`.

- [ ] **Step 3: Run the exact local-only `applied` batches recorded in the report, checking the list after each batch**

   Copy the concrete `applied` commands from the committed evidence report and execute them verbatim. After each command, run `npx supabase migration list --linked`.

- [ ] **Step 4: Stop after any unexpected list result and use only the recorded inverse batch if restoration is required**

- [ ] **Step 5: Verify the final no-op deployment state**

   ```bash
   npx supabase migration list --linked
   npx supabase db push --linked --dry-run --skip-vault
   npx supabase db push --linked --skip-vault
   npx supabase migration list --linked
   npx supabase db push --linked --dry-run --skip-vault
   ```

Expected: after metadata repair, the first dry-run lists only the reviewed reconciliation migration. Apply it transactionally, then require exact local/remote history alignment and an empty final dry-run. Never run a real `db push` when a dry-run is already empty.

## Task 10: Add the future migration runbook

**Files:**

- Create: `docs/supabase/migrations-runbook.md`
- Modify: `docs/supabase/migration-history-normalization-2026-09-15.md`

- [x] **Step 1: Document the lightweight routine workflow**

   ```bash
   colima start eclesia
   npx supabase db start
   npx supabase db reset --local
   npx supabase db lint --local --schema public --level warning --fail-on error
   npm run lint -- --max-warnings=0
   npm run typecheck
   npm test
   npx supabase db push --linked --dry-run --skip-vault
   ```

   Explain in prose that each change begins with `npx supabase migration new` followed by a descriptive snake-case name, and that its real verification SQL file is executed with `npx supabase db query --local --file`.

- [x] **Step 2: State that online push requires reviewed code and an explicit production gate; `migration repair` is exceptional**

- [x] **Step 3: Record final post-repair outputs and Colima shutdown commands**

- [x] **Step 4: Commit documentation and any reviewed generated-type/reconciliation changes**

   ```bash
   git add docs/supabase src/lib/supabase/database.types.ts supabase/migrations supabase/seed.sql supabase/config.toml
   git commit -m "docs: define fluxo seguro de migrations Supabase"
   ```

Expected: future database work has a short, repeatable Colima-first path that starts only PostgreSQL by default.

## Task 11: Final verification and handoff

**Files:** all files changed in this plan

- [ ] **Step 1: Run the final clean verification from the worktree**

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

- [ ] **Step 2: Confirm no secrets or dumps were added**

   ```bash
   git diff main...HEAD --name-only
   git status --ignored --short
   ```

- [ ] **Step 3: Update and commit the evidence report with exact final results if necessary**

- [ ] **Step 4: Stop local services and the Colima profile**

   ```bash
   npx supabase stop
   colima stop eclesia
   ```

- [ ] **Step 5: Review the branch diff and present the commits**

Expected: the branch is clean, Colima replay is deterministic, histories align, dry-run is empty, all applicable project checks are evidenced, and no VM remains running.
