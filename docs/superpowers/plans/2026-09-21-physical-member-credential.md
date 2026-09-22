# Physical Member Credential Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an authenticated administrative flow that previews and downloads a modern, two-sided CR80 physical member credential from current Supabase data.

**Architecture:** A dedicated member-credential domain service loads a tenant-scoped, minimal DTO through the authenticated Supabase client. A client modal previews that DTO, while an authenticated Route Handler re-loads the data, creates a two-page vector PDF with `pdf-lib`, records the existing audit event, and returns a non-cacheable attachment.

**Tech Stack:** Next.js 16.3 App Router, React 19, strict TypeScript, Supabase/Postgres, Styled Components, `pdf-lib` 1.17.1, Vitest 5, Playwright 1.62.

**Spec:** `docs/superpowers/specs/2026-09-21-physical-member-credential-design.md`

## Global Constraints

- Work directly on `main`; do not create a worktree.
- Use Node `>=24.12.0 <25`, `npm`, and the committed `package-lock.json`.
- Read `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` and `node_modules/next/dist/docs/01-app/02-guides/server-actions.md` before editing Route Handlers or Server Actions.
- Do not add a dependency; use the committed `pdf-lib` `1.17.1`.
- The output is a two-page vector PDF sized exactly `85.60 × 53.98 mm` per page.
- Do not add a photo, credential table, public route, real QR payload, token, validity, signature, PDF persistence, or batch issuance.
- Use the authenticated Supabase client, repeat authorization server-side, and scope every member read by both `church_id` and `member_id`.
- Apply schema/data migrations only to the linked online project after an exact `db push --dry-run` review.
- Do not log or audit names, parent names, baptism date, matrícula, PDF bytes, or other personal content.

## Review Focus

- A very long church or member name must stay inside the CR80 safe area; Task 3 tests truncation/wrapping at the maximum supported lengths.
- A malformed, white, or very light configured primary color must fall back or select dark foreground text; Task 2 tests color normalization and contrast.
- Missing Cargo, baptism date, mother, or father must render explicit fallbacks without blocking; Task 2 tests every optional-data combination.
- An archived, inactive, non-member, cross-tenant, or out-of-scope record must not leak whether it exists; Tasks 2 and 4 test the generic denial paths.
- Repeated download attempts must create one audit event per successful response and no event for failed PDF generation; Task 4 tests audit ordering and cardinality.

---

### Task 1: Credential Permission and Member Capability

**Files:**
- Create via Supabase CLI: the exact file printed by `npx supabase migration new member_physical_credential_permission` under `supabase/migrations/`
- Create: `supabase/tests/member_physical_credential_permission_verification.sql`
- Create: `src/modules/members/services/member-capabilities.test.ts`
- Modify: `src/modules/auth/constants/permissions.ts`
- Modify: `src/modules/members/types/member.types.ts`
- Modify: `src/modules/members/services/member.service.ts:69-96`

**Interfaces:**
- Produces: `PERMISSIONS.membersCredentialIssue === "members.credentials.issue"`.
- Produces: `MemberCapabilities.issueCredential: boolean` for the administrative UI.
- Consumes: existing `permissions`, `role_permissions`, `getMemberCapabilities()` and default role catalog.

- [ ] **Step 1: Create the migration with the CLI and inspect the generated path**

Run:

```bash
SUPABASE_TELEMETRY_DISABLED=1 npx supabase migration new member_physical_credential_permission
```

Expected: one empty file whose exact basename ends in `_member_physical_credential_permission.sql`. Keep the CLI-generated timestamp and do not rename it.

- [ ] **Step 2: Write the failing capability test**

Create `src/modules/members/services/member-capabilities.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { PERMISSIONS } from "@/modules/auth/constants/permissions";
import type { AuthContext } from "@/modules/auth/types/auth.types";
import { getMemberCapabilities } from "./member.service";

const baseContext = {
  church: { id: "church-1", name: "Igreja", logoUrl: null },
  profile: { id: "profile-1", fullName: "Usuário", displayName: "Usuário", email: "user@example.com", avatarUrl: null, status: "ACTIVE" },
  access: { id: "access-1", churchId: "church-1", role: "ADMIN", scope: "CHURCH", status: "ACTIVE", regionId: null, congregationId: null, ministryId: null },
  accesses: [],
  availableChurches: [],
  permissions: [],
} satisfies AuthContext;

describe("getMemberCapabilities", () => {
  it("expõe emissão somente com members.credentials.issue", () => {
    expect(getMemberCapabilities(baseContext).issueCredential).toBe(false);
    expect(getMemberCapabilities({
      ...baseContext,
      permissions: [PERMISSIONS.membersCredentialIssue],
    }).issueCredential).toBe(true);
  });
});
```

- [ ] **Step 3: Run the focused test and confirm the red state**

Run:

```bash
npm test -- src/modules/members/services/member-capabilities.test.ts
```

Expected: TypeScript/Vitest failure because `membersCredentialIssue` and `issueCredential` do not exist.

- [ ] **Step 4: Add the permission constant and capability**

Add to `PERMISSIONS`:

```ts
membersCredentialIssue: "members.credentials.issue",
```

Add to `MemberCapabilities`:

```ts
issueCredential: boolean;
```

Add to `getMemberCapabilities()`:

```ts
issueCredential: can(PERMISSIONS.membersCredentialIssue),
```

- [ ] **Step 5: Fill the generated migration with idempotent catalog and role grants**

Use this exact SQL body in the CLI-generated file:

```sql
insert into public.permissions (
  key, name, description, module, action, is_sensitive, status
)
values (
  'members.credentials.issue',
  'Emitir credencial física de membro',
  'Pré-visualizar e gerar credenciais físicas de membros',
  'members',
  'issue_credential',
  true,
  'ACTIVE'
)
on conflict do nothing;

update public.permissions
set status = 'ACTIVE', updated_at = now()
where key = 'members.credentials.issue'
  and deleted_at is null
  and status is distinct from 'ACTIVE';

insert into public.role_permissions (role, permission_id, status)
select role_name.role, permission.id, 'ACTIVE'
from (values ('ADMIN'::text), ('SECRETARY'::text)) role_name(role)
join public.permissions permission
  on permission.key = 'members.credentials.issue'
 and permission.status = 'ACTIVE'
 and permission.deleted_at is null
on conflict do nothing;

update public.role_permissions role_permission
set status = 'ACTIVE', updated_at = now()
from public.permissions permission
where role_permission.permission_id = permission.id
  and role_permission.role in ('ADMIN', 'SECRETARY')
  and role_permission.deleted_at is null
  and role_permission.status is distinct from 'ACTIVE'
  and permission.key = 'members.credentials.issue'
  and permission.status = 'ACTIVE'
  and permission.deleted_at is null;
```

- [ ] **Step 6: Add a rollback-only SQL verification**

Create `supabase/tests/member_physical_credential_permission_verification.sql`:

