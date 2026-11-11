import { Church, CircleHelp, Mars, Network, UsersRound, Venus, type LucideIcon } from "lucide-react";
import type { DashboardSummary } from "../services/dashboard.service";

function OrganizationMetric({ label, count, icon: Icon, color }: {
  label: string; count: number; icon: LucideIcon; color: string;
}) {
  return <article className="church-dashboard-metric church-dashboard-unit" aria-label={label}>
    <span className={`church-dashboard-icon ${color}`}><Icon size={34} strokeWidth={1.65} aria-hidden /></span>
    <div><h2>{label}</h2><strong className="church-dashboard-metric-value">{count.toLocaleString("pt-BR")}</strong></div>
  </article>;
}

export function DashboardCards({ summary }: { summary: DashboardSummary }) {
  const unknown = summary.total - summary.male - summary.female;
  const groups = [
    { label: "Masculino", color: "male", count: summary.male, icon: Mars },
    { label: "Feminino", color: "female", count: summary.female, icon: Venus },
    ...(unknown > 0 ? [{ label: "Não informado", color: "unknown", count: unknown, icon: CircleHelp }] : []),
  ];
  return <>
    <article className="church-dashboard-metric church-dashboard-members" aria-label="Total de membros">
      <h2>Total de membros</h2>
      <strong className="church-dashboard-metric-value">{summary.total.toLocaleString("pt-BR")}</strong>
      <span className="church-dashboard-icon"><UsersRound size={34} strokeWidth={1.65} aria-hidden /></span>
      <p>Membros e crianças ativos</p>
    </article>
    <article className="church-dashboard-metric church-dashboard-genders" aria-label="Membros por sexo">
      <h2>Membros por sexo</h2>
      <dl className="church-dashboard-breakdown">{groups.map(({ label, count, color, icon: Icon }) => <div key={color} className={color}>
        <dt><Icon aria-hidden size={30} strokeWidth={1.8} />{label}</dt>
        <dd>{count.toLocaleString("pt-BR")}</dd>
      </div>)}</dl>
      <div className="church-dashboard-distribution" aria-hidden>
        {groups.filter(group => group.count > 0).map(group => <i key={group.color} className={group.color} style={{ flexGrow: group.count }} />)}
      </div>
    </article>
    {summary.regions && <OrganizationMetric label="Regionais" count={summary.regions.length} icon={Network} color="church-dashboard-green" />}
    {summary.congregations && <OrganizationMetric label="Congregações" count={summary.congregations.length} icon={Church} color="church-dashboard-gold" />}
  </>;
}
