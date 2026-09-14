import { createElement, type ComponentType } from "react";
import { renderToString } from "react-dom/server";
import { ServerStyleSheet, ThemeProvider } from "styled-components";
import { describe, expect, it, vi } from "vitest";
import { theme } from "@/styles/theme";
import type { CongregationDetails } from "../types/organization.types";
import * as DetailsModal from "./organization-details-modal";
import * as S from "./organization.styles";

vi.mock("../actions/organization-details.actions", () => ({
  getCongregationDetailsAction: vi.fn(),
  getRegionDetailsAction: vi.fn(),
}));

const congregation: CongregationDetails = {
  id: "congregation-1",
  regionId: "region-1",
  regionName: "Regional Centro",
  name: "Congregação Central",
  code: "CC",
  pastorName: "Dirigente",
  pastorSpouseName: "Cônjuge",
  phone: "(62) 3333-3333",
  whatsapp: "(62) 99999-9999",
  email: "central@example.com",
  zipCode: "74000-000",
  address: "Rua Central",
  number: "100",
  complement: null,
  district: "Centro",
  city: "Goiânia",
  state: "GO",
  country: "Brasil",
  notes: "Observação administrativa.",
  isHeadquarters: false,
  displayOrder: 3,
  status: "ACTIVE",
  createdAt: "2026-01-10T12:00:00.000Z",
  updatedAt: "2026-02-10T12:00:00.000Z",
  documentCount: 2,
};

describe("congregation modals presentation", () => {
  it("keeps display order only in identification and omits registration history", () => {
    const Content = (
      DetailsModal as unknown as {
        CongregationDetailsContent?: ComponentType<{
          details: CongregationDetails;
        }>;
      }
    ).CongregationDetailsContent;

    expect(Content).toBeDefined();
    if (!Content) return;

    const markup = renderToString(
      createElement(
        ThemeProvider,
        { theme },
        createElement(Content, { details: congregation }),
      ),
    );

    expect(markup.match(/Ordem de exibição/g)).toHaveLength(1);
    expect(markup).not.toContain("Histórico do cadastro");
    expect(markup).not.toContain("Cadastrada em");
    expect(markup).not.toContain("Última atualização");
  });

  it("separates the phase indicator from the form content", () => {
    const sheet = new ServerStyleSheet();

    try {
      renderToString(
        sheet.collectStyles(
          createElement(
            ThemeProvider,
            { theme },
            createElement(
              S.Form,
              null,
              createElement(S.StepHeader),
              createElement("div", null, "Campos da etapa"),
            ),
          ),
        ),
      );

      expect(sheet.getStyleTags()).toContain("margin-bottom:4px");
    } finally {
      sheet.seal();
    }
  });
});
