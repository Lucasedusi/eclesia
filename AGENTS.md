<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Eclesias agent guide

## Purpose and stack

- This file contains operational engineering rules. Keep product vision and feature documentation in `README.md` and `docs/`.
- Eclesias is a multi-tenant church-management application built with Next.js 16 App Router, React 19, strict TypeScript, Supabase, Zod, Styled Components, Tailwind CSS, Vitest, and Playwright.
- The application enables Cache Components, Partial Prefetching, and the React Compiler. Preserve the established streaming, caching, and Server/Client Component boundaries.
- Use the Node.js version from `.node-version`, `npm`, and the committed `package-lock.json`. Do not introduce another package manager.
- Use the `@/*` path alias for imports from `src/`.

## Repository architecture

- `src/app/`: routes, layouts, loading/error boundaries, and Route Handlers. Keep pages focused on authorization, orchestration, and rendering.
- `src/modules/<domain>/`: domain components, actions, services, validations, types, constants, hooks, and utilities.
- `src/components/`: shared UI and layout components.
- `src/styles/`: theme, global styles, Styled Components registry, and visual standards.
- `src/lib/`: shared server/client infrastructure such as Supabase, cache tags, email, and observability.
- `src/services/`: cross-domain application services.
- `supabase/migrations/`: immutable database history. Additional SQL-specific rules live in `supabase/AGENTS.md`.

Follow existing domain structure before adding abstractions or directories. Keep changes focused and avoid unrelated refactors.

## Next.js boundaries and data flow

- Keep pages and layouts as Server Components unless browser state or interactivity requires `"use client"`.
- With Cache Components enabled, keep request-bound reads behind `Suspense` and provide a meaningful fallback.
- Treat `src/proxy.ts` as an optimistic session/redirect layer, never as the only authorization boundary.
- Put mutations in Server Actions or Route Handlers and domain rules/data access in server-only services.
- Treat every Server Action and Route Handler as externally callable. Validate all untrusted input and repeat authentication, permission, tenant, and resource-scope checks inside the entry point or called service.
- Use Zod schemas from the domain when a suitable schema exists. Return safe DTOs and user-facing errors; do not expose database or provider internals.
- Keep privileged modules marked with `import "server-only"` and never import them from Client Components.
- Reuse shared UI, theme tokens, and visual standards. The existing application intentionally mixes Styled Components with Tailwind/global utilities; do not introduce another styling system or perform an unrequested migration between them.

## Authentication, permissions, and multi-tenancy

- Resolve authenticated access through `requireAccessContext()` and permission keys from `PERMISSIONS`.
- Never trust a client-provided `churchId`, role, scope, permission, ownership field, price, or payment status.
- Derive the active church from the authenticated context. Public flows must resolve ownership server-side from validated public identifiers or opaque tokens.
- Every tenant-owned read or mutation must include `church_id` and the relevant resource identifier. Preserve `deleted_at is null` filtering unless the operation explicitly targets archived records.
- Preserve access scopes: `CHURCH`, `REGION`, `CONGREGATION`, and `MINISTRY`. Authentication alone is not authorization.
- New cross-table tenant relationships must prevent cross-church references at the database level, normally through composite unique keys and foreign keys that include `church_id`.
- Return only the fields required by the caller, especially when data crosses from Server Components to Client Components.
- Never log CPF, tokens, secrets, payment payloads, QR/Pix data, document contents, or unnecessary personal data.

## Supabase and database safety

