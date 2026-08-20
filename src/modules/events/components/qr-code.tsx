"use client";

import { useMemo } from "react";
import { qrSvg } from "../utils/qr-code";

export function QrCode({ value, size = 220 }: { value: string; size?: number }) {
  const markup = useMemo(() => qrSvg(value), [value]);
  return <div style={{ width: size, maxWidth: "100%", aspectRatio: "1", background: "#fff", padding: 8, borderRadius: 12 }} dangerouslySetInnerHTML={{ __html: markup }} />;
}
