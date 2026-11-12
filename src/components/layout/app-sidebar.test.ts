import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ThemeProvider } from "styled-components";
import { expect, it, vi } from "vitest";
import { PERMISSIONS } from "@/modules/auth/constants/permissions";
import type { AuthContext } from "@/modules/auth/types/auth.types";
import { theme } from "@/styles/theme";
import { AppSidebar } from "./app-sidebar";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

const context: AuthContext = {
  profile: { id: "user", fullName: "Ana Costa", displayName: "Ana", email: "", avatarUrl: null, status: "ACTIVE" },
  church: { id: "church", name: "Igreja do Centro", logoUrl: null },
  access: { id: "access", churchId: "church", role: "ADMIN", scope: "CHURCH", status: "ACTIVE", regionId: null, congregationId: null, ministryId: null },
  accesses: [],
  availableChurches: [],
  permissions: Object.values(PERMISSIONS),
};

function sidebar(props: Partial<Parameters<typeof AppSidebar>[0]> = {}) {
  return renderToStaticMarkup(createElement(ThemeProvider, { theme },
    createElement(AppSidebar, { authContext: context, ...props }),
  ));
}

it.each([{}, { collapsed: true }, { mobile: true }])("exibe a igreja e os atalhos disponíveis na sidebar (%j)", (props) => {
  const html = sidebar(props);
  expect(html).toContain(context.church.name);
  expect(html).not.toContain(">Ana<");
  expect(html).not.toContain(">AC<");
  for (const path of ["/relatorios", "/notificacoes", "/design-system", "/suporte"]) {
    expect(html).not.toContain(`href="${path}"`);
  }
  expect(html).toContain('href="/membros"');
  expect(html).toContain('href="/configuracoes"');
});

it("exibe apenas a navegação autorizada quando o menu do sistema fica vazio", () => {
  const html = sidebar({ authContext: { ...context, permissions: [PERMISSIONS.membersViewBasic] } });
  expect(html).toContain('href="/membros"');
  expect(html).not.toContain('href="/configuracoes"');
  expect(html).not.toContain('aria-label="Menu do sistema"');
});
