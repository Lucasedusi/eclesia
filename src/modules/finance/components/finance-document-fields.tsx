"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import {
  prepareFinanceDocumentAction,
  finalizeFinanceDocumentAction,
  discardFinanceDocumentAction,
} from "../actions/finance-document.actions";
import {
  FINANCE_DOCUMENT_BUCKET,
  validateFinanceUpload,
} from "../utils/finance-documents";
import type { PreparedFinanceDocument } from "../types/finance-document.types";
export type AttachedDocument = { id: string; name: string };
type PendingUpload = { file: File; prepared: PreparedFinanceDocument };
export function FinanceDocumentFields({
  unit,
  value,
  onChange,
  onBusy,
}: {
  unit: string;
  value: AttachedDocument[];
  onChange: (files: AttachedDocument[]) => void;
  onBusy: (busy: boolean) => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [pending, setPending] = useState<PendingUpload | null>(null);
  async function upload(file: File, retry?: PendingUpload) {
    if (busy) return;
    setBusy(true);
    onBusy(true);
    setError("");
    try {
      const valid = validateFinanceUpload({
        name: file.name,
        type: file.type,
        size: file.size,
      });
      let prepared = retry?.prepared;
      if (!prepared) {
        const result = await prepareFinanceDocumentAction(unit, {
          name: valid.name,
          type: valid.type,
          size: valid.size,
        });
        if (!result.ok) {
          setError(result.message);
          return;
        }
        prepared = result.data;
        setPending({ file, prepared });
      }
      // A lost upload or finalization response may still have stored the object.
      if (retry) {
        const ready = await finalizeFinanceDocumentAction(
          unit,
          prepared.uploadId,
        );
        if (ready.ok) {
          onChange([...value, { id: ready.data.documentId, name: valid.name }]);
          setPending(null);
          return;
        }
      }
      await createClient()
        .storage.from(FINANCE_DOCUMENT_BUCKET)
        .uploadToSignedUrl(prepared.path, prepared.token, file, {
          contentType: valid.type,
        });
      const ready = await finalizeFinanceDocumentAction(
        unit,
        prepared.uploadId,
      );
      if (!ready.ok) {
        setError(ready.message);
        return;
      }
      onChange([...value, { id: ready.data.documentId, name: valid.name }]);
      setPending(null);
    } catch {
      setError(
        "Não foi possível concluir o anexo. Confira se é PDF, JPG ou PNG de até 10 MB e tente novamente.",
      );
    } finally {
      setBusy(false);
      onBusy(false);
    }
  }
  async function remove(id: string) {
    setBusy(true);
    onBusy(true);
    setError("");
    try {
      const result = await discardFinanceDocumentAction(unit, id);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      if (pending?.prepared.uploadId === id) setPending(null);
      else onChange(value.filter((v) => v.id !== id));
    } catch {
      setError("Não foi possível remover o anexo.");
    } finally {
      setBusy(false);
      onBusy(false);
    }
  }
  return (
    <div className="stack">
      <label>
        Anexos (PDF, JPG ou PNG · até 10 MB)
        <input
          type="file"
          accept="application/pdf,image/jpeg,image/png"
          disabled={busy || Boolean(pending) || value.length >= 10}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void upload(file);
          }}
        />
      </label>
      {busy && <p role="status">Enviando e verificando o anexo…</p>}
      {error && <div role="alert">{error}</div>}
      {pending && !busy && (
        <div className="row">
          <span>{pending.file.name} · envio não confirmado</span>
          <Button
            variant="outline"
            onClick={() => void upload(pending.file, pending)}
          >
            Tentar novamente
          </Button>
          <Button
            variant="outline"
            onClick={() => void remove(pending.prepared.uploadId)}
          >
            Descartar anexo
          </Button>
        </div>
      )}
      {value.map((file) => (
        <div key={file.id} className="row">
          <span className="muted">{file.name}</span>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => void remove(file.id)}
          >
            Remover
          </Button>
        </div>
      ))}
    </div>
  );
}
