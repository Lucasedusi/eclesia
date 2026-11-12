import { Activity, AlertTriangle, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { getAuditLogs, type AuditItem } from "@/modules/audit/services/audit.service";
import { Empty, MobileCard, MobileList, MobileMeta, Panel, Table, TableWrap } from "@/modules/members/components/members.styles";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo",
});
const severityStyles = {
  INFO: { Icon: ShieldCheck, label: "Informação", color: "bg-indigo-50 text-[#415BA5]" },
  WARNING: { Icon: Activity, label: "Atenção", color: "bg-amber-50 text-amber-700" },
  CRITICAL: { Icon: AlertTriangle, label: "Crítico", color: "bg-red-50 text-red-600" },
};

function Actor({ log }: { log: AuditItem }) {
  const { Icon, label, color } = severityStyles[log.severity] ?? severityStyles.INFO;
  return <div className="flex items-center gap-2.5 text-sm font-semibold text-slate-700">
    <span className={`grid size-9 shrink-0 place-items-center rounded-[6px] ${color}`} title={label}>
      <Icon size={17} aria-hidden /><span className="sr-only">{label}</span>
    </span>
    <span className="[overflow-wrap:anywhere]">{log.actor}</span>
  </div>;
}

function Timestamp({ value }: { value: string }) {
  return <time className="whitespace-nowrap" dateTime={value}>{dateFormatter.format(new Date(value))}</time>;
}

export default async function AuditPage() {
  const logs = await getAuditLogs();
  return <>
    <PageHeader title="Auditoria" subtitle="Acompanhe ações administrativas e alterações sensíveis realizadas na igreja." badge="Últimos 100 registros" />
    <Panel>
      {logs.length === 0 ? <Empty>Nenhuma ação de auditoria registrada.</Empty> : <>
        <TableWrap>
          <Table aria-label="Registros de auditoria" $lastColumnAlign="left" className="[overflow-wrap:anywhere]">
            <thead><tr>
              <th scope="col">Responsável</th><th scope="col">Módulo e ação</th><th scope="col">Entidade</th>
              <th scope="col" className="w-[32%]">Descrição</th><th scope="col">Data</th>
            </tr></thead>
            <tbody>{logs.map((log) => <tr key={log.id}>
              <td><Actor log={log} /></td>
              <td><strong>{log.module}</strong><br />{log.action}</td>
              <td>{log.entity}</td><td>{log.description}</td><td><Timestamp value={log.createdAt} /></td>
            </tr>)}</tbody>
          </Table>
        </TableWrap>
        <MobileList>{logs.map((log) => <MobileCard key={log.id} className="min-w-0 [overflow-wrap:anywhere]">
          <Actor log={log} />
          <MobileMeta>
            <div><span>Módulo e ação</span><strong>{log.module} · {log.action}</strong></div>
            <div><span>Entidade</span><strong>{log.entity}</strong></div>
            <div className="col-span-2"><span>Descrição</span><strong>{log.description}</strong></div>
            <div className="col-span-2"><span>Data</span><strong><Timestamp value={log.createdAt} /></strong></div>
          </MobileMeta>
        </MobileCard>)}</MobileList>
      </>}
    </Panel>
  </>;
}
