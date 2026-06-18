import {
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileArchive,
  FileText,
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
    title: "Membros cadastrados",
    value: "0",
    description: "Base inicial preparada",
    icon: Users,
    variation: "+0%",
  },
  {
    title: "Eventos ativos",
    value: "0",
    description: "Nenhum evento em andamento",
    icon: CalendarDays,
    variation: "+0%",
  },
  {
    title: "Financeiro mensal",
    value: "R$ 0,00",
    description: "Aguardando lançamentos",
    icon: Wallet,
    variation: "+0%",
  },
  {
    title: "Documentos internos",
    value: "0",
    description: "Arquivos e registros",
    icon: FileArchive,
    variation: "+0%",
  },
];

const quickActions = [
  {
    title: "Cadastrar membro",
    description: "Adicionar novo membro à base da igreja.",
    icon: Users,
  },
  {
    title: "Criar evento",
    description: "Organizar inscrições, pagamentos e check-in.",
    icon: CalendarDays,
  },
  {
    title: "Lançar financeiro",
    description: "Registrar entradas, saídas e movimentações.",
    icon: Wallet,
  },
  {
    title: "Arquivar documento",
    description: "Salvar documentos internos da secretaria.",
    icon: FileText,
  },
];

const activities = [
  {
    title: "Layout administrativo atualizado",
    description: "Sidebar, header e base visual foram ajustados.",
    status: "Concluído",
    icon: CheckCircle2,
  },
  {
    title: "Supabase conectado",
    description: "Banco validado com tabela app_settings.",
    status: "Concluído",
    icon: CheckCircle2,
  },
  {
    title: "Modelagem geral pendente",
    description: "Próxima etapa antes dos módulos reais.",
    status: "Próximo",
    icon: Clock3,
  },
];

const chartBars = [
  { label: "Jan", height: "35%" },
  { label: "Fev", height: "52%" },
  { label: "Mar", height: "44%" },
  { label: "Abr", height: "68%" },
  { label: "Mai", height: "58%" },
  { label: "Jun", height: "78%" },
  { label: "Jul", height: "63%" },
  { label: "Ago", height: "84%" },
];

