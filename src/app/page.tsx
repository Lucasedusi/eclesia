import { AppShell } from "@/components/layout/app-shell";
import { APP_CONFIG } from "@/constants/app";
import { getAppName } from "@/services/app-settings.service";

const cards = [
  {
    title: "Membros",
    description: "Estrutura preparada para cadastro e gestão de membros.",
  },
  {
    title: "Eventos",
    description: "Base preparada para inscrições, pagamentos e check-in.",
  },
  {
    title: "Financeiro",
    description: "Futura gestão de entradas, saídas, caixas e relatórios.",
  },
  {
    title: "Documentos",
    description: "Área futura para arquivamento e controle interno.",
  },
];

export default async function Home() {
  const appNameFromDatabase = await getAppName();

  return (
    <AppShell>
      <section className="mb-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <p className="text-sm font-semibold uppercase tracking-wide text-[#3361b3]">
          {APP_CONFIG.version}
        </p>

        <h1 className="mt-2 text-2xl font-bold text-slate-950 md:text-3xl">
          {appNameFromDatabase ?? APP_CONFIG.name}
        </h1>

        <p className="mt-2 max-w-3xl text-slate-600">
          Base inicial configurada com Next.js, TypeScript, Tailwind CSS e
          Supabase. A partir daqui, os módulos poderão ser criados de forma
          organizada e escalável.
        </p>

        <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Conexão com Supabase:{" "}
          <span className="font-semibold text-emerald-700">
            {appNameFromDatabase ? "OK" : "não verificada"}
          </span>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <article
            key={card.title}
            className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
          >
            <h3 className="text-lg font-bold text-slate-900">{card.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {card.description}
            </p>
          </article>
        ))}
      </section>
    </AppShell>
  );
}