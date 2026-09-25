import "server-only";

import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;
const MAX_BYTES = 2 * 1024 * 1024;
export const CHURCH_LOGO_BUCKET = "church-logos";
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const PRIVATE_PATH = new RegExp(`^church-logos/(${UUID})/(${UUID}\\.(?:png|jpg|webp))$`, "i");

const LOGO_TYPES = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
} as const;

function hasImageSignature(bytes: Uint8Array, type: string) {
  if (type === "image/png") {
    return bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10]
      .every((value, index) => bytes[index] === value);
  }
  if (type === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (type === "image/webp") {
    return bytes.length >= 12 && Buffer.from(bytes.slice(0, 4)).toString("ascii") === "RIFF"
      && Buffer.from(bytes.slice(8, 12)).toString("ascii") === "WEBP";
  }
  return false;
}

function dataUri(bytes: Uint8Array, mimeType: string) {
  return `data:${mimeType};base64,${Buffer.from(bytes).toString("base64")}`;
}

export async function validateChurchLogoFile(file: File): Promise<{ bytes: Uint8Array; mimeType: string; extension: string } | null> {
  if (!file.size || file.size > MAX_BYTES || !(file.type in LOGO_TYPES)) return null;
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!hasImageSignature(bytes, file.type)) return null;
  return { bytes, mimeType: file.type, extension: LOGO_TYPES[file.type as keyof typeof LOGO_TYPES] };
}

export async function loadChurchLogoDataUri(value: string | null, churchId: string, client: Client): Promise<string | null> {
  if (!value) return null;
  const privateMatch = PRIVATE_PATH.exec(value);
  if (privateMatch) {
    if (privateMatch[1].toLowerCase() !== churchId.toLowerCase()) return null;
    const objectPath = `${privateMatch[1]}/${privateMatch[2]}`;
    try {
      const { data, error } = await client.storage.from(CHURCH_LOGO_BUCKET).download(objectPath);
      if (error || !data || data.size > MAX_BYTES) return null;
      const mimeType = privateMatch[2].endsWith(".png") ? "image/png" : privateMatch[2].endsWith(".jpg") ? "image/jpeg" : "image/webp";
      const bytes = new Uint8Array(await data.arrayBuffer());
      return hasImageSignature(bytes, mimeType) ? dataUri(bytes, mimeType) : null;
    } catch { return null; }
  }
  const inline = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(value);
  if (inline) {
    if (value.length > MAX_BYTES * 1.4) return null;
    const bytes = Buffer.from(inline[2], "base64");
    return bytes.length <= MAX_BYTES && hasImageSignature(bytes, inline[1]) ? dataUri(bytes, inline[1]) : null;
  }
  let url: URL;
  try { url = new URL(value); } catch { return null; }
  let supabaseHost: string;
  try { supabaseHost = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").host; } catch { return null; }
  if (url.protocol !== "https:" || url.host !== supabaseHost || !url.pathname.startsWith("/storage/v1/object/public/")) return null;
  try {
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(4_000) });
    const mimeType = response.headers.get("content-type")?.split(";")[0] ?? "";
    const length = Number(response.headers.get("content-length") ?? "0");
    if (!response.ok || !(mimeType in LOGO_TYPES) || length > MAX_BYTES) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    return bytes.length <= MAX_BYTES && hasImageSignature(bytes, mimeType) ? dataUri(bytes, mimeType) : null;
  } catch { return null; }
}