```sql
begin;

do $$
begin
  if (
    select count(*)
    from public.permissions
    where key = 'members.credentials.issue'
      and status = 'ACTIVE'
      and deleted_at is null
  ) <> 1 then
    raise exception 'credential permission missing or duplicated';
  end if;

  if (
    select count(*)
    from public.role_permissions role_permission
    join public.permissions permission on permission.id = role_permission.permission_id
    where permission.key = 'members.credentials.issue'
      and role_permission.role in ('ADMIN', 'SECRETARY')
      and role_permission.status = 'ACTIVE'
      and role_permission.deleted_at is null
  ) <> 2 then
    raise exception 'credential default grants missing';
  end if;
end;
$$;

rollback;
```

- [ ] **Step 7: Run the focused test and static checks**

Run:

```bash
npm test -- src/modules/members/services/member-capabilities.test.ts
npm run typecheck
```

Expected: both commands exit `0`.

- [ ] **Step 8: Commit the permission slice**

```bash
git add src/modules/auth/constants/permissions.ts src/modules/members/types/member.types.ts src/modules/members/services/member.service.ts src/modules/members/services/member-capabilities.test.ts supabase/migrations supabase/tests/member_physical_credential_permission_verification.sql
git commit -m "feat(members): add physical credential permission"
```

---

### Task 2: Tenant-Scoped Credential Domain Model

**Files:**
- Create: `src/modules/members/types/member-credential.types.ts`
- Create: `src/modules/members/services/member-credential.logic.ts`
- Create: `src/modules/members/services/member-credential.logic.test.ts`
- Create: `src/modules/members/services/member-credential.service.ts`
- Create: `src/modules/members/services/member-credential.service.test.ts`

**Interfaces:**
- Consumes: `AuthContext`, authenticated `createClient()`, `PERMISSIONS.membersCredentialIssue` at entry points.
- Produces: `MemberCredentialPreview`, `MemberCredentialError`, `buildMemberCredentialPreview()`, and `loadMemberCredentialPreview(context, memberId)`.
- Produces: a safe filename formed by `credencial-`, the sanitized member code, and `.pdf` for Task 4.

- [ ] **Step 1: Define the credential types and error contract**

Create `src/modules/members/types/member-credential.types.ts`:

```ts
export type MemberCredentialWarning =
  | "MISSING_ROLE"
  | "MISSING_BAPTISM_DATE"
  | "MISSING_MOTHER_NAME"
  | "MISSING_FATHER_NAME";

export type MemberCredentialPreview = {
  issuedAt: string;
  fileName: string;
  church: {
    name: string;
    primaryColor: string;
    primaryDarkColor: string;
    foregroundColor: "#FFFFFF" | "#101828";
  };
  member: {
    id: string;
    fullName: string;
    roleName: string;
    memberCode: string;
    congregationName: string;
    baptismDate: string;
    motherName: string;
    fatherName: string;
  };
  warnings: MemberCredentialWarning[];
};

export type MemberCredentialSource = {
  issuedAt: string;
  churchName: string;
  primaryColor: string | null;
  member: {
    id: string;
    fullName: string | null;
    gender: string | null;
    memberCode: string | null;
    memberStatus: string;
    memberType: string;
    deletedAt: string | null;
    congregationName: string | null;
    baptismDate: string | null;
    motherName: string | null;
    fatherName: string | null;
    activeRole: {
      titleVariant: string | null;
      name: string;
      femaleName: string | null;
    } | null;
  };
};

export type MemberCredentialErrorCode =
  | "MEMBER_CREDENTIAL_NOT_FOUND"
  | "MEMBER_CREDENTIAL_INELIGIBLE"
  | "MEMBER_CREDENTIAL_INCOMPLETE"
  | "MEMBER_CREDENTIAL_LOAD_FAILED"
  | "MEMBER_CREDENTIAL_AUDIT_FAILED";

export class MemberCredentialError extends Error {
  constructor(public readonly code: MemberCredentialErrorCode) {
    super(code);
    this.name = "MemberCredentialError";
  }
}
```

- [ ] **Step 2: Write failing pure-domain tests**

Create tests that pass raw member/settings rows into `buildMemberCredentialPreview()`. Define this baseline fixture at the top of the test and override only the field under test:

```ts
const sourceFixture: MemberCredentialSource = {
  issuedAt: "2026-09-21T12:00:00.000Z",
  churchName: "Igreja Batista Central",
  primaryColor: "#415BA5",
  member: {
    id: "11111111-1111-4111-8111-111111111111",
    fullName: "Maria de Souza",
    gender: "FEMALE",
    memberCode: "MEM000123",
    memberStatus: "ACTIVE",
    memberType: "MEMBER",
    deletedAt: null,
    congregationName: "Congregação Central",
    baptismDate: "2018-04-10",
    motherName: null,
    fatherName: null,
    activeRole: {
      titleVariant: "AUTO",
      name: "Diácono",
      femaleName: "Diaconisa",
    },
  },
};

function validInput(
  override: Partial<MemberCredentialSource["member"]> & { primaryColor?: string | null } = {},
): MemberCredentialSource {
  const { primaryColor = sourceFixture.primaryColor, ...memberOverride } = override;
  return {
    ...sourceFixture,
    primaryColor,
    member: { ...sourceFixture.member, ...memberOverride },
  };
}
```

Then assert:

```ts
expect(result.member).toMatchObject({
  fullName: "Maria de Souza",
  roleName: "Diaconisa",
  memberCode: "MEM000123",
  congregationName: "Congregação Central",
  baptismDate: "10/04/2018",
  motherName: "Não informado",
  fatherName: "Não informado",
});
expect(result.warnings).toEqual(["MISSING_MOTHER_NAME", "MISSING_FATHER_NAME"]);
expect(result.fileName).toBe("credencial-MEM000123.pdf");
```

Cover invalid and very light colors separately in the same file:

```ts
it.each(["", "#fff", "white"])("usa fallback para cor inválida: %s", (color) => {
  const result = buildMemberCredentialPreview(validInput({ primaryColor: color }));
  expect(result.church.primaryColor).toBe("#415BA5");
});

it.each(["#FFFFFF", "#F2F4F7"])("preserva cor clara com texto escuro: %s", (color) => {
  const result = buildMemberCredentialPreview(validInput({ primaryColor: color }));
  expect(result.church.primaryColor).toBe(color);
  expect(result.church.foregroundColor).toBe("#101828");
});

it.each([
  { memberStatus: "INACTIVE", memberType: "MEMBER", deletedAt: null },
  { memberStatus: "ACTIVE", memberType: "VISITOR", deletedAt: null },
  { memberStatus: "ACTIVE", memberType: "MEMBER", deletedAt: "2026-09-21T00:00:00Z" },
])("rejeita membro inelegível %#", (override) => {
  expect(() => buildMemberCredentialPreview(validInput(override)))
    .toThrowError("MEMBER_CREDENTIAL_INELIGIBLE");
});
```

