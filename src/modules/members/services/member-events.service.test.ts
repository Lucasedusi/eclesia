import { beforeEach, describe, expect, it, vi } from "vitest";
import { PERMISSIONS } from "@/modules/auth/constants/permissions";
import type { AuthContext } from "@/modules/auth/types/auth.types";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

import { getMemberEvents } from "./member.service";

const context = {
  church: { id: "church-1", name: "Igreja", logoUrl: null },
  profile: { id: "profile-1", fullName: "Usuário", displayName: "Usuário", email: "user@example.com", avatarUrl: null, status: "ACTIVE" },
  access: { id: "access-1", churchId: "church-1", role: "ADMIN", scope: "CHURCH", status: "ACTIVE", regionId: null, congregationId: null, ministryId: null },
  accesses: [],
  availableChurches: [],
  permissions: [PERMISSIONS.eventsView, PERMISSIONS.eventRegistrationsView],
} satisfies AuthContext;

function chain<T extends Record<string, ReturnType<typeof vi.fn>>>(builder: T, methods: (keyof T)[]) {
  methods.forEach((method) => builder[method].mockReturnValue(builder));
  return builder;
}

describe("getMemberEvents", () => {
  beforeEach(() => vi.clearAllMocks());

  it("consulta somente inscrições individuais quitadas ou gratuitas no tenant", async () => {
    const memberQuery = chain({ select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn() }, ["select", "eq"]);
    memberQuery.maybeSingle.mockResolvedValue({ data: { id: "member-1" }, error: null });
    const eventQuery = chain({ select: vi.fn(), eq: vi.fn(), in: vi.fn(), is: vi.fn(), order: vi.fn(), range: vi.fn() }, ["select", "eq", "in", "is", "order"]);
    eventQuery.range.mockResolvedValue({
      data: [{ id: "event-1", name: "Conferência", starts_at: "2026-10-12T22:00:00Z", location_name: "Templo", city: "Goiânia", state: "GO" }],
      count: 1,
      error: null,
    });
    mocks.createClient.mockResolvedValue({
      from: vi.fn((table: string) => table === "members" ? memberQuery : eventQuery),
    });

    const result = await getMemberEvents(context, "member-1");

    expect(eventQuery.eq.mock.calls).toEqual([
      ["church_id", "church-1"],
      ["registrations.church_id", "church-1"],
      ["registrations.member_id", "member-1"],
    ]);
    expect(eventQuery.in).toHaveBeenCalledWith("registrations.payment_status", ["PAID", "NOT_REQUIRED"]);
    expect(eventQuery.is.mock.calls).toEqual([
      ["registrations.event_group_id", null],
      ["registrations.deleted_at", null],
      ["deleted_at", null],
    ]);
    expect(eventQuery.order.mock.calls).toEqual([
      ["starts_at", { ascending: false }],
      ["id", { ascending: false }],
    ]);
    expect(eventQuery.range).toHaveBeenCalledWith(0, 19);
    expect(eventQuery.order.mock.invocationCallOrder.at(-1)).toBeLessThan(eventQuery.range.mock.invocationCallOrder[0]);
    expect(result).toEqual({
      items: [{ id: "event-1", name: "Conferência", startsAt: "2026-10-12T22:00:00Z", location: "Templo · Goiânia / GO" }],
      total: 1,
      page: 1,
      pageCount: 1,
    });
  });

  it("nega a consulta sem as permissões do módulo de eventos", async () => {
    await expect(getMemberEvents({ ...context, permissions: [PERMISSIONS.eventsView] }, "member-1"))
      .rejects.toThrow("MEMBER_EVENTS_PERMISSION_DENIED");
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
});
