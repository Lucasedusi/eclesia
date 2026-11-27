import { createElement, type ReactNode } from "react";
import { renderToReadableStream } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import DashboardLayout from "@/app/(authenticated)/(dashboard)/layout";
import DashboardPage from "@/app/(authenticated)/(dashboard)/page";
import { PERMISSIONS } from "@/modules/auth/constants/permissions";
import type { AuthContext } from "@/modules/auth/types/auth.types";
import { getDashboardBirthdayContext } from "./services/dashboard.service";

const { rpc, authorize } = vi.hoisted(() => ({ rpc: vi.fn(), authorize: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc }) }));
vi.mock("@/modules/auth/services/access-context.service", () => ({ requireAccessContext: authorize }));
vi.mock("@/components/ui/page-header", () => ({ PageHeader: () => "Dashboard" }));
vi.mock("./components/dashboard-birthdays", () => ({ DashboardBirthdays: () => "Aniversariantes autorizados" }));

const churchId = "10d47cbf-7283-4cf3-b15f-4afb28e30daf";
const context = {
  church: { id: churchId, name: "Campo" },
  access: { id: "28ec5617-1b01-4482-9a5d-f1aae7d8aaeb", role: "ADMIN", scope: "CHURCH", status: "ACTIVE", churchId, congregationId: null },
  permissions: [PERMISSIONS.dashboardView, PERMISSIONS.membersViewBasic, PERMISSIONS.membersViewFull, PERMISSIONS.organizationView],
} as AuthContext;
const scope = { church_id: churchId, congregation_id: null, is_field: true, view_contact: false, view_organization: false };

beforeEach(() => {
  rpc.mockReset();
  authorize.mockReset().mockResolvedValue(context);
});

function birthdayPage() {
  return createElement(DashboardPage, { searchParams: Promise.resolve({ period: "week" }) });
}

async function html(element: ReactNode) {
  const stream = await renderToReadableStream(element);
  await stream.allReady;
  return new Response(stream).text();
}

it("mantém os aniversariantes quando a consulta de indicadores falha", async () => {
  rpc.mockImplementation((name: string) => name === "get_dashboard_member_summary"
    ? Promise.resolve({ data: null, error: { code: "57014" } })
    : { maybeSingle: async () => ({ data: scope, error: null }) });
  const output = await html(DashboardLayout({ children: birthdayPage() }));
  expect(output).toContain("Não foi possível carregar os indicadores");
  expect(output).toContain("Aniversariantes autorizados");
});

it("a página de período exige o escopo atual sem consultar o resumo", async () => {
  rpc.mockReturnValue({ maybeSingle: async () => ({ data: scope, error: null }) });
  expect(await html(birthdayPage())).toContain("Aniversariantes autorizados");
  expect(authorize).toHaveBeenCalledWith(PERMISSIONS.dashboardView);
  expect(rpc.mock.calls).toEqual([["get_dashboard_member_scope", { p_access_id: context.access.id }]]);
  expect((await getDashboardBirthdayContext(context))?.permissions).toEqual([PERMISSIONS.dashboardView, PERMISSIONS.membersViewBasic]);
});

it.each([null, { ...scope, church_id: "f7e6416c-91fd-4e4c-b012-2f3debe0638e" }])(
  "omite os aniversários quando o escopo está indisponível ou mudou", async data => {
    rpc.mockReturnValue({ maybeSingle: async () => ({ data, error: null }) });
    expect(await html(birthdayPage())).not.toContain("Aniversariantes autorizados");
  },
);
