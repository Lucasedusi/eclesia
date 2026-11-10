"use client";
import { useState } from "react";
import { Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { canUseMemberReportField, MEMBER_REPORT_OPTIONAL_FIELDS, type MemberReportOptionalKey } from "../constants/member-report-fields";
import { useMemberReport } from "../hooks/use-member-report";
import type { MemberCapabilities, MemberListParams } from "../types/member.types";
import { memberReportSchema } from "../validations/member-report.schemas";
import * as S from "./member-report.styles";

type Props = { params: MemberListParams; capabilities: MemberCapabilities; onClose: () => void };
export function MemberReportModal({ params, capabilities, onClose }: Props) {
  const [kind, setKind] = useState<"simplified" | "complete" | "custom">("simplified");
  const [useFilters, setUseFilters] = useState(false);
  const [format, setFormat] = useState<"pdf" | "xlsx">("pdf");
  const [fields, setFields] = useState<MemberReportOptionalKey[]>(["congregation", "whatsapp"]);
  const { busy, feedback, download, setFeedback } = useMemberReport();
  const available = MEMBER_REPORT_OPTIONAL_FIELDS.filter((field) => canUseMemberReportField(field, capabilities));
  const groups = [...new Set(available.map((field) => field.group))];
  function generate() {
    const { search, congregationId, regionId, roleId, status, memberType, importBatchId, archived, sort } = params;
    const input = memberReportSchema.safeParse({ kind, format: kind === "complete" ? "xlsx" : format, ...(kind === "custom" ? { fields } : {}),
      ...(useFilters ? { filters: { search, congregationId, regionId, roleId, status, memberType, importBatchId, archived, sort } } : {}) });
    if (!input.success) { setFeedback({ error: true, message: "Revise os filtros da tela e escolha até quatro campos adicionais." }); return; }
    void download(input.data);
  }
  return <S.ReportModal open $stableHeight title="Listagem de membros" description="Escolha o modelo, os filtros e o formato." icon={<FileText />} size="md" onClose={onClose} busy={busy}
    footer={<S.Footer><Button onClick={generate} loading={busy} disabled={busy}><Download size={16} />{busy ? "Gerando listagem…" : kind === "complete" || format === "xlsx" ? "Baixar Excel" : "Baixar PDF"}</Button></S.Footer>}>
    <S.Content aria-busy={busy}>
      <S.Options disabled={busy}>
        <S.Field>Modelo<S.SelectBox><S.SelectControl aria-label="Modelo" value={kind} onChange={(e) => { const next = e.target.value as typeof kind; setKind(next); if (next === "complete") setFormat("xlsx"); setFeedback(null); }}>
          <option value="simplified">Listagem simplificada</option><option value="complete">Listagem completa</option><option value="custom">Listagem personalizada</option>
        </S.SelectControl></S.SelectBox></S.Field>
        <S.Hint>{kind === "simplified" ? "Matrícula, nome do membro, congregação, WhatsApp e cargo." : kind === "complete" ? "Todos os campos do cadastro disponíveis para o seu acesso, em uma planilha. Não inclui observações pastorais restritas." : "Matrícula e nome são fixos. Escolha até quatro campos adicionais, na ordem em que devem aparecer."}</S.Hint>
      </S.Options>
      <S.Options disabled={busy}>
        <S.Field>Filtros<S.SelectBox><S.SelectControl aria-label="Filtros" value={useFilters ? "FILTERED" : "ALL"} onChange={(e) => { setUseFilters(e.target.value === "FILTERED"); setFeedback(null); }}>
          <option value="ALL">Todos os membros não arquivados</option><option value="FILTERED">Resultados filtrados na tela</option>
        </S.SelectControl></S.SelectBox></S.Field>
        <S.Hint>{useFilters ? `Inclui todas as páginas e mantém a ordenação da tela.${params.archived ? " Somente membros arquivados." : ""}` : "Inclui todos os membros permitidos pelo seu acesso, em ordem alfabética."}</S.Hint>
      </S.Options>
      <S.Options disabled={busy}>
        <S.Field>Formato<S.SelectBox><S.SelectControl aria-label="Formato" value={kind === "complete" ? "xlsx" : format} disabled={kind === "complete"} onChange={(e) => { setFormat(e.target.value === "xlsx" ? "xlsx" : "pdf"); setFeedback(null); }}>
          {kind !== "complete" && <option value="pdf">PDF · pronto para impressão</option>}<option value="xlsx">Excel · planilha .xlsx</option>
        </S.SelectControl></S.SelectBox></S.Field>
        {kind === "complete" && <S.Hint>A listagem completa está disponível somente em Excel devido à quantidade de colunas.</S.Hint>}
      </S.Options>
      {kind === "custom" && <S.Options disabled={busy}><legend>Campos da listagem · {fields.length} de 4 adicionais</legend>
        <S.FieldGroup><S.Choices>{["Matrícula", "Nome do membro"].map((label) => <S.Choice key={label} $selected><input type="checkbox" checked disabled /><strong>{label}<small>Campo fixo</small></strong></S.Choice>)}</S.Choices></S.FieldGroup>
        {groups.map((group) => <S.FieldGroup key={group}><h3>{group}</h3><S.Choices>{available.filter((f) => f.group === group).map((field) => {
          const key = field.key as MemberReportOptionalKey, selected = fields.includes(key);
          return <S.Choice key={key} $selected={selected}><input type="checkbox" checked={selected} disabled={!selected && fields.length === 4} onChange={(e) => { setFields(e.target.checked ? [...fields, key] : fields.filter((f) => f !== key)); setFeedback(null); }} /><strong>{field.label}{selected && <small>Coluna {fields.indexOf(key) + 3}</small>}</strong></S.Choice>;
        })}</S.Choices></S.FieldGroup>)}
      </S.Options>}
      {feedback && <S.Feedback $error={feedback.error} role={feedback.error ? "alert" : "status"}>{feedback.message}</S.Feedback>}
    </S.Content>
  </S.ReportModal>;
}
