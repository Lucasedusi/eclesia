import { Church, CircleHelp, Network, UsersRound, type LucideIcon } from "lucide-react";
import type { DashboardSummary } from "../services/dashboard.service";

function Metric({ label, count, icon: Icon, color, featured = false }: {
  label: string; count: number; icon: LucideIcon; color?: string; featured?: boolean;
}) {
  return <article className={`church-dashboard-metric church-dashboard-unit${featured ? " church-dashboard-members" : ""}`} aria-label={label}>
    <div><h2>{label}</h2><strong className="church-dashboard-metric-value">{count.toLocaleString("pt-BR")}</strong></div>
    <span className={`church-dashboard-icon ${color ?? ""}`}><Icon size={34} strokeWidth={1.65} aria-hidden /></span>
  </article>;
}

function PersonIcon({ female = false }: { female?: boolean }) {
  return <svg aria-hidden viewBox="0 0 24 24" fill="currentColor">
    <circle cx="12" cy="4" r="2.4" />
    {female
      ? <path d="M10.5 7.2h3c1 0 1.8.6 2.2 1.6l2.2 5.4-1.8.7-1.8-4.4 2.2 7h-2.7v4.9h-1.5l-.3-4.9-.3 4.9h-1.5v-4.9H7.5l2.2-7-1.8 4.4-1.8-.7 2.2-5.4c.4-1 1.2-1.6 2.2-1.6Z" />
      : <path d="M9.2 7.2h5.6c1.3 0 2.3 1 2.3 2.3v5.6h-1.9V10h-.8v12.4h-2l-.4-7.2-.4 7.2h-2V10h-.8v5.1H6.9V9.5c0-1.3 1-2.3 2.3-2.3Z" />}
  </svg>;
}

export function DashboardCards({ summary }: { summary: DashboardSummary }) {
  const unknown = summary.total - summary.male - summary.female;
  const groups = [
    { label: "Masculino", color: "male", count: summary.male, icon: <PersonIcon /> },
    { label: "Feminino", color: "female", count: summary.female, icon: <PersonIcon female /> },
    ...(unknown > 0 ? [{ label: "Não informado", color: "unknown", count: unknown, icon: <CircleHelp aria-hidden /> }] : []),
  ];
  return <>
    <Metric label="Total de membros" count={summary.total} icon={UsersRound} featured />
    <article className="church-dashboard-metric church-dashboard-genders" aria-label="Membros por sexo">
      <dl className="church-dashboard-breakdown">{groups.map(({ label, count, color, icon }) => <div key={color} className={color}>
        <dt>{icon}{label}</dt>
        <dd>{count.toLocaleString("pt-BR")}</dd>
      </div>)}</dl>
      <div className="church-dashboard-distribution" aria-hidden>
        {groups.filter(group => group.count > 0).map(group => <i key={group.color} className={group.color} style={{ flexGrow: group.count }} />)}
      </div>
    </article>
    {summary.regions && <Metric label="Regionais" count={summary.regions.length} icon={Network} color="church-dashboard-green" />}
    {summary.congregations && <Metric label="Congregações" count={summary.congregations.length} icon={Church} color="church-dashboard-gold" />}
  </>;
}
