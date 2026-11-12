import {
  CalendarDays,
  FileArchive,
  LayoutDashboard,
  Network,
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
    requiredPermission: PERMISSIONS.eventsView,
  },
  {
    label: "Financeiro",
    href: "/financeiro",
    icon: Wallet,
    requiredPermission: PERMISSIONS.financeView,
  },
  {
    label: "Documentos",
    href: "/documentos",
    icon: FileArchive,
    requiredPermission: PERMISSIONS.documentsView,
    churchAdminOnly: true,
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
    label: "Configurações",
    href: "/configuracoes",
    icon: Settings,
    requiredPermission: PERMISSIONS.settingsView,
  },
];

export const footerNavigation = [] as const;
