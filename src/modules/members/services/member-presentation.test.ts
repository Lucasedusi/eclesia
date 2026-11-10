import { describe, expect, it, vi } from "vitest";
import {
  getMemberStats,
  normalizeMemberListParams,
  getMemberHistory,
} from "./member.service";
import { formatMemberHistoryValue } from "../utils/member-formatters";
import type { AuthContext } from "@/modules/auth/types/auth.types";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ client: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
const context = { church: { id: "church" } } as AuthContext;
describe("member presentation", () => {
  it("starts with active members but preserves explicit all and archived filters", () => {
    expect(normalizeMemberListParams({}).status).toBe("ACTIVE");
    expect(normalizeMemberListParams({ status: "" }).status).toBe("");
    expect(normalizeMemberListParams({ archived: true }).status).toBe("");
    expect(normalizeMemberListParams({ status: "INACTIVE" }).status).toBe(
      "INACTIVE",
    );
  });
  it("includes archived records in total without changing status counts", async () => {
    mocks.client.mockResolvedValue({
      rpc: vi
        .fn()
        .mockResolvedValue({
          data: { total: 8, active: 5, inactive: 2, archived: 3 },
          error: null,
        }),
    });
    expect(await getMemberStats(context)).toMatchObject({
      total: 11,
      active: 5,
      inactive: 2,
      archived: 3,
    });
  });
  it.each([
    ["BAPTISM", "Batismo"],
    ["MEMBER", "Membro"],
    ["CHILD", "Criança"],
    ["LETTER", "Carta de transferência"],
    ["FEMALE", "Feminino"],
  ])("translates %s", (value, expected) => {
    expect(formatMemberHistoryValue(value)).toBe(expected);
  });
  it("preserves the historical feminine title instead of replacing it with the current catalog", async () => {
    const id = "00000000-0000-4000-8000-000000000001";
    const q = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      in: vi
        .fn()
        .mockResolvedValue({
          data: [{ id, name: "Diácono", female_name: "Diaconisa" }],
          error: null,
        }),
      range: vi
        .fn()
        .mockResolvedValue({
          data: [
            {
              id: "history",
              history_type: "ROLE_CHANGED",
              old_value: "Diaconisa",
              new_value: "Missionária",
              metadata: { old_role_id: id },
              title: "Cargo alterado",
            },
          ],
          count: 1,
          error: null,
        }),
    };
    mocks.client.mockResolvedValue({ from: () => q });
    const result = await getMemberHistory(context, "member");
    expect(result.items[0]).toMatchObject({
      oldValue: "Diaconisa",
      newValue: "Missionária",
    });
  });
});

it.each([
  ["AUTO", "Diaconisa"],
  ["MALE", "Diácono"],
  ["FEMALE", "Diaconisa"],
])(
  "resolves legacy role IDs using the %s historical variant",
  async (variant, expected) => {
    const id = "00000000-0000-4000-8000-000000000002";
    mocks.client.mockResolvedValue({
      from: (table: string) => {
        const response =
          table === "member_roles"
            ? { data: [{ id: "link", title_variant: variant }], error: null }
            : { data: [], error: null };
        const q = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          neq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          in: async () => ({
            data: [{ id, name: "Diácono", female_name: "Diaconisa" }],
            error: null,
          }),
          maybeSingle: async () => ({
            data: { gender: "FEMALE" },
            error: null,
          }),
          range: async () => ({
            data: [
              {
                id: "history",
                history_type: "ROLE_ASSIGNED",
                old_value: null,
                new_value: id,
                metadata: { member_role_id: "link" },
                title: "Cargo atribuído",
              },
            ],
            count: 1,
            error: null,
          }),
          then: (resolve: (v: unknown) => unknown) =>
            Promise.resolve(response).then(resolve),
        };
        return q;
      },
    });
    expect((await getMemberHistory(context, "member")).items[0].newValue).toBe(
      expected,
    );
  },
);
