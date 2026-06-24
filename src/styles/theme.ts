export const theme = {
  colors: {
    brand: {
      primary: "#415BA5",
      primaryHover: "#354B8E",
      primarySoft: "rgba(65, 91, 165, 0.10)",
    },
    sidebar: {
      background: "#071426",
      item: "#A3A7AC",
      itemHover: "#FFFFFF",
      hoverBackground: "rgba(65, 91, 165, 0.30)",
      divider: "rgba(226, 232, 240, 0.10)",
    },
    text: {
      title: "#101828",
      body: "#344054",
      muted: "#667085",
      soft: "#98A2B3",
      inverse: "#FFFFFF",
    },
    surface: {
      background: "#EAEDF7",
      card: "#FFFFFF",
      soft: "#F9FAFB",
      muted: "#F2F4F7",
    },
    border: {
      default: "#CFD3D4",
      soft: "#EAECF0",
      strong: "#D0D5DD",
    },
    state: {
      success: "#2F9E73",
      successSoft: "#E7F8EF",
      warning: "#F1C84B",
      warningSoft: "#FFF7D6",
      danger: "#F57E77",
      dangerHover: "#EB6D66",
      dangerSoft: "#FFEFEF",
      info: "#415BA5",
      infoSoft: "rgba(65, 91, 165, 0.10)",
    },
    icon: {
      default: "#A3A7AC",
      muted: "#637381",
      active: "#FFFFFF",
      alert: "#F97316",
    },
  },
  font: {
    family: "'Inter', sans-serif",
  },
  radius: {
    xs: "4px",
    sm: "6px",
    md: "10px",
    lg: "12px",
    xl: "16px",
    full: "999px",
  },
  spacing: {
    controlX: "16px",
    controlY: "14px",
    card: "24px",
    section: "32px",
  },
  shadows: {
    card: "0 8px 24px rgba(15, 23, 42, 0.04)",
    soft: "0 14px 45px rgba(16, 24, 40, 0.08)",
    modal: "0 24px 70px rgba(16, 24, 40, 0.18)",
    focus: "0 0 0 3px rgba(65, 91, 165, 0.10)",
  },
  layout: {
    sidebarExpanded: "310px",
    sidebarCollapsed: "96px",
    topbarHeight: "80px",
    contentMaxWidth: "1440px",
  },
  transitions: {
    fast: "150ms ease",
    default: "220ms ease",
  },
} as const;

export type AppTheme = typeof theme;
