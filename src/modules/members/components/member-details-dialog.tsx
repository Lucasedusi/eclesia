"use client";

import { Activity, useEffect, useState } from "react";
import Link from "next/link";
import { FileText, IdCard, Pencil, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { getMemberDetailsAction } from "../actions/member.actions";
import type { MemberCapabilities, MemberFilters } from "../types/member.types";
import { DetailsModal, FooterActions } from "./member-details-dialog.styles";

export function prepareMemberDetails(memberId: string) {
  const ready = Promise.all([getMemberDetailsAction(memberId), import("./member-details-modal")])
    .then(([result, module]) => result.success
      ? { success: true as const, details: result.data, views: module }
      : { success: false as const, message: result.message })
    .catch(() => ({ success: false as const, message: "Não foi possível carregar a ficha. Tente novamente." }));
  return { memberId, ready };
}

type Selection = ReturnType<typeof prepareMemberDetails>;

export function MemberDetailsModal({ selection, capabilities, filters, onClose, onChanged }: {
  selection: Selection; capabilities: MemberCapabilities; filters: MemberFilters; onClose: () => void; onChanged: () => void;
}) {
  const [result, setResult] = useState<Awaited<Selection["ready"]> | null>(null);
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [credential, setCredential] = useState(false);

  useEffect(() => {
    let active = true;
    void selection.ready.then(value => { if (active) setResult(value); });
    return () => { active = false; };
  }, [selection]);

  const { memberId } = selection;
  const exportSheet = result?.success && capabilities.exportSheet && !result.details.archived;
  const footer = result?.success && (exportSheet || capabilities.issueCredential || capabilities.update) && (
    <FooterActions>
      {exportSheet && <Button variant="secondary" onClick={() => setSheet(true)}><FileText size={16} /> Baixar ficha em PDF</Button>}
      {capabilities.issueCredential && <Button variant="secondary" onClick={() => setCredential(true)}><IdCard size={16} /> Gerar credencial</Button>}
      {capabilities.update && <Link href={`/membros/${memberId}/editar`} className="app-button-primary"><Pencil size={16} /> Editar cadastro</Link>}
    </FooterActions>
  );

  return <>
    <Activity mode={sheet || credential ? "hidden" : "visible"}>
      <DetailsModal title="Ficha do membro" description="Consulta cadastral, eclesiástica, de eventos, financeira e documental."
        icon={<UserRound />} size="xl" onClose={onClose} busy={busy} footer={footer}>
        {!result ? <PageSkeleton variant="details" label="Carregando ficha do membro" /> : result.success
          ? <result.views.MemberDetailsContent initial={result.details} memberId={memberId} capabilities={capabilities} filters={filters}
              busy={busy} setBusy={setBusy} onClose={onClose} onChanged={onChanged} />
          : <p role="alert">{result.message}</p>}
      </DetailsModal>
    </Activity>
    {sheet && result?.success && <result.views.MemberSheetModal memberId={memberId} memberName={result.details.fullName}
      canHistory={capabilities.viewHistory} canEvents={capabilities.viewEvents} onClose={() => setSheet(false)} />}
    {credential && result?.success && <result.views.MemberCredentialModal memberId={memberId} onClose={() => setCredential(false)} />}
  </>;
}
