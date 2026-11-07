import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCongregationDetails } from "./organization.service";

const mocks = vi.hoisted(() => ({ client: vi.fn(), access: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
vi.mock("@/modules/auth/services/access-context.service", () => ({ requireAccessContext: mocks.access }));

const context = { church: { id: "church" }, access: { role: "ADMIN", scope: "CHURCH" }, permissions: ["organization.view", "congregation_documents.view"] };
const congregation = { id: "congregation", church_id: "church", deleted_at: null, regions: null, name: "Congregação teste" };
const active = { church_id: "church", congregation_id: "congregation", upload_status: "ACTIVE", deleted_at: null };

function database({ missing = false, failed = false } = {}) {
  const records: Record<string, Record<string, unknown>[]> = {
    congregations: missing ? [] : [congregation],
    congregation_documents: [active, active, { ...active, upload_status: "PENDING" }, { ...active, deleted_at: "yesterday" }, { ...active, church_id: "other" }, { ...active, congregation_id: "other" }],
  };
  const from = vi.fn((table: string) => {
    const filters: [string, unknown][] = [];
    const result = () => {
      const data = records[table].filter((row) => filters.every(([key, value]) => row[key] === value));
      return { data, count: data.length, error: failed && table === "congregation_documents" ? { code: "ERROR", message: "Unavailable" } : null };
    };
    const query = {
      select: () => query,
      eq: (key: string, value: unknown) => { filters.push([key, value]); return query; },
      is: (key: string, value: unknown) => { filters.push([key, value]); return query; },
      maybeSingle: async () => ({ ...result(), data: result().data[0] ?? null }),
      then: (resolve: (value: ReturnType<typeof result>) => unknown) => Promise.resolve(result()).then(resolve),
    };
    return query;
  });
  mocks.client.mockResolvedValue({ from });
  return from;
}

beforeEach(() => { vi.clearAllMocks(); mocks.access.mockResolvedValue(context); });

describe("congregation document count", () => {
  it("counts only completed, non-archived documents of this congregation and church", async () => {
    database();
    expect((await getCongregationDetails("congregation"))?.documentCount).toBe(2);
    expect(mocks.access).toHaveBeenCalledWith("organization.view");
  });
  it.each([
    { ...context, permissions: ["organization.view"] },
    { ...context, access: { role: "SECRETARY", scope: "CHURCH" } },
    { ...context, access: { role: "ADMIN", scope: "REGION" } },
  ])("does not query documents without church administrator access and permission", async (restricted) => {
    mocks.access.mockResolvedValue(restricted);
    const from = database();
    expect((await getCongregationDetails("congregation"))?.documentCount).toBeNull();
    expect(from).not.toHaveBeenCalledWith("congregation_documents");
  });
  it("does not count documents for an unavailable congregation", async () => {
    const from = database({ missing: true });
    expect(await getCongregationDetails("congregation")).toBeNull();
    expect(from).not.toHaveBeenCalledWith("congregation_documents");
  });
  it("does not show a misleading zero if counting fails", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      database({ failed: true });
      expect((await getCongregationDetails("congregation"))?.documentCount).toBeNull();
    } finally { log.mockRestore(); }
  });
});