Also assert that missing `fullName`, `memberCode`, or `congregationName` throws `MEMBER_CREDENTIAL_INCOMPLETE`, while a 100-character church name and 120-character member name are normalized without being silently emptied.

```ts
it.each(["fullName", "memberCode", "congregationName"] as const)(
  "bloqueia campo obrigatório ausente: %s",
  (field) => {
    expect(() => buildMemberCredentialPreview(validInput({ [field]: "" })))
      .toThrowError("MEMBER_CREDENTIAL_INCOMPLETE");
  },
);

it("preserva entradas longas para o renderizador ajustar", () => {
  const result = buildMemberCredentialPreview({
    ...sourceFixture,
    churchName: "I".repeat(100),
    member: { ...sourceFixture.member, fullName: "M".repeat(120) },
  });
  expect(result.church.name).toHaveLength(100);
  expect(result.member.fullName).toHaveLength(120);
});
```

- [ ] **Step 3: Run the pure-domain tests and confirm failure**

```bash
npm test -- src/modules/members/services/member-credential.logic.test.ts
```

Expected: FAIL because the logic module does not exist.

- [ ] **Step 4: Implement normalization, eligibility, role title, warnings and filename**

Create `member-credential.logic.ts` with these exported interfaces and functions:

```ts
import type {
  MemberCredentialPreview,
  MemberCredentialSource,
} from "../types/member-credential.types";

export function normalizeCredentialColor(value: string | null): {
  primaryColor: string;
  primaryDarkColor: string;
  foregroundColor: "#FFFFFF" | "#101828";
};

export const FAKE_QR_PATTERN: readonly (readonly boolean[])[];

export function isCredentialMemberId(value: string): boolean;

export function buildMemberCredentialPreview(source: MemberCredentialSource): MemberCredentialPreview;
```

Use these rules in the implementation:

```ts
const FALLBACK_PRIMARY = "#415BA5";
const FALLBACK_TEXT = "Não informado";
const normalized = /^#[0-9a-f]{6}$/i.test(value?.trim() ?? "")
  ? value!.trim().toUpperCase()
  : FALLBACK_PRIMARY;
const useFemaleTitle = role?.titleVariant === "FEMALE"
  || (role?.titleVariant === "AUTO" && member.gender === "FEMALE");
const roleName = role
  ? useFemaleTitle && role.femaleName ? role.femaleName : role.name
  : "Sem cargo cadastrado";
```

Define `FAKE_QR_PATTERN` as one fixed square boolean matrix with three finder-style corner blocks and an intentionally invalid center pattern. Both PDF and browser preview must consume this same constant. Implement `isCredentialMemberId` with the canonical UUID shape and version/variant positions so the action and route share one validator. Darken RGB channels by 18% for `primaryDarkColor`, then calculate WCAG contrast ratios for `#FFFFFF` and `#101828` against that header color and choose the higher-ratio foreground. If both ratios are below `4.5:1`, continue darkening `primaryDarkColor` until white reaches `4.5:1`; preserve the configured `primaryColor` for decorative accents. Test one light, one dark and one mid-luminance color and assert the chosen pair is at least `4.5:1`. Format date-only values in UTC as `dd/MM/yyyy`. Sanitize the matrícula with `replace(/[^A-Za-z0-9_-]/g, "-")`, collapse repeated hyphens, and cap it at 48 characters.

- [ ] **Step 5: Run the pure-domain tests to green**

```bash
npm test -- src/modules/members/services/member-credential.logic.test.ts
```

Expected: all credential logic cases pass.

- [ ] **Step 6: Write failing tenant-query tests**

Mock `createClient()` using the chained-query pattern from `member-events.service.test.ts`. Assert that the member query contains:

```ts
expect(memberQuery.eq.mock.calls).toContainEqual(["id", "11111111-1111-4111-8111-111111111111"]);
expect(memberQuery.eq.mock.calls).toContainEqual(["church_id", "church-1"]);
expect(memberQuery.is).toHaveBeenCalledWith("deleted_at", null);
```

Assert that settings are queried with `church_id = context.church.id`, only one active/non-deleted role is selected, a null row becomes `MEMBER_CREDENTIAL_NOT_FOUND`, and a Supabase error becomes `MEMBER_CREDENTIAL_LOAD_FAILED` without including the provider message.

```ts
expect(settingsQuery.eq).toHaveBeenCalledWith("church_id", "church-1");
expect(memberQuery.eq.mock.calls).toContainEqual(["active_roles.status", "ACTIVE"]);
expect(memberQuery.is.mock.calls).toContainEqual(["active_roles.deleted_at", null]);

memberQuery.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
await expect(loadMemberCredentialPreview(context, memberId))
  .rejects.toThrowError("MEMBER_CREDENTIAL_NOT_FOUND");

memberQuery.maybeSingle.mockResolvedValueOnce({
  data: null,
  error: { message: "provider details must remain private" },
});
await expect(loadMemberCredentialPreview(context, memberId))
  .rejects.toThrowError("MEMBER_CREDENTIAL_LOAD_FAILED");
```

- [ ] **Step 7: Implement the server-only loader**

Create `member-credential.service.ts` beginning with:

```ts
import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { AuthContext } from "@/modules/auth/types/auth.types";
import { buildMemberCredentialPreview } from "./member-credential.logic";
import { MemberCredentialError } from "../types/member-credential.types";

export async function loadMemberCredentialPreview(
  context: AuthContext,
  memberId: string,
  issuedAt = new Date().toISOString(),
) {
  const supabase = await createClient();
  const [memberResult, settingsResult] = await Promise.all([
    supabase
      .from("members")
      .select(MEMBER_CREDENTIAL_SELECT)
      .eq("id", memberId)
      .eq("church_id", context.church.id)
      .is("deleted_at", null)
      .eq("active_roles.status", "ACTIVE")
      .is("active_roles.deleted_at", null)
      .maybeSingle(),
    supabase
      .from("app_settings")
      .select("display_church_name, primary_color")
      .eq("church_id", context.church.id)
      .maybeSingle(),
  ]);

  if (memberResult.error || settingsResult.error) {
    throw new MemberCredentialError("MEMBER_CREDENTIAL_LOAD_FAILED");
  }
  if (!memberResult.data) {
    throw new MemberCredentialError("MEMBER_CREDENTIAL_NOT_FOUND");
  }

  const row = memberResult.data as unknown as AnyRow;
  const settings = (settingsResult.data ?? {}) as AnyRow;
  const congregation = first<AnyRow>(row.congregations);
  const activeRoleLink = ((row.active_roles ?? []) as AnyRow[])
    .find((link) => link.status === "ACTIVE" && !link.deleted_at);
  const role = first<AnyRow>(activeRoleLink?.role);

  return buildMemberCredentialPreview({
    issuedAt,
    churchName: settings.display_church_name?.trim() || context.church.name,
    primaryColor: settings.primary_color ?? null,
    member: {
      id: row.id,
      fullName: row.full_name,
      gender: row.gender,
      memberCode: row.member_code,
      memberStatus: row.member_status,
      memberType: row.member_type,
      deletedAt: row.deleted_at,
      congregationName: congregation?.name ?? null,
      baptismDate: row.baptism_date,
      motherName: row.mother_name,
      fatherName: row.father_name,
      activeRole: role ? {
        titleVariant: activeRoleLink?.title_variant ?? null,
        name: role.name,
        femaleName: role.female_name,
      } : null,
    },
  });
}
```

