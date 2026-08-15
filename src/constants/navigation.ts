import {
  Bell,
  CalendarDays,
  CircleHelp,
  FileArchive,
  FileText,
  LayoutDashboard,
  Network,
  Palette,
  Settings,
  ShieldCheck,
  UserCog,
  Users,
  Wallet,
} from "lucide-react";
import { PERMISSIONS } from "@/modules/auth/constants/permissions";

export const mainNavigation = [
  {
    label: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
    requiredPermission: PERMISSIONS.dashboardView,
  },
  {
    label: "Organização",
    href: "/estrutura-eclesiastica",
    icon: Network,
    requiredPermission: PERMISSIONS.organizationView,
  },
  {
    label: "Membros",
    href: "/membros",
    icon: Users,
    requiredPermission: PERMISSIONS.membersViewBasic,
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
    requiredPermission: PERMISSIONS.documentsView,
    churchAdminOnly: true,
  },
  {
    label: "Relatórios",
    href: "/relatorios",
    icon: FileText,
  },
];

export const secondaryNavigation = [
  {
    label: "Usuários",
    href: "/usuarios",
    icon: UserCog,
    requiredPermission: PERMISSIONS.usersView,
  },
  {
    label: "Auditoria",
    href: "/auditoria",
    icon: ShieldCheck,
    requiredPermission: PERMISSIONS.auditView,
  },
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
    requiredPermission: PERMISSIONS.settingsView,
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
