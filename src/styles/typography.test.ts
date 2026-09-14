import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { ServerStyleSheet, ThemeProvider } from "styled-components";
import { describe, expect, it } from "vitest";
import {
  Field,
  PublicLoading,
  PublicShell,
} from "@/modules/events/components/events.styles";
import { GlobalStyles } from "./global-styles";
import { theme } from "./theme";

function renderStyles(element: React.ReactElement) {
  const sheet = new ServerStyleSheet();

  try {
    renderToString(sheet.collectStyles(element));
    return sheet.getStyleTags();
  } finally {
    sheet.seal();
  }
}

describe("application typography", () => {
  it("adds one pixel to the application typography scale", () => {
    const styles = renderStyles(
      createElement(
        ThemeProvider,
        { theme },
        createElement(GlobalStyles),
      ),
    );

    expect(styles).toContain("--eclesia-font-size-adjustment:1px");
    expect(styles).toContain(
      "body .text-xs{font-size:calc(0.75rem + var(--eclesia-font-size-adjustment, 0px))",
    );
  });

  it("applies the adjustment to explicit component font sizes", () => {
    const styles = renderStyles(createElement(Field));

    expect(styles).toContain(
      "font-size:calc(10px + var(--eclesia-font-size-adjustment, 0px))",
    );
  });

  it("keeps public event typography at its original size", () => {
    const shellStyles = renderStyles(createElement(PublicShell));
    const loadingStyles = renderStyles(createElement(PublicLoading));

    expect(shellStyles).toContain("--eclesia-font-size-adjustment:0px");
    expect(loadingStyles).toContain("--eclesia-font-size-adjustment:0px");
  });
});
