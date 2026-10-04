"use client";
import { useEffect, useRef, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
export function FinanceCredentialReader({
  onRead,
  onClose,
}: {
  onRead: (value: string) => void;
  onClose: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let stopped = false,
      stream: MediaStream | undefined,
      timer: ReturnType<typeof setTimeout> | undefined;
    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia)
          throw new Error("Camera unavailable");
        const decoder = (await import("jsqr")).default;
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 640 },
          },
          audio: false,
        });
        if (stopped) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (!video.current) return;
        video.current.srcObject = stream;
        await video.current.play();
        const canvas = document.createElement("canvas"),
          ctx = canvas.getContext("2d", { willReadFrequently: true });
        const scan = () => {
          if (stopped || !video.current || !ctx) return;
          const v = video.current;
          if (v.readyState >= 2 && v.videoWidth) {
            canvas.width = Math.min(v.videoWidth, 640);
            canvas.height = Math.round(
              (v.videoHeight * canvas.width) / v.videoWidth,
            );
            ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
            const frame = ctx.getImageData(0, 0, canvas.width, canvas.height),
              code = decoder(frame.data, frame.width, frame.height);
            if (code) {
              stopped = true;
              stream?.getTracks().forEach((t) => t.stop());
              onRead(code.data);
              return;
            }
          }
          timer = setTimeout(scan, 180);
        };
        scan();
      } catch {
        if (!stopped)
          setError(
            "Não foi possível acessar a câmera. Use a busca por nome, CPF ou matrícula.",
          );
        stream?.getTracks().forEach((t) => t.stop());
      }
    }
    void start();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onRead]);
  return (
    <Modal
      title="Ler credencial"
      onClose={onClose}
      footer={
        <Button variant="outline" onClick={onClose}>
          Usar busca manual
        </Button>
      }
    >
      <div className="stack">
        {error ? (
          <p role="alert">{error}</p>
        ) : (
          <>
            <video
              ref={video}
              playsInline
              muted
              aria-label="Câmera para leitura da credencial"
              style={{ width: "100%", borderRadius: 12, background: "#0B3D32" }}
            />
            <p className="muted">
              Aponte para o QR da credencial. A leitura apenas identifica a
              pessoa.
            </p>
          </>
        )}
      </div>
    </Modal>
  );
}
