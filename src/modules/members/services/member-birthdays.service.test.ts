import { createClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/modules/auth/types/auth.types";
import { PERMISSIONS } from "@/modules/auth/constants/permissions";
import { birthdayFiltersSchema } from "../validations/member-birthdays";
import { birthdayMember, birthdayQuery, readBirthdayBatch } from "./member-birthdays.service";

vi.mock("server-only", () => ({}));
const context = {
  church: { id: "church" }, access: { scope: "CONGREGATION", congregationId: "local" },
  permissions: [PERMISSIONS.membersViewBasic],
} as AuthContext;
const filters = birthdayFiltersSchema.parse({});
function database() {
  const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response("[]", { headers: { "content-type": "application/json", "content-range": "*/0" } }));
  return { fetch, client: createClient("http://localhost:54321", "test", { global: { fetch } }) };
}

describe("birthday list and report query", () => {
  it("restricts both fields and records with basic access, even with a different congregation filter", async () => {
    const db = database();
    await birthdayQuery(db.client, context, { ...filters, congregationId: "another" }, [229, 229]).range(0, 19);
    const query = new URL(String(db.fetch.mock.calls[0][0])).searchParams;
    expect(query.get("church_id")).toBe("eq.church");
    expect(query.getAll("congregation_id")).toEqual(["eq.local", "eq.another"]);
    expect(query.get("member_type")).toBe("in.(MEMBER,CHILD)");
    expect(query.get("member_status")).toBe("eq.ACTIVE");
    expect(query.get("deleted_at")).toBe("is.null");
    expect(query.getAll("birthday_mmdd")).toEqual(["not.is.null", "gte.229", "lte.229"]);
    expect(query.get("select")).not.toMatch(/whatsapp|active_roles|congregations|notes|cpf/);
    expect(query.get("order")).toBe("birthday_mmdd.asc,full_name.asc,id.asc");
  });

  it.each([true, false])("keeps dashboard records scoped and selects WhatsApp only with full access (%s)", async (allowContact) => {
    for (const scope of ["CHURCH", "CONGREGATION"] as const) {
      const db = database();
      const access = { ...context.access, scope };
      const permissions = [PERMISSIONS.membersViewBasic, PERMISSIONS.organizationView, ...(allowContact ? [PERMISSIONS.membersViewFull] : [])];
      await readBirthdayBatch(db.client, { ...context, access, permissions },
        filters, [[101, 101]], 0, 19, "dashboard");
      const params = new URL(String(db.fetch.mock.calls[0][0])).searchParams;
      const fields = ["id", "full_name", "birthday_mmdd"];
      if (scope === "CHURCH") fields.push("congregations(name)");
      if (allowContact) fields.push("whatsapp");
      expect(params.get("select")?.split(",").sort()).toEqual(fields.sort());
      expect(params.get("church_id")).toBe("eq.church");
      if (scope === "CONGREGATION") expect(params.get("congregation_id")).toBe("eq.local");
    }
  });

  it.each([
    [0, 1, ["Dec 30", "Dec 31"]],
    [1, 2, ["Dec 31", "Jan 01"]],
    [2, 3, ["Jan 01", "Jan 02"]],
    [0, 499, ["Dec 30", "Dec 31", "Jan 01", "Jan 02"]],
  ] as const)("paginates the week across the new year from %i to %i", async (start, end, expected) => {
    const db = database();
    db.fetch.mockImplementation(async (url) => {
      const query = new URL(String(url)).searchParams;
      const names = query.getAll("birthday_mmdd").includes("gte.1227") ? ["Dec 30", "Dec 31"] : ["Jan 01", "Jan 02"];
      const offset = Number(query.get("offset"));
      const limit = Number(query.get("limit"));
      const rows = names.slice(offset, offset + limit).map((full_name) => ({ full_name }));
      return new Response(JSON.stringify(rows), { headers: { "content-range": `*/${names.length}` } });
    });
    const response = await readBirthdayBatch(db.client, context, filters, [[1227, 1231], [101, 102]], start, end);
    expect(response.error).toBeNull();
    expect(response.count).toBe(4);
    expect(response.data?.map((row) => row.full_name)).toEqual(expected);
  });

  it("fails closed for missing scope or permission", () => {
    for (const access of [{ scope: "REGION" }, { scope: "CONGREGATION" }, { scope: "MINISTRY", ministryId: "m" }]) {
      expect(() => birthdayQuery(database().client, { ...context, access: access as AuthContext["access"] }, filters, null)).toThrow("MEMBER_REPORT_PERMISSION_DENIED");
    }
    expect(() => birthdayQuery(database().client, { ...context, permissions: [] }, filters, null)).toThrow("MEMBER_REPORT_PERMISSION_DENIED");
  });

  it("displays the current feminine title and suppresses invalid WhatsApp numbers", () => {
    const row = {
      id: "1", full_name: "Ana", member_code: "0001", birth_date: "2000-02-29", congregations: null, gender: "FEMALE",
      active_roles: [{ title_variant: "AUTO", roles: { name: "Diácono", female_name: "Diaconisa" } }],
    };
    expect(birthdayMember({ ...row, whatsapp: "123" })).toMatchObject({ role: "Diaconisa", whatsapp: null });
    expect(birthdayMember({ ...row, whatsapp: "5511999998888" }).whatsapp).toBe("(11) 99999-8888");
  });
});
