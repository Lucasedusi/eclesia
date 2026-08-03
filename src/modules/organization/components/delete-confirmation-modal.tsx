"use client";

import { useState } from "react";
import { Power, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import {
  archiveCongregationAction,
  archivePositionAction,
  archiveRegionAction,
  changeCongregationStatusAction,
} from "../actions/organization.actions";
import type { OrganizationActionState } from "../types/organization.types";
import * as S from "./organization.styles";

type DeleteKind = "region" | "congregation" | "position";

type DeleteConfirmationModalProps = {
  kind: DeleteKind;
  id: string;
  name: string;
  onClose: () => void;
  onResult: (result: OrganizationActionState) => void;
};

const labels = {
  region: {
    entity: "Regional",
    consequence: "A exclusão só será permitida se não houver Congregações vinculadas.",
  },
  congregation: {
    entity: "Congregação",
    consequence: "A exclusão só será permitida se não existirem usuários, membros ou registros históricos vinculados.",
  },
  position: {
    entity: "Cargo",
    consequence: "A exclusão só será permitida se o Cargo nunca tiver sido vinculado a um membro.",
  },
} as const;

export function DeleteConfirmationModal({
  kind,
  id,
  name,
  onClose,
  onResult,
}: DeleteConfirmationModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [offerInactivation, setOfferInactivation] = useState(false);
  const label = labels[kind];

  async function confirm() {
    if (loading) return;
    setLoading(true);
    setError("");
    const result = offerInactivation && kind === "congregation"
      ? await changeCongregationStatusAction({ id, status: "INACTIVE" })
      : kind === "region"
        ? await archiveRegionAction(id)
        : kind === "congregation"
          ? await archiveCongregationAction(id)
          : await archivePositionAction(id);
    setLoading(false);
    if (result.status === "error") {
      setError(result.message);
      if (kind === "congregation" && /dependência|vínculo/i.test(result.message)) {
        setOfferInactivation(true);
      }
    }
    onResult(result);
  }

  return (
    <Modal
      open
      title={`Excluir ${label.entity}?`}
      description={label.consequence}
      icon={<Trash2 size={22} />}
      onClose={onClose}
      busy={loading}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button variant={offerInactivation ? "primary" : "danger"} onClick={confirm} loading={loading}>
            {!loading && (offerInactivation ? <Power size={16} /> : <Trash2 size={16} />)}
            {loading ? (offerInactivation ? "Atualizando..." : "Excluindo...") : offerInactivation ? "Inativar Congregação" : `Excluir ${label.entity}`}
          </Button>
        </>
      }
    >
      <S.FormIntro>
        Você está prestes a excluir <S.DeleteName>{name}</S.DeleteName>. O registro deixará de aparecer nas listagens, mas o histórico será preservado.
      </S.FormIntro>
      {error && <S.FormAlert role="alert" style={{ marginTop: 12 }}>{error}</S.FormAlert>}
    </Modal>
  );
}
