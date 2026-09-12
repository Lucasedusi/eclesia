export const APP_SURFACE_RADIUS = "6px" as const;

export const DANGER_GRADIENT =
  "linear-gradient(to right bottom, rgb(221, 0, 49), rgb(195, 0, 47))" as const;

export const LIST_PANEL_SUBTITLE_STYLE = {
  fontSize: "12px",
  fontWeight: 500,
} as const;

export const TABLE_CONTENT_GUTTER = "22px" as const;

export const TABLE_HEADER_STYLE = {
  background: "#fafbfc",
  color: "#667085",
  fontSize: "10px",
  fontWeight: 700,
  letterSpacing: "0.04em",
} as const;

export function organizationToolbarColumns(filterCount: 2 | 4) {
  return `minmax(230px, 1fr) repeat(${filterCount}, minmax(135px, 175px)) 44px`;
}
