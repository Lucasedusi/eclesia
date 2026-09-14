import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { ServerStyleSheet, ThemeProvider } from "styled-components";
import { describe, expect, it } from "vitest";
import { theme } from "@/styles/theme";

describe("organization detail section heading", () => {
  it("places the boxed icon before the section title and subtitle", async () => {
    let headingModule:
      | typeof import("./organization-detail-section-heading")
      | undefined;

    try {
      headingModule = await import("./organization-detail-section-heading");
    } catch {
      headingModule = undefined;
    }

    expect(headingModule).toBeDefined();
    if (!headingModule) return;

    const sheet = new ServerStyleSheet();

    try {
      const markup = renderToString(
        sheet.collectStyles(
          createElement(
            ThemeProvider,
            { theme },
            createElement(headingModule.DetailSectionHeading, {
              icon: createElement("svg", { "aria-label": "Ícone da seção" }),
              title: "Liderança e contato",
              subtitle: "Responsáveis e canais institucionais cadastrados.",
              tone: "success",
            }),
          ),
        ),
      );
      const styles = sheet.getStyleTags();

      expect(markup.indexOf("<svg")).toBeLessThan(markup.indexOf("<h3"));
      expect(markup).toContain("Liderança e contato");
      expect(markup).toContain(
        "Responsáveis e canais institucionais cadastrados.",
      );
      expect(styles).toContain("width:36px");
      expect(styles).toContain("height:36px");
      expect(styles).toContain("background:#e7f8ef");
    } finally {
      sheet.seal();
    }
  });
});
