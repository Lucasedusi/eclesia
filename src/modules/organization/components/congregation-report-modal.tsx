"use client";
import { useState } from "react";
import { Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCongregationReport } from "../hooks/use-congregation-report";
import { congregationReportSchema } from "../validations/congregation-report.schemas";
import * as S from "./region-report.styles";

type Props = { filters: { search: string; status: string; sort: string; region: string; congregationType: string }; onClose: () => void };
export function CongregationReportModal({ filters, onClose }: Props) {
  const [useFilters, setUseFilters] = useState(false);
  const [format, setFormat] = useState<"pdf" | "xlsx">("pdf");
  const [fields, setFields] = useState({ spouse: false, phone: true, address: false });
  const { busy, feedback, download, setFeedback } = useCongregationReport();
  function generate() {
    const input = congregationReportSchema.safeParse({ kind: "simplified", format, fields, ...(useFilters ? filters : {}) });
    if (!input.success) { setFeedback({ error: true, message: "Revise os filtros da tela. A busca deve ter no máximo 200 caracteres." }); return; }
    void download(input.data);
  }
  return <S.ReportModal open $stableHeight title="Relatórios de congregações" description="Escolha os campos e o formato da listagem." icon={<FileText />} size="md" onClose={onClose} busy={busy}
    footer={<S.Footer><Button onClick={generate} loading={busy} disabled={busy}><Download size={16} />{busy ? "Gerando relatório…" : format === "pdf" ? "Baixar PDF" : "Baixar Excel"}</Button></S.Footer>}>
    <S.Content aria-busy={busy}>
      <S.Options disabled={busy}>
        <S.Field>Abrangência<S.SelectBox><S.SelectControl value={useFilters ? "FILTERED" : "ALL"} onChange={(e) => setUseFilters(e.target.value === "FILTERED")}><option value="ALL">Todas as congregações</option><option value="FILTERED">Resultados filtrados na tela</option></S.SelectControl></S.SelectBox></S.Field>
        {useFilters && <S.Hint>{filters.search ? `Busca: ${filters.search}. ` : ""}Inclui todas as páginas dos resultados filtrados.</S.Hint>}
      </S.Options>
      <S.Options disabled={busy}><legend>Campos opcionais</legend>
        {([{ key: "spouse", label: "Cônjuge" }, { key: "phone", label: "Telefone" }, { key: "address", label: "Endereço" }] as const).map(({ key, label }) => <S.Choice key={key} $selected={fields[key]}><input type="checkbox" checked={fields[key]} onChange={(e) => setFields({ ...fields, [key]: e.target.checked })} /><strong>{label}</strong></S.Choice>)}
      </S.Options>
      <S.Options disabled={busy}>
        <S.Field>Formato<S.SelectBox><S.SelectControl value={format} onChange={(e) => setFormat(e.target.value === "xlsx" ? "xlsx" : "pdf")}><option value="pdf">PDF · pronto para impressão</option><option value="xlsx">Excel · planilha .xlsx</option></S.SelectControl></S.SelectBox></S.Field>
      </S.Options>
      {feedback && <S.Feedback $error={feedback.error} role={feedback.error ? "alert" : "status"}>{feedback.message}</S.Feedback>}
    </S.Content>
  </S.ReportModal>;
}
