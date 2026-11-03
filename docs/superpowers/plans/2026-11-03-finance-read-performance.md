# Finance read performance implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove per-row authorization overhead from financial reads, preserving every access boundary, then compare local measurements.

**Architecture:** A private statement-scoped set of authorized church/unit pairs reuses the canonical permission predicate. Only SELECT policies on transactions and ledger change; financial RPCs and mutation rules remain intact.

**Tech Stack:** PostgreSQL 17, Supabase CLI, Next.js 16, Vitest, Playwright, Node 24.21.0.

**Spec:** `docs/superpowers/specs/2026-11-03-finance-read-performance-design.md`

## Global Constraints

- Local database and fictional data only. No remote migration or deployment.
- Existing migrations immutable; use a new CLI-created migration.
- Preserve RLS, tenant pair, scopes, soft delete, grants and financial results.
- No cache shared across requests/users; no frontend or public RPC contract change.
- Regenerate `src/lib/supabase/database.types.ts`; do not hand-edit it.

## Review Focus

- Permissions and scope must belong to the same access, even with multiple accesses/churches.
- Session or permission changes must affect the next query, including prepared queries.
- Ministry operational assignment must respect ministry ownership and local/global scope.
- Anonymous, blocked, revoked and soft-deleted data must remain unavailable.
- Historical balances, corrections and financial mutations must retain their semantics.

### Task 1: Establish regression coverage and durable fixtures

**Files:** Create `supabase/tests/finance_read_scope_performance.sql`; modify affected financial SQL fixtures and `scripts/verify-finance-concurrency.mjs` only for required retroactive reasons.

**Interfaces:** Consumes canonical authorization predicate and existing finance fixture. Produces a rollback-only test exercising real RLS, output totals and bounded scope evaluations.

- [ ] Run baseline `npm test` and reproduce original SQL fixture failures.
- [ ] Add explicit historical-configuration reasons and rerun affected fixtures.
- [ ] Write scope/isolation and permission-change checks; seed 1,000 ledger/transaction rows and assert at most 50 canonical scope checks per table read (real function counters).
- [ ] Run the new SQL test before the migration. Expected: correct access results, failure on per-row evaluation budget.
- [ ] Commit fixtures and regression coverage with recorded red evidence.

### Task 2: Implement the policy optimization

**Files:** New `supabase/migrations/<CLI timestamp>_finance_read_scope_set.sql`; regenerate `src/lib/supabase/database.types.ts`.

**Interfaces:** Produces `private.readable_finance_units() returns table(church_id uuid, congregation_id uuid)` for the two SELECT policies. Reuses `private.can_access_finance_unit(uuid,uuid,text)` without changing it.

- [ ] Create the migration through the installed CLI.
- [ ] Add the restricted helper and replace only the two SELECT policy expressions with tuple membership in its uncorrelated result.
- [ ] Apply locally. Expected: new scope/performance test passes, identical allowed rows and aggregate values.
- [ ] Run relevant finance SQL checks, concurrency checks and local Advisors; inspect grants and query plans.
- [ ] Regenerate types and commit the minimal change.

### Task 3: Validate and repeat measurements

**Files:** Create comparison report and sanitized measurements under `docs/finance/`; preserve baseline artifacts.

**Interfaces:** Consumes migrated database and the same production application/harness from the baseline.

- [ ] Run lint with zero warnings, typecheck, full Vitest and production build. Expected: no failures.
- [ ] Run authenticated Playwright query, overview and report scenarios. Expected: correct content and access-denied cases.
- [ ] Repeat the 100/1.000/9.900, annual-history, PDF and concurrent-read measurements sequentially on the same VM resources.
- [ ] Compare counts/totals as well as timings; determine whether history needs further intervention based on results.
- [ ] Commit report and request one independent whole-branch review, including the five review focus cases.
- [ ] Resolve important findings with tests, record final evidence, preserve local branch for review and stop local services.