Select only:

```text
id, full_name, gender, member_code, member_status, member_type, deleted_at,
baptism_date, mother_name, father_name,
congregations!inner(name),
active_roles:member_roles!member_roles_member_id_fkey(status, deleted_at, title_variant, role:roles!member_roles_role_id_fkey(name, female_name))
```

Define `AnyRow` and `first()` locally following `member.service.ts`, and define `MEMBER_CREDENTIAL_SELECT` from the exact field list above. The authenticated client and RLS enforce organizational scope in addition to the explicit `church_id` and member filters. Execute both independent reads with `Promise.all`, map provider errors to `MEMBER_CREDENTIAL_LOAD_FAILED`, map a null member row to `MEMBER_CREDENTIAL_NOT_FOUND`, and pass only the selected fields into `buildMemberCredentialPreview`.

- [ ] **Step 8: Run domain tests and typecheck**

```bash
npm test -- src/modules/members/services/member-credential.logic.test.ts src/modules/members/services/member-credential.service.test.ts
npm run typecheck
```

Expected: all tests and typecheck pass.

- [ ] **Step 9: Commit the domain slice**

```bash
git add src/modules/members/types/member-credential.types.ts src/modules/members/services/member-credential.logic.ts src/modules/members/services/member-credential.logic.test.ts src/modules/members/services/member-credential.service.ts src/modules/members/services/member-credential.service.test.ts
git commit -m "feat(members): model physical credential data"
```

---

### Task 3: Two-Sided CR80 PDF Renderer

**Files:**
- Create: `src/modules/members/services/member-credential-pdf.service.ts`
- Create: `src/modules/members/services/member-credential-pdf.service.test.ts`

**Interfaces:**
- Consumes: `MemberCredentialPreview` from Task 2.
- Produces: `createMemberCredentialPdf(preview): Promise<Uint8Array>`.
- Produces: exported `CR80_WIDTH_PT` and `CR80_HEIGHT_PT` for exact-dimension tests.

- [ ] **Step 1: Write the failing PDF contract test**

```ts
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import {
  CR80_HEIGHT_PT,
  CR80_WIDTH_PT,
  createMemberCredentialPdf,
} from "./member-credential-pdf.service";

const preview: MemberCredentialPreview = {
  issuedAt: "2026-09-21T12:00:00.000Z",
  fileName: "credencial-MEM000123.pdf",
  church: {
    name: "Igreja Batista Central",
    primaryColor: "#415BA5",
    primaryDarkColor: "#354B8E",
    foregroundColor: "#FFFFFF",
  },
  member: {
    id: "11111111-1111-4111-8111-111111111111",
    fullName: "Maria de Souza",
    roleName: "Diaconisa",
    memberCode: "MEM000123",
    congregationName: "Congregação Central",
    baptismDate: "10/04/2018",
    motherName: "Não informado",
    fatherName: "Não informado",
  },
  warnings: ["MISSING_MOTHER_NAME", "MISSING_FATHER_NAME"],
};

it("gera frente e verso no tamanho CR80", async () => {
  const bytes = await createMemberCredentialPdf(preview);
  const document = await PDFDocument.load(bytes);
  expect(document.getPages()).toHaveLength(2);
  for (const page of document.getPages()) {
    expect(page.getWidth()).toBeCloseTo(CR80_WIDTH_PT, 2);
    expect(page.getHeight()).toBeCloseTo(CR80_HEIGHT_PT, 2);
  }
  expect(document.getTitle()).toBe("Credencial física de membro");
  expect(document.getSubject()).toBe("Documento de identificação eclesiástica");
});
```

Add tests with a 100-character church name, 120-character full name, 80-character congregation, and all fallback values. Assert PDF creation resolves and both pages retain the exact dimensions.

- [ ] **Step 2: Run the PDF test and confirm the red state**

```bash
npm test -- src/modules/members/services/member-credential-pdf.service.test.ts
```

Expected: FAIL because the renderer does not exist.

- [ ] **Step 3: Implement exact physical units and reusable drawing helpers**

Start the service with:

```ts
import "server-only";

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { MemberCredentialPreview } from "../types/member-credential.types";
import { FAKE_QR_PATTERN } from "./member-credential.logic";

const MM_TO_PT = 72 / 25.4;
export const CR80_WIDTH_PT = 85.6 * MM_TO_PT;
export const CR80_HEIGHT_PT = 53.98 * MM_TO_PT;
const SAFE = 3.2 * MM_TO_PT;
type Fonts = { regular: PDFFont; bold: PDFFont };

function hexToRgb(hex: string) {
  return rgb(
    Number.parseInt(hex.slice(1, 3), 16) / 255,
    Number.parseInt(hex.slice(3, 5), 16) / 255,
    Number.parseInt(hex.slice(5, 7), 16) / 255,
  );
}

function cleanText(text: string) {
  return text
    .normalize("NFC")
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, "...")
    .replace(/\u2022/g, "-")
    .replace(/[^\u0009\u000A\u000D\u0020-\u007E\u00A0-\u00FF]/g, "?");
}

function fitText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const clean = cleanText(text);
  if (font.widthOfTextAtSize(clean, size) <= maxWidth) return clean;
  let value = clean;
  while (value.length && font.widthOfTextAtSize(`${value}...`, size) > maxWidth) value = value.slice(0, -1);
  return `${value}...`;
}
```

Add focused helpers `drawHeader`, `drawDecorativeCurves`, `drawLabelValue`, `drawFakeQr`, `drawFront`, and `drawBack`. `drawFakeQr` must render `FAKE_QR_PATTERN`; do not import a QR library and do not encode text. Embed `StandardFonts.Helvetica` and `StandardFonts.HelveticaBold` once, construct `Fonts`, then pass it to both pages. Pass every variable string through `cleanText` before measuring or drawing it, and add a regression test with an emoji/non-WinAnsi character to prove PDF generation still succeeds.

- [ ] **Step 4: Implement the front and back hierarchy**

Use this concrete layout, keeping `drawDecorativeCurves` limited to two low-opacity/off-page ellipses so it never obscures text:

