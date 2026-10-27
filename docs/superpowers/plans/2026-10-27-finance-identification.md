# Finance identification implementation plan

> Execute inline with superpowers:executing-plans. User prohibits subagents and has already approved the design and implementation.

**Goal:** Shared payer/payee identification plus bank-import queue and Save polish.
**Architecture:** Extend ContributorRef and the existing authenticated atomic command pipeline. Store congregation ID separately from accounting unit and keep person_name as historical display snapshot for existing projections.
**Tech Stack:** Next.js 16.3.5, React 19, Supabase/Postgres, Zod, Vitest, Playwright.
**Spec:** docs/superpowers/specs/2026-10-27-finance-identification-design.md

## Global Constraints
- Current branch only; no subagents, main integration or remote mutations.
- Existing migrations immutable; only local fixtures and database updates.
- No payment settlement or automatic counterpart financial entries.

## Review Focus
- Same-named congregations must be distinguished by persistent ID, including correction checks.
- Archived/foreign-tenant IDs and unauthorized unit must fail at database boundary.
- Old unnamed expenses and stored drafts must remain editable without invented identities.
- Browser state must not overwrite newly selected identity with a late search result.
- Post-save scroll must occur after list renders; no scroll for draft/failure.

### Task 1: Contracts and persistence
**Files:** finance command/import schemas and tests; new migration; supabase/tests/finance_identification.sql; generated database.types.ts.
**Interfaces:** ContributorRef adds {kind:CONGREGATION,congregationId} and {kind:ORGANIZATION,name}; database exposes contributor_congregation_id and lookup_finance_congregations(church,unit,query).
- [x] Add failing validation and SQL tests for new kinds, invalid names/IDs, tenant/scope, receipts/audit, attendance corrections and legacy behavior.
- [x] Run focused tests to observe failures, then implement new migration and schemas.
- [x] Apply locally, regenerate types and run SQL tests/advisors. Expected: authorized cases pass, forged references rejected, old records preserved.

### Task 2: Shared identification and projections
**Files:** contributor picker/actions/service; entry form; query types/service/filters/workspace; receipts, detail/report labels; focused tests and e2e/finance-identification.spec.ts.
**Interfaces:** Picker accepts direction-aware prompt; selects stable congregation ID with display label. Commands never trust client label; SQL resolves name.
- [x] Add failing tests for income/expense/attendance/import, correction, organization and congregation, incomplete drafts and unchanged legacy expense.
- [x] Implement lookup with scoped auth, shared picker, seed/preview, query filter and neutral labels; preserve existing receipt/report snapshots.
- [x] Run focused Vitest and local E2E. Expected: names and stable links survive save/reopen/correction and are shown in receipts/queries.

### Task 3: Queue polish and final verification
**Files:** bank-import-workspace.tsx, entry form styles, bank import navigation E2E, validation report.
- [x] Extend E2E to verify scroll/focus after save, single centered button without divider, draft/failure preserving editor.
- [x] Implement explicit queue anchor after successful completion and standard single Save styling.
- [x] Run lint, typecheck, unit suite, local build, affected E2E and SQL regressions. Review diff and security locally; record results and missing prerequisites.
- [x] Commit locally and stop server; verify ports free. No push or main changes.
