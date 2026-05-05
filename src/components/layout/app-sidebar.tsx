import { CalendarDays, FileText, Home, Users, Wallet } from "lucide-react";

const menuItems = [
  {
    label: "Dashboard",
    icon: Home,
    href: "/",
  },
  {
    label: "Membros",
    icon: Users,
    href: "/membros",
  },
  {
    label: "Eventos",
    icon: CalendarDays,
    href: "/eventos",
  },
  {
    label: "Financeiro",
    icon: Wallet,
    href: "/financeiro",
  },
  {
    label: "Documentos",
    icon: FileText,
    href: "/documentos",
  },
];

export function AppSidebar() {
  return (
    <aside className="fixed left-0 top-0 z-20 hidden h-screen w-72 border-r border-slate-200 bg-white px-4 py-5 lg:block">
      <div className="mb-8">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#3361b3] text-lg font-bold text-white">
          PI
        </div>

        <div className="mt-4">
          <h1 className="text-lg font-bold text-slate-900">Plataforma Igreja</h1>
          <p className="text-sm text-slate-500">Gestão integrada</p>
        </div>
      </div>

      <nav className="space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;

          return (
            <a
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
            >
              <Icon size={19} />
              {item.label}
            </a>
          );
        })}
      </nav>
    </aside>
  );
}