```ts
const HEADER_HEIGHT = 12 * MM_TO_PT;
const INK = rgb(16 / 255, 24 / 255, 40 / 255);
const MUTED = rgb(71 / 255, 84 / 255, 103 / 255);
const SURFACE = rgb(242 / 255, 244 / 255, 247 / 255);

function wrapText(text: string, font: PDFFont, size: number, width: number, maxLines: number) {
  const words = cleanText(text).trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  for (const word of words) {
    const candidate = lines.length ? `${lines.at(-1)} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= width) {
      if (lines.length) lines[lines.length - 1] = candidate;
      else lines.push(candidate);
    } else if (lines.length < maxLines) {
      lines.push(fitText(word, font, size, width));
    } else {
      lines[lines.length - 1] = fitText(`${lines.at(-1)} ${word}`, font, size, width);
    }
  }
  return lines.slice(0, maxLines);
}

function drawDecorativeCurves(page: PDFPage, preview: MemberCredentialPreview) {
  page.drawEllipse({
    x: CR80_WIDTH_PT - 8,
    y: 9,
    xScale: 44,
    yScale: 28,
    color: hexToRgb(preview.church.primaryColor),
    opacity: 0.08,
  });
  page.drawEllipse({
    x: 8,
    y: CR80_HEIGHT_PT - HEADER_HEIGHT - 5,
    xScale: 32,
    yScale: 18,
    color: hexToRgb(preview.church.primaryDarkColor),
    opacity: 0.06,
  });
}

function drawHeader(page: PDFPage, preview: MemberCredentialPreview, fonts: Fonts) {
  const background = hexToRgb(preview.church.primaryDarkColor);
  const foreground = hexToRgb(preview.church.foregroundColor);
  page.drawRectangle({ x: 0, y: CR80_HEIGHT_PT - HEADER_HEIGHT, width: CR80_WIDTH_PT, height: HEADER_HEIGHT, color: background });
  page.drawText(fitText(preview.church.name.toUpperCase(), fonts.bold, 8.2, CR80_WIDTH_PT - (SAFE * 2)), {
    x: SAFE,
    y: CR80_HEIGHT_PT - HEADER_HEIGHT + 12,
    size: 8.2,
    font: fonts.bold,
    color: foreground,
  });
}

function drawFakeQr(page: PDFPage, x: number, y: number, size: number) {
  const moduleSize = size / FAKE_QR_PATTERN.length;
  page.drawRectangle({ x, y, width: size, height: size, color: rgb(1, 1, 1), borderColor: INK, borderWidth: 0.6 });
  FAKE_QR_PATTERN.forEach((row, rowIndex) => row.forEach((filled, columnIndex) => {
    if (!filled) return;
    page.drawRectangle({
      x: x + (columnIndex * moduleSize),
      y: y + size - ((rowIndex + 1) * moduleSize),
      width: moduleSize,
      height: moduleSize,
      color: INK,
    });
  }));
}

function drawLabelValue(
  page: PDFPage,
  fonts: Fonts,
  label: string,
  value: string,
  x: number,
  y: number,
  width: number,
) {
  page.drawText(cleanText(label).toUpperCase(), { x, y, size: 4.5, font: fonts.bold, color: MUTED });
  page.drawText(fitText(value, fonts.bold, 7.2, width), { x, y: y - 9, size: 7.2, font: fonts.bold, color: INK });
}

function drawFront(page: PDFPage, preview: MemberCredentialPreview, fonts: Fonts) {
  page.drawRectangle({ x: 0, y: 0, width: CR80_WIDTH_PT, height: CR80_HEIGHT_PT, color: rgb(1, 1, 1) });
  drawDecorativeCurves(page, preview);
  drawHeader(page, preview, fonts);
  const contentTop = CR80_HEIGHT_PT - HEADER_HEIGHT - 9;
  const leftWidth = (CR80_WIDTH_PT - (SAFE * 2)) * 0.67;
  const nameLines = wrapText(preview.member.fullName, fonts.bold, 10.5, leftWidth, 2);
  nameLines.forEach((line, index) => page.drawText(line, {
    x: SAFE,
    y: contentTop - (index * 11),
    size: 10.5,
    font: fonts.bold,
    color: INK,
  }));
  const detailsTop = contentTop - (nameLines.length * 11) - 3;
  drawLabelValue(page, fonts, "Cargo", preview.member.roleName, SAFE, detailsTop, leftWidth);
  drawLabelValue(page, fonts, "Matrícula", preview.member.memberCode, SAFE, detailsTop - 22, leftWidth * 0.42);
  drawLabelValue(page, fonts, "Congregação", preview.member.congregationName, SAFE + (leftWidth * 0.46), detailsTop - 22, leftWidth * 0.54);
  const qrSize = 42;
  const qrX = CR80_WIDTH_PT - SAFE - qrSize;
  drawFakeQr(page, qrX, 37, qrSize);
  page.drawText("VALIDAÇÃO EM BREVE", { x: qrX - 1, y: 27, size: 4.2, font: fonts.bold, color: MUTED });
}

