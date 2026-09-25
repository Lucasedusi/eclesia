"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, IdCard, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { getMemberCredentialPreviewAction } from "../actions/member-credential.actions";
import { renderMemberCredentialSvg } from "../services/member-credential-svg.service";
import type { MemberCredentialPreview } from "../types/member-credential.types";
import type { MemberCredentialPdfFormat } from "../types/member-credential.types";
import {
  type CredentialPreviewState,
  type CredentialSide,
  credentialDownloadUrl,
  credentialPdfFileName,
  credentialFlipView,
  credentialWarningLabel,
  resolveCredentialPreviewState,
} from "../utils/member-credential-view";
import * as S from "./member-credential.styles";
import { MemberCredentialSkeleton } from "./member-credential-skeleton";

type Props = { memberId: string; onClose: () => void };

function CredentialFlipper({ preview }: { preview: MemberCredentialPreview }) {
  const [side, setSide] = useState<CredentialSide>("front");
  const frontSvg = useMemo(
    () => renderMemberCredentialSvg(preview, "front"),
    [preview],
  );
  const backSvg = useMemo(
    () => renderMemberCredentialSvg(preview, "back"),
    [preview],
  );
  const flipView = credentialFlipView(side);

  return (
    <S.PreviewStage>
      <S.FlipButton
        type="button"
        aria-label={flipView.buttonLabel}
        onClick={() =>
          setSide((currentSide) => credentialFlipView(currentSide).nextSide)
        }
      >
        <S.FlipCard $flipped={side === "back"}>
          <S.CardFace
            aria-hidden={side !== "front"}
            dangerouslySetInnerHTML={{ __html: frontSvg }}
          />
          <S.CardFace
            $back
            aria-hidden={side !== "back"}
            dangerouslySetInnerHTML={{ __html: backSvg }}
          />
        </S.FlipCard>
      </S.FlipButton>
      <S.FlipHint aria-live="polite">
        <RefreshCw aria-hidden="true" />
        <span>{flipView.hint}</span>
      </S.FlipHint>
    </S.PreviewStage>
  );
}

export function MemberCredentialModal({ memberId, onClose }: Props) {
  const [state, setState] = useState<CredentialPreviewState>({
    status: "loading",
  });
  const [downloading, setDownloading] =
    useState<MemberCredentialPdfFormat | null>(null);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    let active = true;
    void resolveCredentialPreviewState(
      getMemberCredentialPreviewAction(memberId),
    ).then((nextState) => {
      if (!active) return;
      setState(nextState);
    });
    return () => {
      active = false;
    };
  }, [memberId]);

  async function download(
    preview: MemberCredentialPreview,
    format: MemberCredentialPdfFormat,
  ) {
    setDownloading(format);
    setFeedback("");
    try {
      const response = await fetch(credentialDownloadUrl(memberId), {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: preview.validation.token, format }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(
          payload?.message ?? "Não foi possível baixar a credencial.",
        );
      }
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = credentialPdfFileName(preview.fileName, format);
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      setFeedback("Credencial emitida com validação pública ativa.");
    } catch (error) {
      setFeedback(
        error instanceof Error
          ? error.message
          : "Não foi possível baixar a credencial.",
      );
    } finally {
      setDownloading(null);
    }
  }

  const preview = state.status === "ready" ? state.preview : null;

  return (
    <Modal
      open
      title="Gerar credencial de membro"
      description="Clique na carteirinha para alternar entre frente e verso."
      icon={<IdCard />}
      size="md"
      onClose={onClose}
      busy={downloading !== null}
      footer={
        <S.FooterActions>
          {preview && (
            <>
              <Button
                variant="outline"
                onClick={() => void download(preview, "pvc")}
                loading={downloading === "pvc"}
                disabled={downloading !== null}
              >
                <Download size={16} /> PDF para gráfica/PVC
              </Button>
              <Button
                onClick={() => void download(preview, "fold")}
                loading={downloading === "fold"}
                disabled={downloading !== null}
              >
                <Download size={16} /> Imprimir e dobrar (A4)
              </Button>
            </>
          )}
        </S.FooterActions>
      }
    >
      <S.Content>
        {state.status === "loading" && <MemberCredentialSkeleton />}
        {state.status === "error" && (
          <S.ErrorNotice role="alert">{state.message}</S.ErrorNotice>
        )}
        {preview && (
          <>
            <CredentialFlipper key={memberId} preview={preview} />
            {preview.warnings.length > 0 && (
              <S.Warnings>
                <h3>informações Vazias</h3>
                <ul>
                  {preview.warnings.map((warning) => (
                    <li key={warning}>{credentialWarningLabel(warning)}</li>
                  ))}
                </ul>
              </S.Warnings>
            )}
          </>
        )}
        {feedback && (
          <S.Feedback role="status" aria-live="polite">
            {feedback}
          </S.Feedback>
        )}
      </S.Content>
    </Modal>
  );
}
