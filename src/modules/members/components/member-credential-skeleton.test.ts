import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { ServerStyleSheet } from "styled-components";
import { describe, expect, it } from "vitest";

describe("MemberCredentialSkeleton", () => {
  it("reserva o espaço de um cartão e anuncia o carregamento sem spinner", async () => {
    const skeletonModule = await import("./member-credential-skeleton").catch(
      () => null,
    );

    expect(skeletonModule).not.toBeNull();
    if (!skeletonModule) return;

    const sheet = new ServerStyleSheet();
    try {
      const markup = renderToString(
        sheet.collectStyles(
          createElement(skeletonModule.MemberCredentialSkeleton),
        ),
      );
      const styles = sheet.getStyleTags();

      expect(markup).toContain('role="status"');
      expect(markup).toContain('aria-label="Preparando a credencial"');
      expect(markup).toContain('aria-hidden="true"');
      expect(markup.match(/app-skeleton-block/g)?.length).toBeGreaterThanOrEqual(6);
      expect(markup).not.toContain("<svg");
      expect(styles).toContain("aspect-ratio:85.6/53.98");
    } finally {
      sheet.seal();
    }
  });
});
