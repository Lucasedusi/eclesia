import { beforeEach, describe, expect, it, vi } from "vitest";
import { PERMISSIONS } from "@/modules/auth/constants/permissions";
import type { AuthContext } from "@/modules/auth/types/auth.types";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ createClient: vi.fn(), history: vi.fn(), events: vi.fn(), logo: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("./member.service", () => ({ getMemberHistory: mocks.history, getMemberEvents: mocks.events }));
vi.mock("@/modules/auth/services/church-logo.service", () => ({ loadChurchLogoDataUri: mocks.logo }));

import { loadMemberSheetDocument } from "./member-sheet.service";

const memberId = "9ed2934a-8326-4abd-8c59-e4b0865acb95";
const context = {
  church: { id: "church-1", name: "Igreja de teste", logoUrl: null },
  profile: { id: "profile-1" },
  access: { scope: "CHURCH" },
  permissions: Object.values(PERMISSIONS),
} as AuthContext;

const basic = { includeHistory: false, includeEvents: false };
const member = {
  id: memberId, congregation_id: "congregation-1", full_name: "Ana de Teste", member_code: "MEM0042",
  gender: "FEMALE", member_status: "ACTIVE", birth_date: "1990-02-10", marital_status: "MARRIED",
  whatsapp: "62999999999", email: "ana@example.invalid", address: "Rua de Teste", number: "10",
  district: "Centro", city: "Goiânia", state: "GO", zip_code: "74000000", father_name: "Pai",
  mother_name: "Mãe", spouse_name: "Cônjuge", conversion_date: "2010-01-02", baptism_date: "2011-02-03",
  baptism_church: "Igreja do batismo", has_holy_spirit_baptism: true, holy_spirit_baptism_date: null,
  received_by: "LETTER", received_date: "2015-03-04", congregations: { name: "Central" },
  notes: "OBSERVACAO_INTERNA_NAO_EXPORTAR", pastoral_notes: "NOTA_PASTORAL_NAO_EXPORTAR",
};

function database(overrides: Record<string, unknown> = {}, errorTable?: string) {
  const records: Record<string, unknown> = {
    members: member,
    churches: { name: "Igreja de Teste", address: "Rua da Igreja", number: "1", city: "Goiânia", state: "GO", phone: "6233333333", document: "00000000000100" },
    app_settings: { display_church_name: "Nome da igreja configurado", logo_url: null },
    member_sensitive_identity: { cpf: "00000000000", rg: "RG-TESTE", issuing_agency: "SSP-GO" },
    member_roles: [{ status: "ACTIVE", title_variant: "AUTO", role: { name: "Diácono", female_name: "Diaconisa" } }],
    ...overrides,
  };
  const queries = new Map<string, Record<string, ReturnType<typeof vi.fn>>>();
  const from = vi.fn((table: string) => {
    const result = { data: records[table] ?? null, error: table === errorTable ? { message: "private database detail" } : null };
    const query: Record<string, ReturnType<typeof vi.fn>> = {};
    for (const method of ["select", "eq", "is", "order", "limit"]) query[method] = vi.fn(() => query);
    query.maybeSingle = vi.fn(async () => result);
    query.then = vi.fn((resolve) => Promise.resolve(result).then(resolve));
    queries.set(table, query);
    return query;
  });
  const rpc = vi.fn(async () => ({ data: true, error: null }));
  mocks.createClient.mockResolvedValue({ from, rpc });
  return { from, queries, rpc };
}

