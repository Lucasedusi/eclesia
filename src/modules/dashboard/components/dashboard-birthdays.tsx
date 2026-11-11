import Link from "next/link";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { AuthContext } from "@/modules/auth/types/auth.types";
import { BIRTHDAY_PAGE_SIZE, readBirthdayBatch } from "@/modules/members/services/member-birthdays.service";
import { birthdayCalendar, birthdayFiltersSchema } from "@/modules/members/validations/member-birthdays";
import { dashboardPeriod, type DashboardPeriod } from "../dashboard";
import { BirthdayPeriod } from "./birthday-period";

export type DashboardParams = Promise<Record<string, string | string[] | undefined>>;
const pageNumber = z.coerce.number().int().min(1).max(1_000_000).catch(1);

function pageHref(period: DashboardPeriod, page: number) {
  const search = new URLSearchParams();
  if (period !== "today") search.set("period", period);
  if (page > 1) search.set("page", String(page));
  return search.size ? `/?${search}` : "/";
}

export async function DashboardBirthdays({ context, searchParams, showCongregation }: {
  context: AuthContext; searchParams: DashboardParams; showCongregation: boolean;
}) {
  const query = await searchParams;
  const period = dashboardPeriod(query.period);
  const page = pageNumber.parse(query.page);
  const filters = birthdayFiltersSchema.parse({ period });
  const { ranges, label } = birthdayCalendar(filters);
  const start = (page - 1) * BIRTHDAY_PAGE_SIZE;
  const client = await createClient();
  const result = await readBirthdayBatch(client, context, filters, ranges, start, start + BIRTHDAY_PAGE_SIZE - 1, "dashboard");
  const pages = Math.ceil((result.count ?? 0) / BIRTHDAY_PAGE_SIZE);
  const missingPage = page > 1 && (result.error?.code === "PGRST103" || (!result.error && !result.data?.length));

  return <section className="church-dashboard-panel" aria-label="Aniversariantes">
    <div className="church-dashboard-section-header">
      <div><h2>Aniversariantes</h2><p>{label}</p></div>
      <BirthdayPeriod period={period} />
    </div>
    {missingPage ? <p className="church-dashboard-empty"><Link href={pageHref(period, 1)} scroll={false}>Voltar à primeira página</Link></p>
      : result.error || !result.data ? <p role="alert" className="church-dashboard-empty">Não foi possível carregar os aniversariantes.</p>
      : result.data.length === 0 ? <p className="church-dashboard-empty">{period === "today" ? "Nenhum aniversariante hoje." : "Nenhum aniversariante neste período."}</p>
      : <>
        <table className="church-dashboard-table" aria-label="Aniversariantes do período">
          <thead><tr><th scope="col">Nome</th>{showCongregation && <th scope="col">Congregação</th>}<th scope="col">Aniversário</th></tr></thead>
          <tbody>{result.data.map(row => {
            const mmdd = String(row.birthday_mmdd).padStart(4, "0");
            return <tr key={row.id}><td>{row.full_name}</td>{showCongregation && <td>{row.congregations?.name ?? "—"}</td>}
              <td>{mmdd.slice(2)}/{mmdd.slice(0, 2)}</td></tr>;
          })}</tbody>
        </table>
        {pages > 1 && <nav className="church-dashboard-pagination" aria-label="Páginas de aniversariantes">
          <span>Página {page} de {pages}</span>
          {page > 1 && <Link href={pageHref(period, page - 1)} scroll={false}>Anterior</Link>}
          {page < pages && <Link href={pageHref(period, page + 1)} scroll={false}>Próxima</Link>}
        </nav>}
      </>}
  </section>;
}
