"use client";

import { useId, useRef, useState } from "react";
import { Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RegionReportOptions } from "../types/region-report.types";
import * as S from "./region-report.styles";

type Props = {
  regions: { id: string; name: string }[];
  initialRegion?: { id: string; name: string };
  filters: { search: string; status: string; sort: string };
  onClose: () => void;
};
type Status = "ALL" | "ACTIVE" | "INACTIVE";
const validStatus = (value: string): Status => value === "ACTIVE" || value === "INACTIVE" ? value : "ALL";

export function RegionReportModal({ regions, initialRegion, filters, onClose }: Props) {
  const id = useId();
  const [kind, setKind] = useState<"simplified" | "individual">(initialRegion ? "individual" : "simplified");
  const [regionId, setRegionId] = useState(initialRegion?.id ?? "");
  const [format, setFormat] = useState<"pdf" | "xlsx">("pdf");
  const [useFilters, setUseFilters] = useState(false);
  const [status, setStatus] = useState<Status>("ALL");
  const [congregationStatus, setCongregationStatus] = useState<Status>("ALL");
  const [busy, setBusy] = useState(false);
  const downloading = useRef(false);
  const [feedback, setFeedback] = useState<{ error: boolean; message: string } | null>(null);
  const options = initialRegion && !regions.some((r) => r.id === initialRegion.id) ? [initialRegion, ...regions] : regions;

  async function download() {
    if (downloading.current || (kind === "individual" && !regionId)) return;
    downloading.current = true; setBusy(true); setFeedback(null);
    const input: RegionReportOptions = kind === "individual"
      ? { kind, format: "pdf", regionId, congregationStatus }
      : { kind, format, search: useFilters ? filters.search : "", status, sort: useFilters && (filters.sort === "NAME" || filters.sort === "CREATED") ? filters.sort : "ORDER" };
    try {
      const response = await fetch("/api/organization/regions/reports", { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { message?: unknown } | null;
        throw new Error(typeof payload?.message === "string" ? payload.message : "Não foi possível baixar o relatório. Tente novamente.");
      }
      const expectedType = input.format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      if (!response.headers.get("Content-Type")?.includes(expectedType)) throw new Error("Entre novamente e tente gerar o relatório.");
      const url = URL.createObjectURL(await response.blob());
      try {
        const anchor = document.createElement("a"); anchor.href = url;
        anchor.download = /filename="([A-Za-z0-9_-]+\.(?:pdf|xlsx))"/.exec(response.headers.get("Content-Disposition") ?? "")?.[1] ?? `relatorio-regionais.${input.format}`;
        document.body.appendChild(anchor); anchor.click(); anchor.remove();
      } finally { window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
      setFeedback({ error: false, message: "Relatório pronto. O download foi iniciado." });
    } catch (error) {
      setFeedback({ error: true, message: error instanceof Error ? error.message : "Não foi possível gerar o relatório agora. Tente novamente." });
    } finally { downloading.current = false; setBusy(false); }
  }

  const selectedFormat = kind === "individual" ? "pdf" : format;
  return (
    <S.ReportModal $stableHeight={!initialRegion} open title={initialRegion ? "Ficha da regional em PDF" : "Relatórios de regionais"} description={initialRegion?.name ?? "Escolha o relatório e o formato do arquivo."} icon={<FileText />} size="md" onClose={onClose} busy={busy}
      footer={<S.Footer>{initialRegion && <Button variant="outline" onClick={onClose} disabled={busy}>Voltar aos detalhes</Button>}<Button onClick={() => void download()} loading={busy} disabled={busy || (kind === "individual" && !regionId)}><Download size={16} />{busy ? "Gerando relatório…" : selectedFormat === "pdf" ? "Baixar PDF" : "Baixar Excel"}</Button></S.Footer>}
    >
      <S.Content aria-busy={busy}>
        {!initialRegion && <S.Options disabled={busy}><legend>Tipo de relatório</legend>
          <S.Choice $selected={kind === "simplified"}><input type="radio" name={`${id}-kind`} checked={kind === "simplified"} onChange={() => { setKind("simplified"); setFeedback(null); }} /><span><strong>Lista simplificada</strong><small>Nome da regional, coordenador e telefone do coordenador.</small></span></S.Choice>
          <S.Choice $selected={kind === "individual"}><input type="radio" name={`${id}-kind`} checked={kind === "individual"} onChange={() => { setKind("individual"); setFeedback(null); }} /><span><strong>Ficha da regional</strong><small>Dados da regional e lista de congregações, dirigentes e contatos.</small></span></S.Choice>
        </S.Options>}
        <S.Options disabled={busy}>
          {kind === "simplified" ? <>
            <S.Field>Abrangência<S.SelectBox><S.SelectControl value={useFilters ? "FILTERED" : "ALL"} onChange={(e) => { const filtered = e.target.value === "FILTERED"; setUseFilters(filtered); setStatus(filtered ? validStatus(filters.status) : "ALL"); }}><option value="ALL">Todas as regionais</option><option value="FILTERED">Resultados filtrados na tela</option></S.SelectControl></S.SelectBox></S.Field>
            {useFilters && <S.Hint>{filters.search ? `Busca: ${filters.search}. ` : ""}Inclui todas as páginas dos resultados.</S.Hint>}
            <S.Field>Situação das regionais<S.SelectBox><S.SelectControl value={status} onChange={(e) => setStatus(validStatus(e.target.value))}><option value="ALL">Ativas e inativas</option><option value="ACTIVE">Somente ativas</option><option value="INACTIVE">Somente inativas</option></S.SelectControl></S.SelectBox></S.Field>
            <S.Field>Formato<S.SelectBox><S.SelectControl value={format} onChange={(e) => setFormat(e.target.value === "xlsx" ? "xlsx" : "pdf")}><option value="pdf">PDF · pronto para impressão</option><option value="xlsx">Excel · planilha .xlsx</option></S.SelectControl></S.SelectBox></S.Field>
          </> : <>
            {!initialRegion && <S.Field>Regional<S.SelectBox><S.SelectControl value={regionId} onChange={(e) => setRegionId(e.target.value)}><option value="">Selecione uma regional</option>{options.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</S.SelectControl></S.SelectBox></S.Field>}
            <S.Field>Situação das congregações<S.SelectBox><S.SelectControl value={congregationStatus} onChange={(e) => setCongregationStatus(validStatus(e.target.value))}><option value="ALL">Ativas e inativas</option><option value="ACTIVE">Somente ativas</option><option value="INACTIVE">Somente inativas</option></S.SelectControl></S.SelectBox></S.Field>
          </>}
        </S.Options>
        {feedback && <S.Feedback $error={feedback.error} role={feedback.error ? "alert" : "status"}>{feedback.message}</S.Feedback>}
      </S.Content>
    </S.ReportModal>
  );
}