function drawBack(page: PDFPage, preview: MemberCredentialPreview, fonts: Fonts) {
  page.drawRectangle({ x: 0, y: 0, width: CR80_WIDTH_PT, height: CR80_HEIGHT_PT, color: SURFACE });
  drawDecorativeCurves(page, preview);
  drawHeader(page, preview, fonts);
  const width = CR80_WIDTH_PT - (SAFE * 2);
  drawLabelValue(page, fonts, "Data do batismo", preview.member.baptismDate, SAFE, 105, width);
  drawLabelValue(page, fonts, "Nome da mãe", preview.member.motherName, SAFE, 76, width);
  drawLabelValue(page, fonts, "Nome do pai", preview.member.fatherName, SAFE, 47, width);
  page.drawText("Documento de identificação eclesiástica", {
    x: SAFE,
    y: SAFE,
    size: 4.5,
    font: fonts.regular,
    color: MUTED,
  });
}
```

Implement `createMemberCredentialPdf` by creating the document, embedding the two fonts, adding exactly two pages with `[CR80_WIDTH_PT, CR80_HEIGHT_PT]`, calling `drawFront` and `drawBack`, setting the metadata below, and returning `document.save()`.

Set only non-personal PDF metadata:

```ts
document.setTitle("Credencial física de membro");
document.setAuthor("Eclésias");
document.setSubject("Documento de identificação eclesiástica");
document.setCreator("Eclésias");
document.setProducer("Eclésias");
document.setCreationDate(new Date(preview.issuedAt));
```

- [ ] **Step 5: Run PDF tests to green**

```bash
npm test -- src/modules/members/services/member-credential-pdf.service.test.ts
```

Expected: all PDF contract and long-text cases pass.

- [ ] **Step 6: Generate and visually inspect the QA artifact**

In the PDF test, gate a temporary write behind `GENERATE_CREDENTIAL_QA=1`:

```ts
if (process.env.GENERATE_CREDENTIAL_QA === "1") {
  await mkdir("tmp/pdfs", { recursive: true });
  await writeFile("tmp/pdfs/member-credential-qa.pdf", bytes);
}
```

Run:

```bash
GENERATE_CREDENTIAL_QA=1 npm test -- src/modules/members/services/member-credential-pdf.service.test.ts
pdftoppm -png -r 180 tmp/pdfs/member-credential-qa.pdf tmp/pdfs/member-credential-qa
```

Inspect both PNG pages at original resolution. Confirm safe margins, readable accents, no clipped long names, consistent headers, and that the fake QR visually reads as demonstrative. If `pdftoppm` is unavailable, record that exact prerequisite and use the repository PDF rendering runtime instead.

- [ ] **Step 7: Commit the PDF slice**

```bash
git add src/modules/members/services/member-credential-pdf.service.ts src/modules/members/services/member-credential-pdf.service.test.ts
git commit -m "feat(members): render two-sided physical credential"
```

---

### Task 4: Authorized Preview, Download Route, and Audit

**Files:**
- Create: `src/modules/members/actions/member-credential.actions.ts`
- Create: `src/modules/members/actions/member-credential.actions.test.ts`
- Create: `src/app/api/members/[memberId]/credential/pdf/route.ts`
- Create: `src/app/api/members/[memberId]/credential/pdf/route.test.ts`
- Modify: `src/modules/members/services/member-credential.service.ts`
- Modify: `src/modules/members/services/member-credential.service.test.ts`

**Interfaces:**
- Consumes: permission, preview loader, error contract and PDF renderer from Tasks 1–3.
- Produces: `getMemberCredentialPreviewAction(memberId)` safe action result.
- Produces: `generateMemberCredentialDownload(context, memberId)` returning `{ body, fileName }` only after audit succeeds.
- Produces: authenticated `GET /api/members/:memberId/credential/pdf`.

- [ ] **Step 1: Write failing action tests**

Mock `requireAccessContext` and `loadMemberCredentialPreview`. Use `memberId = "11111111-1111-4111-8111-111111111111"` throughout the action, service and route tests. Assert:

```ts
expect(requireAccessContext).toHaveBeenCalledWith(PERMISSIONS.membersCredentialIssue);
expect(await getMemberCredentialPreviewAction("11111111-1111-4111-8111-111111111111")).toEqual({
  success: true,
  data: preview,
});
```

For `MEMBER_CREDENTIAL_NOT_FOUND`, `INELIGIBLE`, and `INCOMPLETE`, assert the action returns these exact safe messages, respectively:

```text
Membro não encontrado ou fora do seu escopo.
A credencial é emitida somente para membros ativos.
Preencha nome, matrícula e congregação antes de emitir a credencial.
```

Unknown/provider errors return `Não foi possível preparar a credencial agora.` and never expose the original message.

- [ ] **Step 2: Implement the preview Server Action**

```ts
"use server";

import { PERMISSIONS } from "@/modules/auth/constants/permissions";
import { requireAccessContext } from "@/modules/auth/services/access-context.service";
import { MemberCredentialError } from "../types/member-credential.types";
import { isCredentialMemberId } from "../services/member-credential.logic";
import { loadMemberCredentialPreview } from "../services/member-credential.service";

const credentialMessages = {
  MEMBER_CREDENTIAL_NOT_FOUND: "Membro não encontrado ou fora do seu escopo.",
  MEMBER_CREDENTIAL_INELIGIBLE: "A credencial é emitida somente para membros ativos.",
  MEMBER_CREDENTIAL_INCOMPLETE: "Preencha nome, matrícula e congregação antes de emitir a credencial.",
} as const;

function credentialMessage(error: unknown) {
  if (error instanceof MemberCredentialError && error.code in credentialMessages) {
    return credentialMessages[error.code as keyof typeof credentialMessages];
  }
  return "Não foi possível preparar a credencial agora.";
}

export async function getMemberCredentialPreviewAction(memberId: string) {
  const context = await requireAccessContext(PERMISSIONS.membersCredentialIssue);
  if (!isCredentialMemberId(memberId)) {
    return { success: false as const, message: credentialMessages.MEMBER_CREDENTIAL_NOT_FOUND };
  }
  try {
    return { success: true as const, data: await loadMemberCredentialPreview(context, memberId) };
  } catch (error) {
    return { success: false as const, message: credentialMessage(error) };
  }
}
```

Validate `memberId` as a UUID-shaped string before the query; invalid input returns the generic not-found message.

- [ ] **Step 3: Write failing generation/audit ordering tests**

Mock the preview loader, PDF renderer, Supabase RPC and clock. Assert the order:

```ts
expect(mocks.createPdf.mock.invocationCallOrder[0])
  .toBeLessThan(mocks.auditRpc.mock.invocationCallOrder[0]);
expect(mocks.auditRpc).toHaveBeenCalledWith("log_audit", {
  p_church_id: "church-1",
  p_module: "MEMBERS",
  p_action: "ISSUE_MEMBER_PHYSICAL_CREDENTIAL",
  p_entity_type: "MEMBER",
  p_entity_id: "11111111-1111-4111-8111-111111111111",
  p_entity_label: null,
  p_description: "Credencial física de membro emitida",
  p_old_values: null,
  p_new_values: null,
  p_metadata: { format: "pdf", sides: 2, qr_mode: "DEMONSTRATIVE" },
  p_severity: "INFO",
});
```

Assert PDF failure calls audit zero times, audit failure throws `MEMBER_CREDENTIAL_AUDIT_FAILED`, and two successful invocations create exactly two audit calls.

- [ ] **Step 4: Implement the download service**

Add to `member-credential.service.ts`:

```ts
export async function generateMemberCredentialDownload(
  context: AuthContext,
  memberId: string,
) {
  const preview = await loadMemberCredentialPreview(context, memberId);
  const body = await createMemberCredentialPdf(preview);
  const supabase = await createClient();
  const { error } = await supabase.rpc("log_audit", {
    p_church_id: context.church.id,
    p_module: "MEMBERS",
    p_action: "ISSUE_MEMBER_PHYSICAL_CREDENTIAL",
    p_entity_type: "MEMBER",
    p_entity_id: memberId,
    p_entity_label: null,
    p_description: "Credencial física de membro emitida",
    p_old_values: null,
    p_new_values: null,
    p_metadata: { format: "pdf", sides: 2, qr_mode: "DEMONSTRATIVE" },
    p_severity: "INFO",
  });
  if (error) throw new MemberCredentialError("MEMBER_CREDENTIAL_AUDIT_FAILED");
  return { body, fileName: preview.fileName };
}
```

- [ ] **Step 5: Write failing Route Handler tests**

Mock `resolveAccessContext`, not `requireAccessContext`, because API endpoints must return status codes instead of Next.js redirect responses. Test success, invalid UUID, not found, ineligible, incomplete, unauthenticated/forbidden, and unknown failures. On success assert:

```ts
expect(response.status).toBe(200);
expect(response.headers.get("content-type")).toBe("application/pdf");
expect(response.headers.get("content-disposition"))
  .toBe('attachment; filename="credencial-MEM000123.pdf"');
