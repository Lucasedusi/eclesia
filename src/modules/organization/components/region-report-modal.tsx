"use client";

import { useId, useState } from "react";
import { Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RegionReportOptions } from "../types/region-report.types";
import { useRegionReport } from "../hooks/use-region-report";
import * as S from "./region-report.styles";

type Props = {
  regions: { id: string; name: string }[];
  filters: { search: string; status: string; sort: string };
  onClose: () => void;
};
type Status = "ALL" | "ACTIVE" | "INACTIVE";
const validStatus = (value: string): Status => value === "ACTIVE" || value === "INACTIVE" ? value : "ALL";

export function RegionReportModal({ regions, filters, onClose }: Props) {
  const id = useId();
  const [kind, setKind] = useState<"simplified" | "individual">("simplified");
  const [regionId, setRegionId] = useState("");
  const [format, setFormat] = useState<"pdf" | "xlsx">("pdf");
  const [useFilters, setUseFilters] = useState(false);
  const { busy, feedback, download: downloadReport, setFeedback } = useRegionReport();

  async function download() {
    if (kind === "individual" && !regionId) return;
    const input: RegionReportOptions = kind === "individual"
      ? { kind, format: "pdf", regionId, congregationStatus: "ALL" }
      : { kind, format, search: useFilters ? filters.search : "", status: useFilters ? validStatus(filters.status) : "ALL", sort: useFilters && (filters.sort === "NAME" || filters.sort === "CREATED") ? filters.sort : "ORDER" };
    await downloadReport(input);
  }

  const selectedFormat = kind === "individual" ? "pdf" : format;
  return (
    <S.ReportModal $stableHeight open title="Relatórios de regionais" description="Escolha o relatório e o formato do arquivo." icon={<FileText />} size="md" onClose={onClose} busy={busy}
      footer={<S.Footer><Button onClick={() => void download()} loading={busy} disabled={busy || (kind === "individual" && !regionId)}><Download size={16} />{busy ? "Gerando relatório…" : selectedFormat === "pdf" ? "Baixar PDF" : "Baixar Excel"}</Button></S.Footer>}
    >
      <S.Content aria-busy={busy}>
        <S.Options disabled={busy}><legend>Tipo de relatório</legend>
          <S.Choice $selected={kind === "simplified"}><input type="radio" name={`${id}-kind`} checked={kind === "simplified"} onChange={() => { setKind("simplified"); setFeedback(null); }} /><span><strong>Lista simplificada</strong><small>Nome da regional, coordenador e telefone do coordenador.</small></span></S.Choice>
          <S.Choice $selected={kind === "individual"}><input type="radio" name={`${id}-kind`} checked={kind === "individual"} onChange={() => { setKind("individual"); setFeedback(null); }} /><span><strong>Ficha da regional</strong><small>Dados da regional e lista de congregações, dirigentes e contatos.</small></span></S.Choice>
        </S.Options>
        <S.Options disabled={busy}>
          {kind === "simplified" ? <>
            <S.Field>Filtros<S.SelectBox><S.SelectControl value={useFilters ? "FILTERED" : "ALL"} onChange={(e) => setUseFilters(e.target.value === "FILTERED")}><option value="ALL">Todas as regionais</option><option value="FILTERED">Resultados filtrados na tela</option></S.SelectControl></S.SelectBox></S.Field>
            {useFilters && <S.Hint>{filters.search ? `Busca: ${filters.search}. ` : ""}Inclui todas as páginas dos resultados.</S.Hint>}
            <S.Field>Formato<S.SelectBox><S.SelectControl value={format} onChange={(e) => setFormat(e.target.value === "xlsx" ? "xlsx" : "pdf")}><option value="pdf">PDF · pronto para impressão</option><option value="xlsx">Excel · planilha .xlsx</option></S.SelectControl></S.SelectBox></S.Field>
          </> : <>
            <S.Field>Regional<S.SelectBox><S.SelectControl value={regionId} onChange={(e) => setRegionId(e.target.value)}><option value="">Selecione uma regional</option>{regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</S.SelectControl></S.SelectBox></S.Field>
          </>}
        </S.Options>
        {feedback && <S.Feedback $error={feedback.error} role={feedback.error ? "alert" : "status"}>{feedback.message}</S.Feedback>}
      </S.Content>
    </S.ReportModal>
  );
}
