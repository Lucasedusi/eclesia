import { describe, expect, it } from "vitest";
import type { AuthContext } from "@/modules/auth/types/auth.types";
import { dashboardAudience, dashboardPeriod, orderedRanking } from "./dashboard";

function context(role: string, scope: string, congregationId: string | null = "unit") {
  return { access: { role, scope, congregationId, status: "ACTIVE", churchId: "church" }, church: { id: "church" }, permissions: ["dashboard.view", "members.view_basic"] } as AuthContext;
}

describe("escopo do dashboard", () => {
  it("reserva o campo inteiro ao administrador do campo", () => {
    expect(dashboardAudience(context("ADMIN", "CHURCH"))).toBe("field");
    expect(dashboardAudience(context("SECRETARY", "CHURCH"))).toBeNull();
    expect(dashboardAudience(context("ADMIN", "REGION"))).toBeNull();
  });
  it.each(["SECRETARY", "TREASURER", "VIEWER"])("restringe %s à congregação vinculada", role => {
    expect(dashboardAudience(context(role, "CONGREGATION"))).toBe("congregation");
    expect(dashboardAudience(context(role, "CONGREGATION", null))).toBeNull();
    expect(dashboardAudience(context(role, "MINISTRY"))).toBeNull();
  });
  it("exige as permissões e a igreja correspondentes ao vínculo ativo", () => {
    const user = context("ADMIN","CHURCH");
    expect(dashboardAudience({ ...user, permissions: ["dashboard.view"] })).toBeNull();
    expect(dashboardAudience({ ...user, church: { ...user.church, id: "other" } })).toBeNull();
    expect(dashboardAudience({ ...user, access: { ...user.access, status: "BLOCKED" } })).toBeNull();
  });
});
it("aceita os três períodos e inicia em Dia", () => {
  expect([undefined, "all", ["month"], "week", "month"].map(dashboardPeriod)).toEqual(["today","today","today","week","month"]);
});
it("ordena por quantidade e desempata por nome sem limitar o ranking completo", () => {
  const rows = Array.from({length: 12}, (_, i) => ({id: String(i), name: String.fromCharCode(65+i), count: i === 11 ? 2 : 1}));
  expect(orderedRanking(rows.toReversed()).map(r => r.name)).toEqual(["L","A","B","C","D","E","F","G","H","I","J","K"]);
});