export default async function Home() {
  const appNameFromDatabase = await getAppName();

  return (
    <AppShell
      title="Dashboard"
      subtitle="Visão geral administrativa da plataforma"
    >
      <div className="space-y-6">
        <section className="overflow-hidden rounded-[24px] border border-[#cfcec9] bg-white shadow-[var(--shadow-card)]">
          <div className="grid gap-0 lg:grid-cols-[1.35fr_0.65fr]">
            <div className="p-6 md:p-8">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-[#eef2ff] px-3 py-1.5 text-xs font-extrabold text-[#3956a6]">
                <span className="h-2 w-2 rounded-full bg-[#3956a6]" />
                Versão {APP_CONFIG.version}
              </div>

              <h1 className="max-w-3xl text-2xl font-extrabold tracking-tight text-slate-950 md:text-4xl">
                {appNameFromDatabase ?? APP_CONFIG.name}
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 md:text-base">
                Plataforma preparada para gestão administrativa, secretaria,
                membros, eventos, financeiro, documentos internos e relatórios
                da igreja.
              </p>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  className="app-button-primary"
                >
                  <Plus size={18} />
                  Nova atividade
                </button>

                <button
                  type="button"
                  className="app-button-secondary"
                >
                  Ver estrutura
                  <ArrowUpRight size={18} />
                </button>
              </div>
            </div>

            <div className="border-t border-[#cfcec9] bg-[#f7f7f4] p-6 md:p-8 lg:border-l lg:border-t-0">
              <p className="text-sm font-extrabold text-slate-950">
                Status da aplicação
              </p>

              <div className="mt-5 space-y-4">
                <div className="rounded-[18px] border border-[#cfcec9] bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-slate-600">
                      Supabase
                    </p>

                    <span className="app-badge app-badge-success">
                      {appNameFromDatabase ? "OK" : "Pendente"}
                    </span>
                  </div>

                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    Conexão inicial com banco de dados validada.
                  </p>
                </div>

                <div className="rounded-[18px] border border-[#cfcec9] bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-slate-600">
                      Ambiente
                    </p>

                    <span className="app-badge app-badge-primary">
                      Dev
                    </span>
                  </div>

                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    Layout base preparado para a modelagem geral.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => {
            const Icon = card.icon;

            return (
              <article
                key={card.title}
                className="rounded-[22px] border border-[#cfcec9] bg-white p-5 shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-extrabold text-slate-500">
                      {card.title}
                    </p>

                    <h3 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-950">
                      {card.value}
                    </h3>
                  </div>

                  <div className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-[#eef2ff] text-[#3956a6]">
                    <Icon size={23} />
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between gap-3 border-t border-[#e7e5df] pt-4">
                  <p className="text-xs font-semibold text-slate-500">
                    {card.description}
                  </p>

                  <span className="rounded-full bg-[#f6f7f9] px-2.5 py-1 text-xs font-extrabold text-slate-500">
                    {card.variation}
                  </span>
                </div>
              </article>
            );
          })}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
          <div className="rounded-[24px] border border-[#cfcec9] bg-white p-6 shadow-[var(--shadow-card)]">
            <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-lg font-extrabold tracking-tight text-slate-950">
                  Visão mensal
                </h2>
                <p className="mt-1 text-sm font-medium text-slate-500">
                  Espaço reservado para futuros indicadores da plataforma.
                </p>
              </div>

              <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[#cfcec9] bg-white px-3 py-2 text-xs font-extrabold text-slate-600">
                <TrendingUp size={16} className="text-[#3956a6]" />
                Dados demonstrativos
              </span>
            </div>

            <div className="flex h-72 items-end gap-3 rounded-[20px] border border-[#e7e5df] bg-[#f7f7f4] px-4 pb-4 pt-6">
              {chartBars.map((bar) => (
                <div
                  key={bar.label}
                  className="flex h-full flex-1 flex-col justify-end gap-3"
                >
                  <div className="flex flex-1 items-end">
                    <div
                      className="w-full rounded-t-[14px] bg-[#3956a6]"
                      style={{ height: bar.height }}
                    />
                  </div>

                  <p className="text-center text-xs font-extrabold text-slate-500">
                    {bar.label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[24px] border border-[#cfcec9] bg-white p-6 shadow-[var(--shadow-card)]">
            <div className="mb-5">
              <h2 className="text-lg font-extrabold tracking-tight text-slate-950">
                Atividades recentes
              </h2>
              <p className="mt-1 text-sm font-medium text-slate-500">
                Acompanhamento inicial do projeto.
              </p>
            </div>

            <div className="space-y-4">
              {activities.map((activity) => {
                const Icon = activity.icon;

                return (
                  <div
                    key={activity.title}
                    className="rounded-[18px] border border-[#e7e5df] bg-white p-4"
                  >
                    <div className="flex gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[#eef2ff] text-[#3956a6]">
                        <Icon size={20} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="text-sm font-extrabold text-slate-950">
                            {activity.title}
                          </h3>

                          <span className="shrink-0 rounded-full bg-[#f6f7f9] px-2.5 py-1 text-[11px] font-extrabold text-slate-500">
                            {activity.status}
                          </span>
                        </div>

                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          {activity.description}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
          <div className="rounded-[24px] border border-[#cfcec9] bg-[#071426] p-6 text-white shadow-[var(--shadow-card)]">
            <p className="text-sm font-extrabold text-white/55">
              Próxima etapa
            </p>

            <h2 className="mt-3 text-2xl font-extrabold tracking-tight">
              Modelagem geral da plataforma
            </h2>

            <p className="mt-3 text-sm leading-7 text-white/65">
              Antes de criar os módulos reais, o ideal é definir entidades,
              permissões, relacionamentos, fluxos principais e escopo do MVP.
            </p>

            <button
              type="button"
              className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-[14px] bg-white px-4 text-sm font-extrabold text-[#071426] transition hover:bg-[#eef2ff]"
            >
              Preparar escopo
              <ArrowUpRight size={18} />
            </button>
          </div>

          <div className="rounded-[24px] border border-[#cfcec9] bg-white p-6 shadow-[var(--shadow-card)]">
            <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-lg font-extrabold tracking-tight text-slate-950">
                  Ações rápidas
                </h2>
                <p className="mt-1 text-sm font-medium text-slate-500">
                  Atalhos visuais preparados para os próximos módulos.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {quickActions.map((action) => {
                const Icon = action.icon;

                return (
                  <button
                    key={action.title}
                    type="button"
                    className="group rounded-[18px] border border-[#cfcec9] bg-white p-4 text-left transition hover:border-[#3956a6] hover:bg-[#eef2ff]"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-[#f6f7f9] text-[#3956a6] transition group-hover:bg-white">
                        <Icon size={20} />
                      </div>

                      <div>
                        <h3 className="text-sm font-extrabold text-slate-950">
                          {action.title}
                        </h3>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          {action.description}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}