expect(response.headers.get("cache-control")).toBe("private, no-store");
expect(response.headers.get("x-content-type-options")).toBe("nosniff");
```

- [ ] **Step 6: Implement the authenticated Route Handler**

```ts
import { NextResponse } from "next/server";
import { PERMISSIONS } from "@/modules/auth/constants/permissions";
import { resolveAccessContext } from "@/modules/auth/services/access-context.service";
import { MemberCredentialError } from "@/modules/members/types/member-credential.types";
import { isCredentialMemberId } from "@/modules/members/services/member-credential.logic";
import { generateMemberCredentialDownload } from "@/modules/members/services/member-credential.service";

function errorResponse(status: number, message: string) {
  return NextResponse.json({ message }, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function credentialHttpError(error: unknown) {
  if (!(error instanceof MemberCredentialError)) {
    return { status: 500, message: "Não foi possível gerar a credencial agora." };
  }
  if (error.code === "MEMBER_CREDENTIAL_NOT_FOUND") {
    return { status: 404, message: "Membro não encontrado ou fora do seu escopo." };
  }
  if (error.code === "MEMBER_CREDENTIAL_INELIGIBLE") {
    return { status: 422, message: "A credencial é emitida somente para membros ativos." };
  }
  if (error.code === "MEMBER_CREDENTIAL_INCOMPLETE") {
    return { status: 422, message: "Preencha nome, matrícula e congregação antes de emitir a credencial." };
  }
  return { status: 500, message: "Não foi possível gerar a credencial agora." };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ memberId: string }> },
) {
  const access = await resolveAccessContext();
  if (access.status === "anonymous") return errorResponse(401, "Autenticação necessária.");
  if (access.status !== "ready") return errorResponse(403, "Acesso não autorizado.");
  if (!access.context.permissions.includes(PERMISSIONS.membersCredentialIssue)) {
    return errorResponse(403, "Acesso não autorizado.");
  }

  try {
    const { memberId } = await params;
    if (!isCredentialMemberId(memberId)) {
      return errorResponse(404, "Membro não encontrado ou fora do seu escopo.");
    }
    const result = await generateMemberCredentialDownload(access.context, memberId);
    return new NextResponse(new Uint8Array(result.body), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${result.fileName}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const { status, message } = credentialHttpError(error);
    return errorResponse(status, message);
  }
}
```

Keep authentication/permission mapping at `401/403`, domain not-found at `404`, ineligible/incomplete at `422`, and unknown/audit errors at `500`. The tests must also prove that invalid IDs and rejected access never call `generateMemberCredentialDownload`.

- [ ] **Step 7: Run action, service and route tests**

```bash
npm test -- src/modules/members/actions/member-credential.actions.test.ts src/modules/members/services/member-credential.service.test.ts 'src/app/api/members/[memberId]/credential/pdf/route.test.ts'
npm run typecheck
```

Expected: all tests and typecheck pass.

- [ ] **Step 8: Commit the server delivery slice**

```bash
git add src/modules/members/actions/member-credential.actions.ts src/modules/members/actions/member-credential.actions.test.ts src/modules/members/services/member-credential.service.ts src/modules/members/services/member-credential.service.test.ts 'src/app/api/members/[memberId]/credential/pdf/route.ts' 'src/app/api/members/[memberId]/credential/pdf/route.test.ts'
git commit -m "feat(members): serve authorized credential PDF"
```

---

### Task 5: Modern Administrative Preview Modal

**Files:**
- Create: `src/modules/members/components/member-credential-modal.tsx`
- Create: `src/modules/members/components/member-credential.styles.ts`
- Create: `src/modules/members/utils/member-credential-view.ts`
- Create: `src/modules/members/utils/member-credential-view.test.ts`
- Modify: `src/modules/members/components/member-details-modal.tsx:1-48, 236-252, 674-696, 1248-1252`

**Interfaces:**
- Consumes: `MemberCapabilities.issueCredential`, `getMemberCredentialPreviewAction()`, `MemberCredentialPreview`, and the download route.
- Produces: `MemberCredentialModal({ memberId, onClose })` and a footer action in the existing member details modal.

- [ ] **Step 1: Write failing view-model tests**

Create `member-credential-view.ts` with intended exports and write tests first:

```ts
export function credentialWarningLabel(warning: MemberCredentialWarning): string;
export function credentialDownloadUrl(memberId: string): string;
```

Assert all four warnings map to concise Portuguese labels and that the URL encodes the member ID:

```ts
expect(credentialDownloadUrl("member 1"))
  .toBe("/api/members/member%201/credential/pdf");
expect(credentialWarningLabel("MISSING_BAPTISM_DATE"))
  .toBe("Data do batismo não informada");
```

- [ ] **Step 2: Run the view-model test and confirm failure**

```bash
npm test -- src/modules/members/utils/member-credential-view.test.ts
```

Expected: FAIL because the utility does not exist.

- [ ] **Step 3: Implement the pure view helpers**

Use an exhaustive `Record<MemberCredentialWarning, string>` and `encodeURIComponent(memberId)`; no fallback branch may expose an enum value to the user.

- [ ] **Step 4: Build the preview modal state machine**

Implement these states in `member-credential-modal.tsx`:

```ts
type CredentialModalState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; preview: MemberCredentialPreview };
```

On mount call `getMemberCredentialPreviewAction(memberId)`. Abort state updates after unmount. The ready state renders two accessible cards labeled `Frente da credencial` and `Verso da credencial`, a warning list when needed, `Cancelar`, and `Baixar PDF`.

The download handler must:

```ts
const response = await fetch(credentialDownloadUrl(memberId), {
  method: "GET",
  cache: "no-store",
  credentials: "same-origin",
});
if (!response.ok) {
  const payload = await response.json().catch(() => null) as { message?: string } | null;
  throw new Error(payload?.message ?? "Não foi possível baixar a credencial.");
}
const url = URL.createObjectURL(await response.blob());
const anchor = document.createElement("a");
anchor.href = url;
anchor.download = preview.fileName;
anchor.click();
window.setTimeout(() => URL.revokeObjectURL(url), 0);
```

Disable both close and download while the request is active, restore them in `finally`, and display a local error notice without closing the modal.

- [ ] **Step 5: Implement the modern CR80 preview styles**

Use `aspect-ratio: 85.6 / 53.98`, a two-column responsive preview grid, primary/dark-primary CSS variables from the DTO, and a single-column layout below `760px`. The front must give 67% of the content area to identity data and 25% to a CSS grid generated from `FAKE_QR_PATTERN`. The back must show three stacked data blocks. Provide visible focus, `aria-live` for errors, and at least `4.5:1` contrast for body text.

Do not add a photo placeholder. Do not render validity, signature, CPF, RG, phone, address, or issuance date.

- [ ] **Step 6: Integrate the action into member details**

Add `IdCard` to the Lucide imports, `showCredential` state, and a footer action guarded by `capabilities.issueCredential`:

```tsx
{capabilities.issueCredential && (
  <Button variant="secondary" onClick={() => setShowCredential(true)}>
    <IdCard size={16} /> Gerar credencial
  </Button>
)}
```

Wrap credential and edit actions in a small footer action container. Render the new modal after the main modal, following the existing nested-role-editor pattern:

```tsx
{showCredential && (
  <MemberCredentialModal
    memberId={memberId}
    onClose={() => setShowCredential(false)}
  />
)}
```

- [ ] **Step 7: Run view tests, typecheck and lint**

```bash
npm test -- src/modules/members/utils/member-credential-view.test.ts
npm run typecheck
npm run lint -- --max-warnings=0
```

Expected: all commands exit `0`.

- [ ] **Step 8: Commit the UI slice**

```bash
git add src/modules/members/components/member-credential-modal.tsx src/modules/members/components/member-credential.styles.ts src/modules/members/components/member-details-modal.tsx src/modules/members/utils/member-credential-view.ts src/modules/members/utils/member-credential-view.test.ts
git commit -m "feat(members): add credential preview experience"
```

---

### Task 6: End-to-End Coverage and Visual Acceptance

**Files:**
- Create: `e2e/member-physical-credential.spec.ts`
- Modify only if required by a discovered test seam: credential files from Tasks 2–5

**Interfaces:**
- Consumes: completed authenticated UI and download route.
- Produces: browser-level evidence that permission gating, preview, warnings and PDF download work together.

- [ ] **Step 1: Add authenticated E2E coverage**

Create `e2e/member-physical-credential.spec.ts` with environment-controlled member fixture selection:

```ts
import { expect, test } from "@playwright/test";

