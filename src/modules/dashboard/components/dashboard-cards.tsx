import { Church, Network, UsersRound, type LucideIcon } from "lucide-react";
import type { DashboardSummary } from "../services/dashboard.service";

function Metric({ label, value, icon: Icon, color }: {
  label: string; value: number; icon: LucideIcon; color: string;
}) {
  return <article className="church-dashboard-metric" aria-label={label}>
    <div className="church-dashboard-metric-line">
      <span className={`church-dashboard-icon ${color}`}><Icon size={23} aria-hidden /></span>
      <div><h2>{label}</h2><strong className="church-dashboard-metric-value">{value.toLocaleString("pt-BR")}</strong></div>
    </div>
  </article>;
}

export function DashboardCards({ summary }: { summary: DashboardSummary }) {
  const unknown = summary.total - summary.male - summary.female;
  const groups = [
    { label: "Masculino", color: "male", count: summary.male },
    { label: "Feminino", color: "female", count: summary.female },
    ...(unknown > 0 ? [{ label: "Não informado", color: "unknown", count: unknown }] : []),
  ];
  return <div className="church-dashboard-metrics">
    <article className="church-dashboard-metric church-dashboard-members" aria-label="Total de membros">
      <div className="church-dashboard-metric-line">
        <span className="church-dashboard-icon church-dashboard-blue"><UsersRound size={24} aria-hidden /></span>
        <div><h2>Total de membros</h2><strong className="church-dashboard-metric-value">{summary.total.toLocaleString("pt-BR")}</strong></div>
      </div>
      <div className="church-dashboard-distribution" aria-hidden>
        {groups.filter(group => group.count > 0).map(group => <i key={group.color} className={group.color} style={{ flexGrow: group.count }} />)}
      </div>
      <div className="church-dashboard-breakdown">{groups.map(group => <span key={group.color}>
        <i aria-hidden className={group.color} />{group.label} <b>{group.count.toLocaleString("pt-BR")}</b>
      </span>)}</div>
    </article>
    {summary.regions && <Metric label="Regionais" value={summary.regions.length} icon={Network} color="church-dashboard-green" />}
    {summary.congregations && <Metric label="Congregações" value={summary.congregations.length} icon={Church} color="church-dashboard-gold" />}
  </div>;
}
