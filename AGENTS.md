<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Eclesias project guidance

## Project overview

- Eclesias is a multi-tenant church-management application.
- The application uses Next.js 16 App Router, React 19, TypeScript, Styled Components, Supabase, Vitest, and Playwright.
- Next.js owns the UI and server-side application layer. Supabase provides PostgreSQL, Auth, Storage, Realtime, and RLS-backed data access.
- Keep domain code grouped under `src/modules/<domain>/`. Shared UI belongs in `src/components/`, shared infrastructure in `src/lib/`, and database changes in `supabase/migrations/`.

## Local commands

- Install the exact dependency tree with `npm ci`.
- Start development with `npm run dev`.
- Run unit tests with `npm test`.
- Run linting with `npm run lint`.
- Run TypeScript validation with `npm run typecheck`.
- Run the production build with `npm run build`.
- Run browser tests with `npm run test:e2e` when the change affects a user flow.

## Working agreements

- Use `npm`; do not replace `package-lock.json` or introduce another package manager.
- Preserve Server Component, Client Component, Server Action, and route-handler boundaries already established in the codebase.
- Follow existing module patterns before introducing new abstractions or directories.
- Keep changes focused. Do not perform unrelated refactors while implementing a feature or fix.
- Add or update tests whenever behavior changes. Prefer focused tests first, then run the broader verification commands relevant to the change.
- Do not modify generated Next.js guidance at the top of this file.

## Supabase and data safety

- Treat existing migration files as immutable history. Create a new timestamped migration for schema changes.
- Never apply migrations, seed data, or destructive SQL to a remote or production database without explicit user approval.
- Every table exposed through the Data API must have appropriate grants and RLS policies. Authentication alone is not authorization; preserve church/tenant ownership predicates.
- Preserve audit logging, tenant scoping, soft-delete behavior, and storage access controls when changing business flows.
- Keep `SUPABASE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `BREVO_API_KEY`, Mercado Pago credentials, webhook secrets, and event secrets server-only. Never add `NEXT_PUBLIC_` to secrets.

## Environment and external services

- Use `.env.example` only as a variable-name template. Real credentials belong in ignored `.env.local` files.
- Never commit credentials, access tokens, customer data, exported database contents, or production logs.
- Do not send emails, create real Pix charges, invoke production webhooks, or mutate external services without explicit user approval.
- Use test or mock modes for Mercado Pago and other external integrations during local verification.

## Completion checklist

- At minimum, run `npm run lint`, `npm run typecheck`, and `npm test` for code changes.
- Run `npm run build` for changes that affect routing, configuration, server/client boundaries, or deployment behavior.
- Run focused Playwright coverage for changed end-to-end flows.
- Report any check that could not run and the exact missing prerequisite.
