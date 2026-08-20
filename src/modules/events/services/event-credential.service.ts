import "server-only";

import { createHash, createHmac } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

function credentialSecret() {
  const secret = process.env.EVENT_CREDENTIAL_SECRET?.trim();
  if (!secret || secret.length < 32) throw new Error("EVENT_CREDENTIAL_SECRET_MISSING");
  return secret;
}

export function createEventCredentialToken(registrationId: string, credentialVersion: number) {
  const signature = createHmac("sha256", credentialSecret())
    .update(`event-credential:${registrationId}:${credentialVersion}`)
    .digest("base64url")
    .slice(0, 42);
  return `ek1_${signature}`;
}

export async function ensureEventCredential(registration: { id: string; credentialVersion: number; status: string }) {
  if (registration.status !== "CONFIRMED") return null;
  const token = createEventCredentialToken(registration.id, registration.credentialVersion);
  const hash = createHash("sha256").update(token).digest("hex");
  const admin = createAdminClient();
  const { error } = await admin.from("event_registrations").update({
    qr_token_hash: hash,
    qr_token_last4: token.slice(-4),
    updated_at: new Date().toISOString(),
  }).eq("id", registration.id).eq("status", "CONFIRMED");
  if (error) throw new Error("EVENT_CREDENTIAL_PERSIST_FAILED");
  return token;
}
