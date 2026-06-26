import Link from "next/link";
import { ClipboardList, Plus, Search, UserPlus, Users } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/ui/page-header";

const memberQuickStats = [
  {
    title: "Cadastro multi etapas",
    description:
      "Formulário dividido em etapas para deixar o preenchimento mais leve.",
    icon: ClipboardList,
  },
  {
    title: "Dados ministeriais",
    description: "Congregação, cargo, ministério, status e tipo de cadastro.",
    icon: Users,
  },
  {
    title: "Validação por etapa",
    description:
      "Campos obrigatórios bloqueiam o avanço sem perder o que já foi digitado.",
    icon: Search,
  },
];

export default function MembersPage() {
  return (
    <AppShell
      title="Membros"
      subtitle="Gestão de membros, congregados, visitantes e crianças"
    >
      <PageHeader
        title="Membros"
        subtitle="Comece pelo cadastro de um novo membro. O cadastro no banco já está ativo. A listagem e os filtros serão implementados nas próximas etapas."
        badge="Módulo inicial"
        action={
          <Link href="/membros/novo" className="app-button-primary">
            <Plus size={18} aria-hidden="true" />
            Novo membro
          </Link>
        }
      />

      <section className="grid gap-4 md:grid-cols-3">
        {memberQuickStats.map((item) => {
          const Icon = item.icon;

          return (
            <article
              key={item.title}
              className="rounded-[22px] border border-[#EAECF0] bg-white p-5 shadow-[var(--shadow-card)]"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-[#eef2ff] text-[#415BA5]">
                <Icon size={22} aria-hidden="true" />
              </div>

              <h2 className="mt-5 text-[16px] font-extrabold tracking-[-0.02em] text-slate-950">
                {item.title}
              </h2>

              <p className="mt-2 text-sm font-medium leading-6 text-slate-500">
                {item.description}
              </p>
            </article>
          );
        })}
      </section>

      <section className="mt-6 overflow-hidden rounded-[24px] border border-[#EAECF0] bg-white shadow-[var(--shadow-card)]">
        <div className="grid gap-0 lg:grid-cols-[1fr_0.6fr]">
          <div className="p-6 md:p-8">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-[#eef2ff] px-3 py-1.5 text-xs font-extrabold text-[#415BA5]">
              <UserPlus size={14} aria-hidden="true" />
              Primeira fase do módulo
            </div>

            <h2 className="max-w-3xl text-2xl font-extrabold tracking-tight text-slate-950 md:text-3xl">
              Cadastro de membros com preenchimento leve e organizado
            </h2>

            <p className="mt-3 max-w-3xl text-sm font-medium leading-7 text-slate-600">
              A primeira entrega concentra a experiência do formulário: etapas,
              progresso, campos obrigatórios, revisão e carregamento das opções
              auxiliares. O salvamento real no banco agora cria o membro, seus
              vínculos iniciais e o histórico automático.
            </p>

            <div className="mt-6">
              <Link href="/membros/novo" className="app-button-primary">
                <Plus size={18} aria-hidden="true" />
                Iniciar cadastro
              </Link>
            </div>
          </div>

          <div className="border-t border-[#EAECF0] bg-[#F9FAFB] p-6 md:p-8 lg:border-l lg:border-t-0">
            <p className="text-sm font-extrabold text-slate-950">
              Próximas etapas
            </p>

            <ul className="mt-4 space-y-3 text-sm font-medium leading-6 text-slate-600">
              <li>• Cadastro real na tabela members já implementado.</li>
              <li>• Vínculo inicial com cargo e ministério já implementado.</li>
              <li>
                • Histórico automático do cadastro inicial já implementado.
              </li>
              <li>• Próximo passo: listagem, filtros e edição de membros.</li>
            </ul>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
