import { Activity, AlertTriangle, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { requireAccessContext } from "@/modules/auth/services/access-context.service";
import { PERMISSIONS } from "@/modules/auth/constants/permissions";
import { getAuditLogs } from "@/modules/audit/services/audit.service";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

export default async function AuditPage() {
  const [, logs] = await Promise.all([
    requireAccessContext(PERMISSIONS.auditView),
    getAuditLogs(),
  ]);
  return <>
    <PageHeader title="Auditoria" subtitle="Acompanhe ações administrativas e alterações sensíveis realizadas na igreja." badge="Últimos 100 registros" />
    <section className="overflow-hidden rounded-[20px] border border-[#EAECF0] bg-white shadow-[var(--shadow-card)]">
      <div className="grid grid-cols-[1.05fr_.7fr_.8fr_1.3fr_.7fr] gap-4 border-b border-[#EAECF0] bg-[#F9FAFB] px-5 py-3 text-[calc(10px+var(--eclesia-font-size-adjustment))] font-bold uppercase tracking-wide text-slate-400 max-lg:hidden">
        <span>Responsável</span><span>Módulo e ação</span><span>Entidade</span><span>Descrição</span><span>Data</span>
      </div>
      {logs.length ? <div className="divide-y divide-[#EAECF0]">{logs.map((log)=><article key={log.id} className="grid grid-cols-[1.05fr_.7fr_.8fr_1.3fr_.7fr] items-center gap-4 px-5 py-4 max-lg:grid-cols-1 max-lg:gap-2">
        <div className="flex min-w-0 items-center gap-3"><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${log.severity === "CRITICAL" ? "bg-red-50 text-red-500" : log.severity === "WARNING" ? "bg-amber-50 text-amber-500" : "bg-indigo-50 text-[#415BA5]"}`}>{log.severity === "CRITICAL" ? <AlertTriangle size={17}/> : log.severity === "WARNING" ? <Activity size={17}/> : <ShieldCheck size={17}/>}</span><strong className="truncate text-xs font-bold text-slate-700">{log.actor}</strong></div>
        <div><strong className="block text-[calc(11px+var(--eclesia-font-size-adjustment))] font-bold text-slate-700">{log.module}</strong><span className="mt-1 block text-[calc(9px+var(--eclesia-font-size-adjustment))] font-semibold text-slate-400">{log.action}</span></div>
        <span className="text-[calc(11px+var(--eclesia-font-size-adjustment))] font-semibold text-slate-500">{log.entity}</span>
        <p className="m-0 text-[calc(11px+var(--eclesia-font-size-adjustment))] font-normal leading-5 text-slate-500">{log.description}</p>
        <time className="text-[calc(10px+var(--eclesia-font-size-adjustment))] font-semibold text-slate-400">{dateFormatter.format(new Date(log.createdAt))}</time>
      </article>)}</div> : <div className="px-5 py-16 text-center text-sm font-medium text-slate-400">Nenhuma ação de auditoria registrada.</div>}
    </section>
  </>;
}