- Use the authenticated Supabase client by default so RLS remains part of authorization.
- `createAdminClient()` uses privileged credentials and bypasses RLS. Keep it server-only and use it only after explicit authorization and tenant/resource checks, or in narrowly validated public/maintenance flows.
- Every object exposed through the Data API needs both least-privilege grants and appropriate RLS. `TO authenticated` is not sufficient authorization by itself.
- UPDATE policies require the supporting SELECT policy plus tenant-aware `USING` and `WITH CHECK` expressions.
- Preserve RLS, tenant predicates, audit trails, soft-delete semantics, Storage policies, and least-privilege grants whenever business flows change.
- Prefer `SECURITY INVOKER`. A necessary `SECURITY DEFINER` function must use `set search_path = ''`, schema-qualified objects, explicit caller/permission/tenant checks, revoked default execution, and minimal grants.
- New exposed views must use `security_invoker = true`; otherwise keep them in an unexposed schema with restricted grants.
- Do not use user-editable `user_metadata` for authorization decisions.
- Keep Storage buckets private unless the asset is intentionally public. Validate size, allowed type, and file signature server-side, use tenant-scoped paths, and issue short-lived signed URLs where appropriate.
- Treat every existing migration as immutable history, including empty placeholder files. Create a new migration for every schema change.
- Never apply migrations, seeds, destructive SQL, or test data to a remote or production project without explicit approval.
- Do not hand-edit `src/lib/supabase/database.types.ts`. Regenerate it after an approved schema change and report when regeneration was not possible.
- Never expose `SUPABASE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, or equivalent privileged credentials through `NEXT_PUBLIC_*`.

## Caching and invalidation

- Scope cached tenant data by `churchId`; scope event data by both church and event where applicable.
- Never cache privileged results under a key shared between users or churches.
- Reuse `src/lib/cache-tags.ts` and invalidate the affected church/event tags after mutations.
- Preserve the established combination of `cacheLife`, `cacheTag`, `updateTag`, and `revalidatePath`; consult the bundled Next.js documentation before changing cache behavior.

## External integrations and public endpoints

- External integrations include Brevo, Mercado Pago, ViaCEP, authenticated cron routes, and Supabase Storage.
- Use development credentials and Mercado Pago test/mock mode for local verification.
- Do not send real email, create a real charge, invoke a production webhook, run production maintenance, or mutate an external service without explicit approval.
- Preserve webhook signature verification, idempotency, provider-side reconciliation, and generic error responses.
- Preserve applicable public-endpoint protections: origin checks, request-size limits, schema validation, rate limits, honeypots, opaque hashed tokens, idempotency keys, and `Cache-Control: no-store`.
- Protect maintenance routes with server-only secrets. Use timeouts for external requests and avoid logging sensitive provider responses.
- Real credentials belong only in ignored environment files or the deployment secret manager. `.env.example` documents names and safe defaults only.

## Validation commands

Setup and development:

- `npm ci`
- `npm run dev`

Minimum validation for code changes:

- `npm run lint -- --max-warnings=0`
- `npm run typecheck`
- `npm test`

Additional validation:

- Run focused Vitest coverage first when behavior changes.
- Run `npm run build` for routing, configuration, caching, Server/Client boundaries, dependency, or deployment changes.
- Run `npm run test:e2e` for affected user flows. Authenticated scenarios require `E2E_STORAGE_STATE`.
- Run `npm run analyze:routes` for changes intended to affect route loading or bundle performance.
- For database changes, execute the relevant read-only SQL checks under `supabase/tests/` or `supabase/verification/` and run Supabase Security and Performance Advisors against a local or explicitly approved development environment.
- Report every skipped or failed check and its exact missing prerequisite.

## Completion criteria

Before declaring work complete:

- The change follows existing module and boundary patterns.
- New or changed behavior has focused automated coverage.
- Authentication, permission, tenant isolation, soft delete, audit, and sensitive-data handling were reviewed where applicable.
- Database changes use a new migration, preserve RLS/grants, pass relevant SQL checks, and have refreshed generated types.
- External integrations were tested only in approved test/mock conditions.
- The diff contains no secrets, customer data, generated noise, unrelated refactors, or accidental migration edits.
- Required lint, typecheck, tests, build, E2E, and database checks passed, or the final report states exactly what could not run and why.