describe("loadMemberSheetDocument", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.logo.mockResolvedValue(null);
    mocks.history.mockResolvedValue({ items: [], total: 0, page: 1, pageCount: 0 });
    mocks.events.mockResolvedValue({ items: [], total: 0, page: 1, pageCount: 0 });
  });

  it("monta só os campos do modelo e respeita igreja, membro e exclusão lógica", async () => {
    const db = database();
    const result = await loadMemberSheetDocument(context, memberId, basic);
    expect(result.member).toEqual({ fullName: "Ana de Teste", memberCode: "MEM0042", role: "Diaconisa", congregationName: "Central" });
    expect(result.church.name).toBe("Nome da igreja configurado");
    expect(result.history).toBeNull();
    expect(result.events).toBeNull();
    expect(result.groups[0].fields).toContainEqual({ label: "Estado civil", value: "Casada" });
    expect(result.groups[2].fields).toContainEqual({ label: "Batismo com Espírito Santo", value: "Sim · Data não informada" });
    expect(JSON.stringify(result)).not.toContain("NAO_EXPORTAR");
    expect(mocks.history).not.toHaveBeenCalled();
    expect(mocks.events).not.toHaveBeenCalled();
    expect(db.queries.get("members")!.eq).toHaveBeenCalledWith("church_id", context.church.id);
    expect(db.queries.get("members")!.eq).toHaveBeenCalledWith("id", memberId);
    expect(db.queries.get("members")!.is).toHaveBeenCalledWith("deleted_at", null);
    expect(db.rpc).toHaveBeenCalledWith("can_access_member", { p_church_id: context.church.id, p_member_id: memberId, p_congregation_id: "congregation-1" });
    for (const table of ["member_sensitive_identity", "member_roles"]) {
      expect(db.queries.get(table)!.eq).toHaveBeenCalledWith("church_id", context.church.id);
      expect(db.queries.get(table)!.eq).toHaveBeenCalledWith("member_id", memberId);
      expect(db.queries.get(table)!.is).toHaveBeenCalledWith("deleted_at", null);
    }
    expect(db.from.mock.calls.flat()).not.toContain("member_pastoral_notes");
    expect(db.from.mock.calls.flat()).not.toContain("member_documents");
    expect(db.from.mock.calls.flat()).not.toContain("financial_transactions");
  });

  it.each([PERMISSIONS.membersViewBasic, PERMISSIONS.membersViewFull, PERMISSIONS.membersExport])(
    "nega a ficha sem %s", async (permission) => {
      database();
      await expect(loadMemberSheetDocument({ ...context, permissions: context.permissions.filter((value) => value !== permission) }, memberId, basic))
        .rejects.toThrow("MEMBER_SHEET_PERMISSION_DENIED");
      expect(mocks.createClient).not.toHaveBeenCalled();
    },
  );

  it.each([
    [PERMISSIONS.memberHistoryView, { ...basic, includeHistory: true }],
    [PERMISSIONS.eventsView, { ...basic, includeEvents: true }],
    [PERMISSIONS.eventRegistrationsView, { ...basic, includeEvents: true }],
  ])("nega seção pedida sem %s", async (permission, options) => {
    database();
    await expect(loadMemberSheetDocument({ ...context, permissions: context.permissions.filter((value) => value !== permission) }, memberId, options))
      .rejects.toThrow("MEMBER_SHEET_PERMISSION_DENIED");
  });

  it("não consulta identidade nem cargo sem suas permissões", async () => {
    const db = database();
    const result = await loadMemberSheetDocument({ ...context, permissions: [PERMISSIONS.membersExport, PERMISSIONS.membersViewBasic, PERMISSIONS.membersViewFull] }, memberId, basic);
    expect(db.from.mock.calls.flat()).not.toContain("member_sensitive_identity");
    expect(db.from.mock.calls.flat()).not.toContain("member_roles");
    expect(JSON.stringify(result)).not.toContain("RG-TESTE");
    expect(result.groups[0].fields.find((field) => field.label === "CPF")?.value).toBe("Informação restrita");
    expect(result.member.role).toBeNull();
  });

  it("nega membro inexistente, arquivado ou invisível pela RLS", async () => {
    database({ members: null });
    await expect(loadMemberSheetDocument(context, memberId, basic)).rejects.toThrow("MEMBER_SHEET_NOT_FOUND");
    expect(mocks.history).not.toHaveBeenCalled();
  });

  it("nega escopo recusado antes de consultar os demais dados", async () => {
    const db = database();
    db.rpc.mockResolvedValue({ data: false, error: null });
    await expect(loadMemberSheetDocument(context, memberId, basic)).rejects.toThrow("MEMBER_SHEET_NOT_FOUND");
    expect(db.from.mock.calls.flat()).toEqual(["members"]);
  });

  it("carrega todas as páginas e exclui histórico sensível também na projeção", async () => {
    database();
    const historyItem = { id: "h1", title: "Alteração", eventDate: "2026-01-01", type: "STATUS_CHANGED", oldValue: "INACTIVE", newValue: "ACTIVE", description: "Retorno", sensitive: false };
    mocks.history.mockResolvedValueOnce({ items: [historyItem, { ...historyItem, id: "secret", sensitive: true, description: "SEGREDO" }], total: 21, page: 1, pageCount: 2 })
      .mockResolvedValueOnce({ items: [{ ...historyItem, id: "h21", title: "Último histórico" }], total: 21, page: 2, pageCount: 2 });
    mocks.events.mockResolvedValueOnce({ items: [{ id: "e1", name: "Primeiro evento", startsAt: "2026-01-01T22:00:00Z", location: "Templo" }], total: 21, page: 1, pageCount: 2 })
      .mockResolvedValueOnce({ items: [{ id: "e21", name: "Último evento", startsAt: "2026-01-02T22:00:00Z", location: "Templo" }], total: 21, page: 2, pageCount: 2 });
    const result = await loadMemberSheetDocument(context, memberId, { includeHistory: true, includeEvents: true });
    expect(result.history).toHaveLength(2);
    expect(result.history?.at(-1)?.title).toBe("Último histórico");
    expect(result.history?.[0].change).toBe("Inativo → Ativo");
    expect(result.events?.at(-1)?.name).toBe("Último evento");
    expect(JSON.stringify(result)).not.toContain("SEGREDO");
    expect(mocks.history).toHaveBeenNthCalledWith(2, context, memberId, 2, false);
    expect(mocks.events).toHaveBeenNthCalledWith(2, context, memberId, 2);
  });

  it("não produz uma ficha parcial quando uma consulta falha", async () => {
    database({}, "member_sensitive_identity");
    await expect(loadMemberSheetDocument(context, memberId, basic)).rejects.toThrow("MEMBER_SHEET_LOAD_FAILED");
  });
});
