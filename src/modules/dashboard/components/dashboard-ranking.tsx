"use client";

import { useState } from "react";
import { orderedRanking, type RankingRow } from "../dashboard";

type Props = { congregations: RankingRow[] | null; regions: RankingRow[] | null; roles: RankingRow[] | null };

export function DashboardRanking({ congregations, regions, roles }: Props) {
  const [group, setGroup] = useState("congregations");
  const [expanded, setExpanded] = useState(false);
  const field = congregations !== null && regions !== null;
  const data = field ? (group === "regions" ? regions : congregations) : roles;
  if (!data) return null;
  const ranking = orderedRanking(data);
  const visible = expanded ? ranking : ranking.slice(0, 10);
  const maximum = ranking[0]?.count || 1;
  const title = field ? (group === "regions" ? "Membros por regional" : "Membros por congregação") : "Membros por cargo";

  return <section className="church-dashboard-panel" aria-label="Ranking de membros">
    <div className="church-dashboard-section-header">
      <h2>{title}</h2>
      {field && <select aria-label="Agrupar ranking por" value={group} onChange={event => {
        setGroup(event.target.value);
        setExpanded(false);
      }}>
        <option value="congregations">Congregações</option><option value="regions">Regionais</option>
      </select>}
    </div>
    {visible.length ? <ol className="church-dashboard-ranking" aria-label={title}>
      {visible.map(row => <li key={row.id}>
        <span className="church-dashboard-rank-name">{row.name}</span>
        <span className="church-dashboard-track" aria-hidden="true"><span style={{ width: `${100 * row.count / maximum}%` }} /></span>
        <strong>{row.count.toLocaleString("pt-BR")}</strong>
      </li>)}
    </ol> : <p className="church-dashboard-empty">{field ? "Nenhum registro para este ranking." : "Nenhum membro com cargo ativo na congregação."}</p>}
    {ranking.length > 10 && <button type="button" className="church-dashboard-more" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
      {expanded ? "Mostrar menos" : `Ver tod${field ? "as" : "os"} (${ranking.length})`}
    </button>}
  </section>;
}
