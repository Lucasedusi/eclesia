"use client";

import { type CSSProperties, useEffect, useState } from "react";
import { Download, IdCard, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { getMemberCredentialPreviewAction } from "../actions/member-credential.actions";
import { FAKE_QR_PATTERN } from "../services/member-credential.logic";
import type { MemberCredentialPreview } from "../types/member-credential.types";
import {
  credentialDownloadUrl,
  credentialWarningLabel,
} from "../utils/member-credential-view";
import * as S from "./member-credential.styles";

type CredentialModalState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; preview: MemberCredentialPreview };

type Props = { memberId: string; onClose: () => void };

function FaceHeader({ preview }: { preview: MemberCredentialPreview }) {
  return (
    <S.Header>
      <span>{preview.church.name}</span>
    </S.Header>
  );
}

function Front({ preview }: { preview: MemberCredentialPreview }) {
  return (
    <S.FaceGroup aria-label="Frente da credencial">
      <h3>Frente</h3>
      <S.Card>
        <FaceHeader preview={preview} />
        <S.FrontBody>
          <S.Identity>
            <S.MemberName>{preview.member.fullName}</S.MemberName>
            <S.Role>{preview.member.roleName}</S.Role>
            <S.CompactFields>
              <S.Field>
                <dt>Matrícula</dt>
                <dd>{preview.member.memberCode}</dd>
              </S.Field>
              <S.Field>
                <dt>Congregação</dt>
                <dd>{preview.member.congregationName}</dd>
              </S.Field>
            </S.CompactFields>
          </S.Identity>
          <S.QrArea>
            <S.QrGrid aria-hidden="true">
              {FAKE_QR_PATTERN.flatMap((row, rowIndex) =>
                row.map((filled, columnIndex) => (
                  <S.QrCell
                    key={`${rowIndex}-${columnIndex}`}
                    $filled={filled}
                  />
                )),
              )}
            </S.QrGrid>
            <small>VALIDAÇÃO EM BREVE</small>
          </S.QrArea>
        </S.FrontBody>
      </S.Card>
    </S.FaceGroup>
  );
}

function Back({ preview }: { preview: MemberCredentialPreview }) {
  return (
    <S.FaceGroup aria-label="Verso da credencial">
      <h3>Verso</h3>
      <S.Card>
        <FaceHeader preview={preview} />
        <S.BackBody>
          <div>
            <dt>Data do batismo</dt>
            <dd>{preview.member.baptismDate}</dd>
          </div>
          <div>
            <dt>Nome da mãe</dt>
            <dd>{preview.member.motherName}</dd>
          </div>
          <div>
            <dt>Nome do pai</dt>
            <dd>{preview.member.fatherName}</dd>
          </div>
        </S.BackBody>
        <S.Footnote>Documento de identificação eclesiástica</S.Footnote>
      </S.Card>
    </S.FaceGroup>
  );
}

export function MemberCredentialModal({ memberId, onClose }: Props) {
  const [state, setState] = useState<CredentialModalState>({ status: "loading" });
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");

  useEffect(() => {
    let active = true;
    void getMemberCredentialPreviewAction(memberId).then((result) => {
      if (!active) return;
      setState(
        result.success
          ? { status: "ready", preview: result.data }
          : { status: "error", message: result.message },
      );
    });
    return () => {
      active = false;
    };
  }, [memberId]);

  async function download(preview: MemberCredentialPreview) {
    setDownloading(true);
    setDownloadError("");
    try {
      const response = await fetch(credentialDownloadUrl(memberId), {
        method: "GET",
        cache: "no-store",
        credentials: "same-origin",
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
      anchor.download = preview.fileName;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (error) {
      setDownloadError(
        error instanceof Error
          ? error.message
          : "Não foi possível baixar a credencial.",
      );
    } finally {
      setDownloading(false);
    }
  }

  const preview = state.status === "ready" ? state.preview : null;
  const cardStyle = preview
    ? ({
        "--credential-primary": preview.church.primaryColor,
        "--credential-dark": preview.church.primaryDarkColor,
        "--credential-foreground": preview.church.foregroundColor,
      } as CSSProperties)
    : undefined;

  return (
    <Modal
      open
      title="Gerar credencial de membro"
      description="Confira frente e verso antes de baixar o PDF para impressão."
      icon={<IdCard />}
      size="xl"
      onClose={onClose}
      busy={downloading}
      footer={
        <S.FooterActions>
          <Button variant="ghost" onClick={onClose} disabled={downloading}>
            Cancelar
          </Button>
          {preview && (
            <Button
              onClick={() => void download(preview)}
              loading={downloading}
            >
              <Download size={16} /> Baixar PDF
            </Button>
          )}
        </S.FooterActions>
      }
    >
      <S.Content style={cardStyle}>
        {state.status === "loading" && (
          <S.Loading role="status" aria-live="polite">
            <Loader2 aria-hidden="true" />
            <span>Preparando a credencial...</span>
          </S.Loading>
        )}
        {state.status === "error" && (
          <S.ErrorNotice role="alert">{state.message}</S.ErrorNotice>
        )}
        {preview && (
          <>
            <S.PreviewGrid>
              <Front preview={preview} />
              <Back preview={preview} />
            </S.PreviewGrid>
            {preview.warnings.length > 0 && (
              <S.Warnings>
                <h3>Informações exibidas com fallback</h3>
                <ul>
                  {preview.warnings.map((warning) => (
                    <li key={warning}>{credentialWarningLabel(warning)}</li>
                  ))}
                </ul>
              </S.Warnings>
            )}
          </>
        )}
        {downloadError && (
          <S.ErrorNotice role="alert" aria-live="assertive">
            {downloadError}
          </S.ErrorNotice>
        )}
      </S.Content>
    </Modal>
  );
}
