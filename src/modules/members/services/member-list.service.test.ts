import { createClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { PERMISSIONS } from "@/modules/auth/constants/permissions";
import type { AuthContext } from "@/modules/auth/types/auth.types";
import { countMembers, getMemberStats, listMembers } from "./member.service";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ client: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));

const context = { church: { id: "church" }, permissions: [PERMISSIONS.membersViewBasic] } as AuthContext;

function database(rows: object[], total = rows.length) {
  const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(async () => new Response(JSON.stringify(rows), {
    headers: { "content-type": "application/json", "content-range": `*/${total}` },
  }));
  mocks.client.mockResolvedValue(createClient("http://localhost:54321", "test", { global: { fetch } }));
  return fetch;
}

describe("listagem de membros", () => {
  it("entrega a página e identifica a próxima sem aguardar uma contagem", async () => {
    const fetch = database(Array.from({ length: 21 }, (_, i) => ({ id: String(i) })));
    const result = await listMembers(context, { page: 2 });
    const [url, init] = fetch.mock.calls[0];
    const params = new URL(String(url)).searchParams;
    expect(new Headers(init?.headers).get("Prefer") ?? "").not.toContain("count=");
    expect(params.get("order")).toBe("full_name.asc,id.asc");
    expect(params.get("offset")).toBe("20");
    expect(params.get("limit")).toBe("21");
    expect(result.items).toHaveLength(20);
    expect(result.hasNextPage).toBe(true);
  });

  it.each([true, false])("aplica os mesmos filtros de busca nas linhas e no total com permissão de CPF %s", async (sensitive) => {
    const fetch = database([], 114);
    const access = { ...context, permissions: sensitive ? [...context.permissions, PERMISSIONS.membersViewSensitiveIdentity] : context.permissions };
    const params = { search: "123", regionId: "r", roleId: "role", archived: true, memberType: "MEMBER" };
    const page = await listMembers(access, params);
    const count = await countMembers(access, params);
    expect(page.hasNextPage).toBe(false);
    expect(count).toBe(114);
    expect(fetch).toHaveBeenCalledTimes(2);
    for (const [url] of fetch.mock.calls) {
      const request = new URL(String(url));
      expect(request.pathname).toBe("/rest/v1/members");
      const select = request.searchParams.get("select");
      const nameOrCode = 'full_name.ilike."%123%",member_code.ilike."%123%"';
      expect(request.searchParams.get("or")).toBe(`(${nameOrCode}${sensitive ? ",cpf_match.not.is.null" : ""})`);
      if (sensitive) {
        expect(select).toContain("cpf_match:member_sensitive_identity!member_sensitive_identity_member_id_fkey()");
        expect(request.searchParams.get("cpf_match.church_id")).toBe("eq.church");
        expect(request.searchParams.get("cpf_match.deleted_at")).toBe("is.null");
        expect(request.searchParams.get("cpf_match.cpf")).toBe("ilike.%123%");
      } else {
        expect(select).not.toContain("member_sensitive_identity");
        expect(request.searchParams.has("cpf_match.cpf")).toBe(false);
      }
      expect(request.searchParams.get("church_id")).toBe("eq.church");
      expect(request.searchParams.get("deleted_at")).toBe("not.is.null");
      expect(request.searchParams.get("congregations.region_id")).toBe("eq.r");
      expect(request.searchParams.get("role_filter.role_id")).toBe("eq.role");
      expect(request.searchParams.get("member_type")).toBe("eq.MEMBER");
    }
    expect(new Headers(fetch.mock.calls[1][1]?.headers).get("Prefer")).toContain("count=exact");
    expect(fetch.mock.calls[1][1]?.method).toBe("HEAD");
  });

  it("trata pontuação, aspas, barras e curingas como parte do termo", async () => {
    const fetch = database([]);
    await listMembers(context, { search: String.raw`A"b\c_%(x,y)*` });
    const pattern = JSON.stringify(String.raw`%A"b\\c\_\%(x,y)%`);
    const params = new URL(String(fetch.mock.calls[0][0])).searchParams;
    expect(params.get("or")).toBe(`(full_name.ilike.${pattern},member_code.ilike.${pattern})`);
    expect(params.get("select")).not.toContain("cpf_match");
  });

  it("consulta o total da listagem sem busca por HEAD, incluindo o escopo relacional", async () => {
    const fetch = database([], 113);
    expect(await countMembers(context, { status: "ACTIVE", congregationId: "local" })).toBe(113);
    const [url, init] = fetch.mock.calls[0];
    const params = new URL(String(url)).searchParams;
    expect(init?.method).toBe("HEAD");
    expect(params.get("select")).toMatch(/congregations!inner/);
    expect(params.get("select")).not.toMatch(/whatsapp|active_roles/);
    expect(params.get("member_status")).toBe("eq.ACTIVE");
    expect(params.get("congregation_id")).toBe("eq.local");
  });

  it("diferencia falha nos indicadores de uma igreja sem cadastros", async () => {
    mocks.client.mockResolvedValue({ rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "timeout" } }) });
    expect(await getMemberStats(context)).toBeNull();
  });
});
