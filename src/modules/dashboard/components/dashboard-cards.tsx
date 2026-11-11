import { Church, Network, UsersRound, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { DashboardSummary } from "../services/dashboard.service";

function Metric({ label, value, icon: Icon, color, children }: {
  label: string; value: number; icon: LucideIcon; color: string; children?: ReactNode;
}) {
  return <article className="church-dashboard-metric" aria-label={label}>
    <div className="church-dashboard-metric-top"><h2>{label}</h2><span className={color}><Icon size={20} aria-hidden /></span></div>
    <strong className="church-dashboard-metric-value">{value.toLocaleString("pt-BR")}</strong>
    {children && <div className="church-dashboard-breakdown">{children}</div>}
  </article>;
}

export function DashboardCards({ summary }: { summary: DashboardSummary }) {
  const unknown = summary.total - summary.male - summary.female;
  return <div className="church-dashboard-metrics">
    <Metric label="Total de membros" value={summary.total} icon={UsersRound} color="church-dashboard-blue">
      <span>Masculino <b>{summary.male.toLocaleString("pt-BR")}</b></span>
      <span>Feminino <b>{summary.female.toLocaleString("pt-BR")}</b></span>
      {unknown > 0 && <span>Não informado <b>{unknown.toLocaleString("pt-BR")}</b></span>}
    </Metric>
    {summary.regions && <Metric label="Regionais" value={summary.regions.length} icon={Network} color="church-dashboard-green" />}
    {summary.congregations && <Metric label="Congregações" value={summary.congregations.length} icon={Church} color="church-dashboard-gold" />}
  </div>;
}
