import { describe, expect, it } from "vitest";
import { theme } from "./theme";
import { APP_SURFACE_RADIUS, TABLE_HEADER_STYLE } from "./visual-standards";

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
});
