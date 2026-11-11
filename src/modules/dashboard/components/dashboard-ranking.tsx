"use client";

import { useState, type ReactNode } from "react";
import { ArrowRight, ChartColumnDecreasing, ContactRound } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { rankingPreview, type RankingRow } from "../dashboard";

type Group = "congregations" | "regions";
type View = Group | "roles";
type Props = { congregations: RankingRow[] | null; regions: RankingRow[] | null; roles: RankingRow[] | null; total: number };

const labels = { congregations: "Congregações", regions: "Regionais", roles: "Cargos" };
const titles = { congregations: "Membros por congregação", regions: "Membros por regional", roles: "Membros por cargo" };
const format = (value: number) => value.toLocaleString("pt-BR");

function RankingSwitch({ active, options, onSelect, mobile }: {
  active: View; options: View[]; onSelect: (view: View) => void; mobile?: boolean;
}) {
  return <div role="group" aria-label="Exibir ranking por" className={`church-dashboard-switch ${mobile ? "mobile-switch" : "desktop-switch"}`}>
    {options.map(option => <button type="button" key={option} aria-pressed={option === active}
      onClick={() => onSelect(option)}>{labels[option]}</button>)}
  </div>;
}

function RankingPanel({ view, rows, controls, footer, mobileActive }: {
  view: View; rows: RankingRow[]; controls?: ReactNode; footer?: ReactNode; mobileActive: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const byRole = view === "roles";
  const { full, top } = rankingPreview(rows, byRole ? 5 : 10);
  const title = titles[view];
  const Icon = byRole ? ContactRound : ChartColumnDecreasing;
  const hasMore = full.length > top.length;
  return <section className="church-dashboard-panel church-dashboard-rank-panel" data-mobile-active={mobileActive} aria-label={title}>
    <div className="church-dashboard-section-header">
      <h2><Icon aria-hidden size={19} />{title}</h2>
      {controls}
    </div>
    {top.length === 0 ? <p className="church-dashboard-empty">
      {byRole ? "Nenhum membro com cargo ativo." : "Nenhum membro vinculado neste ranking."}
    </p> : byRole ? <ol className="church-dashboard-role-list" aria-label={title}>
      {top.map(row => <li key={row.id}>
        <div><span>{row.name}</span><strong>{format(row.count)}</strong></div>
        <span className="church-dashboard-role-track" aria-hidden><i style={{ width: `${100 * row.count / top[0].count}%` }} /></span>
      </li>)}
    </ol> : <div className="church-dashboard-plot" tabIndex={0} role="region" aria-label="Gráfico de colunas">
      <ol className="church-dashboard-columns" aria-label={title} style={{ minWidth: `calc(${top.length} * var(--dashboard-column-min))` }}>
        {top.map(row => <li key={row.id} title={`${row.name} · ${format(row.count)}`}>
          <div className="church-dashboard-column-track">
            <strong>{format(row.count)}</strong>
            <i aria-hidden style={{ height: `${100 * row.count / top[0].count}%` }} />
          </div>
          <span>{row.name}</span>
        </li>)}
      </ol>
    </div>}
    {(footer || hasMore) && <div className="church-dashboard-ranking-footer">
      {footer}
      {hasMore && <button type="button" className="church-dashboard-more" aria-haspopup="dialog" onClick={() => setExpanded(true)}>
        Ver {byRole ? "todos" : "todas"} ({format(full.length)})<ArrowRight aria-hidden size={14} />
      </button>}
    </div>}
    {expanded && <Modal title={title} onClose={() => setExpanded(false)} size="sm" headerShadowOnScroll>
      <ol className="church-dashboard-full-ranking" aria-label={title}>
        {full.map(row => <li key={row.id}><span>{row.name}</span><strong>{format(row.count)}</strong></li>)}
      </ol>
    </Modal>}
  </section>;
}

export function DashboardRanking({ congregations, regions, roles, total }: Props) {
  const [group, setGroup] = useState<Group>("congregations");
  const [showMobileRoles, setShowMobileRoles] = useState(false);
  const organization = congregations !== null && regions !== null;
  if (!organization && !roles) return null;

  const mobileView = !organization || (roles && showMobileRoles) ? "roles" : group;
  const selectView = (view: View) => {
    setShowMobileRoles(view === "roles");
    if (view !== "roles") setGroup(view);
  };
  // Each church member can hold one active role (member_roles_one_active_per_member_idx).
  const unassigned = roles ? total - roles.reduce((sum, row) => sum + row.count, 0) : 0;
  return <div className="church-dashboard-rankings" data-pair={organization && roles !== null}>
    {organization && <RankingSwitch mobile active={mobileView} onSelect={selectView}
      options={roles ? ["congregations", "regions", "roles"] : ["congregations", "regions"]} />}
    {organization && <RankingPanel view={group} rows={group === "regions" ? regions : congregations}
      mobileActive={mobileView !== "roles"} controls={<RankingSwitch active={group}
        options={["congregations", "regions"]} onSelect={selectView} />} />}
    {roles && <RankingPanel view="roles" rows={roles} mobileActive={mobileView === "roles"}
      footer={unassigned > 0 && <span>{format(unassigned)} {unassigned === 1 ? "membro sem cargo ativo" : "membros sem cargo ativo"}</span>} />}
  </div>;
}
