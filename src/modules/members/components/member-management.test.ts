import { createElement, type ComponentProps } from "react";
import { renderToReadableStream, renderToStaticMarkup } from "react-dom/server";
import { ThemeProvider } from "styled-components";
import { expect, it, vi } from "vitest";
import { theme } from "@/styles/theme";
import { MemberManagement, MemberStatsCards } from "./member-management";
import { getMemberCapabilities, normalizeMemberListParams } from "../services/member.service";
import type { MemberListItem } from "../types/member.types";
import type { AuthContext } from "@/modules/auth/types/auth.types";

vi.mock("server-only", () => ({}));
vi.mock("../actions/member.actions", () => ({}));

it("renderiza a busca, a situação e os filtros avançados com linhas, opções e contagem pendentes", () => {
  const pending = new Promise<never>(() => {});
  const props: ComponentProps<typeof MemberManagement> = {
    initial: { rows: pending, total: pending }, filters: pending,
    params: normalizeMemberListParams({ search: "Souza" }),
    capabilities: getMemberCapabilities({ permissions: [] } as unknown as AuthContext),
  };
  const html = renderToStaticMarkup(createElement(ThemeProvider, { theme }, createElement(MemberManagement, props)));
  expect(html).toMatch(/aria-label="Pesquisar membros"[^>]*value="Souza"/);
  expect(html).toContain('aria-label="Situação dos membros"');
  expect(html).toContain("Filtros avançados");
  expect(html).toContain('aria-label="Carregando membros"');
  expect(html).not.toContain("Nenhum membro encontrado");
});

it("mostra a indisponibilidade do resumo sem apresentar totais zerados", () => {
  const html = renderToStaticMarkup(createElement(ThemeProvider, { theme }, createElement(MemberStatsCards, { stats: null })));
  expect(html).toContain("Resumo dos membros indisponível");
  expect(html).not.toContain(">0<");
});

it("exibe as linhas e a próxima página enquanto o total exato ainda está em andamento", async () => {
  const total = Promise.withResolvers<number>();
  const filters = Promise.resolve({ regions: [], congregations: [], roles: [] });
  const member = { id: "1", fullName: "Ana de Teste", memberStatus: "ACTIVE" } as MemberListItem;
  const props: ComponentProps<typeof MemberManagement> = {
    initial: { rows: Promise.resolve({ items: [member], page: 1, hasNextPage: true }), total: total.promise },
    params: normalizeMemberListParams({}), filters,
    capabilities: getMemberCapabilities({ permissions: [] } as unknown as AuthContext),
  };
  const stream = await renderToReadableStream(createElement(ThemeProvider, { theme }, createElement(MemberManagement, props)));
  let html = "";
  const reader = stream.pipeThrough(new TextDecoderStream()).getReader();
  const finish = (async () => {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      html += chunk.value;
    }
  })();
  try {
    await vi.waitFor(() => expect(html).toContain("Ana de Teste"));
    expect(html).toContain("Calculando total");
    expect(html).not.toContain("25 registro(s)");
  } finally {
    total.resolve(25);
    await finish;
  }
  expect(html).toContain("25 registro(s)");
});
