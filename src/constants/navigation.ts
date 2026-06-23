import {
  Bell,
  CalendarDays,
  CircleHelp,
  FileArchive,
  FileText,
  LayoutDashboard,
  Palette,
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
    notification: true,
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
];

export const secondaryNavigation = [
  {
    label: "Notificações",
    href: "/notificacoes",
    icon: Bell,
    notification: true,
  },
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
    label: "Suporte",
    href: "/suporte",
    icon: CircleHelp,
  },
];

export const footerNavigation = [] as const;
