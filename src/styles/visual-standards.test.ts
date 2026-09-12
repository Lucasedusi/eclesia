import { describe, expect, it } from "vitest";
import { theme } from "./theme";
import {
  APP_SURFACE_RADIUS,
  DANGER_GRADIENT,
  LIST_PANEL_SUBTITLE_STYLE,
  TABLE_CONTENT_GUTTER,
  TABLE_HEADER_STYLE,
  organizationToolbarColumns,
} from "./visual-standards";

describe("visual standards", () => {
  it("uses a single 6px radius for application surfaces", () => {
    expect(APP_SURFACE_RADIUS).toBe("6px");
    expect(theme.radius.sm).toBe(APP_SURFACE_RADIUS);
    expect(theme.radius.md).toBe(APP_SURFACE_RADIUS);
    expect(theme.radius.lg).toBe(APP_SURFACE_RADIUS);
    expect(theme.radius.xl).toBe(APP_SURFACE_RADIUS);
  });

  it("keeps the event table header as the shared table reference", () => {
    expect(TABLE_HEADER_STYLE).toEqual({
      background: "#fafbfc",
      color: "#667085",
      fontSize: "10px",
      fontWeight: 700,
      letterSpacing: "0.04em",
    });
  });

  it("centralizes destructive surfaces in the approved gradient", () => {
    expect(DANGER_GRADIENT).toBe(
      "linear-gradient(to right bottom, rgb(221, 0, 49), rgb(195, 0, 47))",
    );
    expect(theme.colors.state.dangerGradient).toBe(DANGER_GRADIENT);
  });

  it("keeps list subtitles and table edges aligned with the panel gutter", () => {
    expect(LIST_PANEL_SUBTITLE_STYLE).toEqual({
      fontSize: "12px",
      fontWeight: 500,
    });
    expect(TABLE_CONTENT_GUTTER).toBe("22px");
  });

  it("places the organization reset button immediately after the visible filters", () => {
    expect(organizationToolbarColumns(2)).toBe(
      "minmax(230px, 1fr) repeat(2, minmax(135px, 175px)) 44px",
    );
    expect(organizationToolbarColumns(4)).toBe(
      "minmax(230px, 1fr) repeat(4, minmax(135px, 175px)) 44px",
    );
  });
});
