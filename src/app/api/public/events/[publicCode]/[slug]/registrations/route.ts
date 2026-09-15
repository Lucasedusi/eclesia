import { createHash, randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import {
  consumePublicRegistrationRateLimit,
  consumePublicMemberLinkRateLimit,
  getPublicEvent,
} from "@/modules/events/services/event.service";
import { hasPublicCheckoutReplay, startPublicCheckout } from "@/modules/events/services/event-public-checkout.service";
import { publicRegistrationSchema } from "@/modules/events/validations/event.schemas";

const MAX_BODY_SIZE = 64 * 1024;

export async function POST(request: NextRequest, context: { params: Promise<{ publicCode: string; slug: string }> }) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ message: "Origem não permitida." }, { status: 403 });
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_SIZE) return NextResponse.json({ message: "Solicitação muito grande." }, { status: 413 });
  const { publicCode, slug } = await context.params;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_SIZE) return NextResponse.json({ message: "Solicitação muito grande." }, { status: 413 });
    const payload = JSON.parse(raw) as Record<string, unknown>;
    if (typeof payload.website === "string" && payload.website.trim()) return NextResponse.json({ message: "Inscrição recebida." }, { status: 201 });
    const parsed = publicRegistrationSchema.safeParse(payload);
    if (!parsed.success) return NextResponse.json({ message: "Revise os dados informados.", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 });
    const publicEvent = await getPublicEvent(publicCode, slug);
    if (!publicEvent || publicEvent.event.id !== parsed.data.eventId) return NextResponse.json({ message: "Evento indisponível." }, { status: 404 });
    const requestedKey = request.headers.get("idempotency-key");
    const idempotencyKey = requestedKey && /^[a-zA-Z0-9:_-]{16,120}$/.test(requestedKey) ? requestedKey : randomUUID();
    const replay = await hasPublicCheckoutReplay(publicEvent.event.id, publicEvent.event.churchId, idempotencyKey);
    if (!replay) {
      const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
      const fingerprint = createHash("sha256").update(`${forwarded}|${request.headers.get("user-agent") ?? "unknown"}|${publicEvent.event.id}`).digest("hex");
      if (!await consumePublicRegistrationRateLimit(publicEvent.event.id, fingerprint)) return NextResponse.json({ message: "Muitas tentativas. Aguarde alguns minutos." }, { status: 429, headers: { "Retry-After": "900" } });
      if (parsed.data.participantKind === "MEMBER" && !await consumePublicMemberLinkRateLimit(publicEvent.event.id, parsed.data.memberCpf)) return NextResponse.json({ message: "Muitas tentativas para confirmar este cadastro. Aguarde alguns minutos." }, { status: 429, headers: { "Retry-After": "900" } });
    }
    const data = await startPublicCheckout(publicCode, slug, parsed.data, idempotencyKey);
    return NextResponse.json({ message: "Inscrição iniciada.", data }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível concluir a inscrição.";
    return NextResponse.json({ message }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
}
