import {
  CalendarCheck,
  FileArchive,
  Plus,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { APP_CONFIG } from "@/constants/app";
import { getAppName } from "@/services/app-settings.service";

const summaryCards = [
  {
    title: "Total de Membros",
    value: "0",
    description: "Cadastros ativos na plataforma",
    icon: Users,
    accent: "bg-blue-50 text-[#0b51b7]",
  },
  {
    title: "Eventos Ativos",
    value: "0",
    description: "Eventos em andamento",
    icon: CalendarCheck,
    accent: "bg-emerald-50 text-emerald-600",
  },
  {
    title: "Entradas do Mês",
    value: "R$ 0,00",
    description: "Resumo financeiro inicial",
    icon: Wallet,
    accent: "bg-amber-50 text-amber-600",
  },
  {
    title: "Documentos",
    value: "0",
    description: "Arquivos internos salvos",
    icon: FileArchive,
    accent: "bg-violet-50 text-violet-600",
  },
];

const quickActions = [
  "Cadastrar membro",
  "Criar evento",
  "Lançar movimentação",
  "Arquivar documento",
];

const recentActivities = [
  {
    title: "Base inicial configurada",
    description: "Next.js, Tailwind CSS e Supabase foram preparados.",
  },
  {
    title: "Banco conectado",
    description: "A aplicação conseguiu consultar dados do Supabase.",
  },
  {
    title: "Layout administrativo iniciado",
    description: "Sidebar e header preparados para os próximos módulos.",
  },
];

export default async function Home() {
  const appNameFromDatabase = await getAppName();

  return (
    <AppShell
      title="Dashboard"
      subtitle="Visão geral inicial da plataforma"
    >
      <section className="mb-6 overflow-hidden rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
          <div>
            <p className="text-sm font-semibold text-[#0b51b7]">
              Versão {APP_CONFIG.version}
            </p>

            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 md:text-3xl">
              {appNameFromDatabase ?? APP_CONFIG.name}
            </h1>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 md:text-base">
              Plataforma preparada para gestão de membros, eventos, financeiro,
              documentos internos e relatórios administrativos da igreja.
            </p>
          </div>

          <div className="rounded-2xl bg-[#eef4ff] px-4 py-3 text-sm text-slate-700">
            Conexão com Supabase:{" "}
            <span className="font-bold text-emerald-600">
              {appNameFromDatabase ? "OK" : "não verificada"}
            </span>
          </div>
        </div>
      </section>

      <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => {
          const Icon = card.icon;

          return (
            <article
              key={card.title}
              className="rounded-[1.7rem] bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-500">
                    {card.title}
                  </p>
                  <h3 className="mt-3 text-2xl font-bold text-slate-950">
                    {card.value}
                  </h3>
                </div>

                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-2xl ${card.accent}`}
                >
                  <Icon size={23} />
                </div>
              </div>

              <p className="mt-4 text-sm text-slate-500">{card.description}</p>

              <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full w-2/5 rounded-full bg-[#0b51b7]" />
              </div>
            </article>
          );
        })}
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-950">
                Ações rápidas
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Atalhos preparados para os próximos módulos.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {quickActions.map((action) => (
              <button
                key={action}
                type="button"
                className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-left text-sm font-semibold text-slate-700 transition hover:border-[#0b51b7]/30 hover:bg-[#eef4ff] hover:text-[#0b51b7]"
              >
                <span>{action}</span>
                <Plus size={18} />
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eef4ff] text-[#0b51b7]">
              <TrendingUp size={21} />
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-950">
                Atividades recentes
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Histórico inicial da plataforma.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {recentActivities.map((activity, index) => (
              <div key={activity.title} className="flex gap-3">
                <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0b51b7] text-xs font-bold text-white">
                  {index + 1}
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    {activity.title}
                  </h3>
                  <p className="mt-1 text-sm leading-5 text-slate-500">
                    {activity.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </AppShell>
  );
}