const memberCode = process.env.E2E_CREDENTIAL_MEMBER_CODE;

test.describe("credencial física de membro", () => {
  test.skip(!process.env.E2E_STORAGE_STATE || !memberCode, "Requer sessão e membro de teste autorizados");

  test("pré-visualiza frente e verso e baixa PDF", async ({ page }) => {
    await page.goto(`/membros?search=${encodeURIComponent(memberCode!)}`);
    await page.getByRole("button", { name: "Ver ficha" }).first().click();
    await page.getByRole("button", { name: "Gerar credencial" }).click();
    await expect(page.getByLabel("Frente da credencial")).toBeVisible();
    await expect(page.getByLabel("Verso da credencial")).toBeVisible();
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Baixar PDF" }).click();
    expect((await download).suggestedFilename()).toMatch(/^credencial-[A-Za-z0-9_-]+\.pdf$/);
  });
});
```

The current desktop list exposes the details action through `title="Ver ficha"`; retain or improve that accessible name, and do not select by CSS class.

- [ ] **Step 2: Run the E2E test with explicit prerequisites**

```bash
E2E_STORAGE_STATE=/absolute/path/to/storage-state.json E2E_CREDENTIAL_MEMBER_CODE=MEM000123 npm run test:e2e -- e2e/member-physical-credential.spec.ts
```

Expected: one passing Chromium scenario. If the authenticated storage state or eligible fixture does not exist, report the exact missing prerequisite; do not create production test data.

- [ ] **Step 3: Perform responsive and visual review**

At desktop width and a narrow mobile viewport, verify:

```text
- both card faces retain CR80 aspect ratio
- no member field overlaps the fake QR
- long names wrap or truncate without clipping
- light configured colors switch to dark foreground
- loading, warning and download-error states remain readable
- keyboard focus order reaches Cancelar and Baixar PDF
```

Render the QA PDF again and compare its field values and hierarchy against the browser preview. Differences in vector curves are acceptable; differences in fields, fallbacks, colors or content order are not.

- [ ] **Step 4: Commit E2E coverage**

```bash
git add e2e/member-physical-credential.spec.ts
git commit -m "test(members): cover physical credential flow"
```

---

### Task 7: Full Verification, Online Migration, and Final Audit

**Files:**
- Verify all files changed by Tasks 1–6.
- Do not create additional product files unless a verification failure identifies a specific defect.

**Interfaces:**
- Consumes: the complete feature and linked Supabase project `dhgrfvakdbtedqfgecys`.
- Produces: clean `main`, aligned migration history, verified online permission, advisor report and final handoff evidence.

- [ ] **Step 1: Run the complete local validation suite**

```bash
npm run lint -- --max-warnings=0
npm run typecheck
npm test
npm run build
```

Expected: every command exits `0`; record test counts and any intentional E2E prerequisite separately.

- [ ] **Step 2: Inspect the complete diff and repository state**

```bash
git diff --check
git status --short
git log --oneline --decorate -8
```

Expected: no whitespace errors, no secrets/customer data/generated QA artifacts, and only intentional feature commits ahead of `origin/main`.

- [ ] **Step 3: Confirm the online push contains exactly the permission migration**

```bash
SUPABASE_TELEMETRY_DISABLED=1 npx supabase db push --linked --dry-run --skip-vault
```

Expected: exactly one pending migration, ending in `_member_physical_credential_permission.sql`; no seeds or roles. Stop if any other migration appears.

- [ ] **Step 4: Apply the reviewed migration to the linked online database**

```bash
SUPABASE_TELEMETRY_DISABLED=1 npx supabase db push --linked --skip-vault --yes
```

Expected: the one reviewed migration applies successfully to `dhgrfvakdbtedqfgecys`.

- [ ] **Step 5: Verify migration history and permission state**

Run:

```bash
SUPABASE_TELEMETRY_DISABLED=1 npx supabase migration list --linked --output-format json
SUPABASE_TELEMETRY_DISABLED=1 npx supabase db push --linked --dry-run --skip-vault
```

Expected: local and remote versions match and the second command reports `upToDate: true` with an empty migration list.

Execute the read-only online verification from `supabase/tests/member_physical_credential_permission_verification.sql`, preserving its transaction and rollback. Confirm one active permission and exactly two active default grants.

- [ ] **Step 6: Run online security and performance advisors**

Use the Supabase advisors for both `security` and `performance`. Confirm no new finding targets `members.credentials.issue`, the member credential route, or any new database object. Record unrelated existing warnings with their remediation URLs; do not expand this feature into unrelated advisor cleanup.

- [ ] **Step 7: Run a final credential-specific smoke check**

With an existing authorized administrative account and an existing eligible member, confirm preview and PDF download against the online database. Do not create or edit member records solely for this check. Verify the resulting audit row by action and entity ID only; do not print its actor email or member label.

- [ ] **Step 8: Confirm fixes remain owned by their task commits**

Run `git status --short` after the final verification. Expected: clean. If verification exposed a defect, return to the task that owns that file, add the focused regression test, implement the fix, rerun that task's checks, and amend its evidence with a dedicated `fix(members): address credential verification finding` commit before repeating Task 7. Do not create an empty catch-all commit. Report the final commit list, online migration result, validation commands, skipped prerequisites and advisor findings.
