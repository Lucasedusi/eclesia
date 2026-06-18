import {
  BarChart3,
  CalendarDays,
  FileArchive,
  FileText,
  Palette,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Settings,
  Users,
  Wallet,
} from "lucide-react";

export const mainNavigation = [
  {
    label: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    label: "Membros",
    href: "/membros",
    icon: Users,
  },
  {
    label: "Eventos",
    href: "/eventos",
    icon: CalendarDays,
  },
  {
    label: "Financeiro",
    href: "/financeiro",
    icon: Wallet,
  },
  {
    label: "Documentos",
    href: "/documentos",
    icon: FileArchive,
  },
  {
    label: "Relatórios",
    href: "/relatorios",
    icon: FileText,
  },
  {
    label: "Indicadores",
    href: "/indicadores",
    icon: BarChart3,
  },
];

export const secondaryNavigation = [
  {
    label: "Configurações",
    href: "/configuracoes",
    icon: Settings,
  },
  {
    label: "Design System",
    href: "/design-system",
    icon: Palette,
  },
  {
    label: "Ajuda",
    href: "/ajuda",
    icon: HelpCircle,
  },
];

export const footerNavigation = [
  {
    label: "Sair",
    href: "/sair",
    icon: LogOut,
  },
];