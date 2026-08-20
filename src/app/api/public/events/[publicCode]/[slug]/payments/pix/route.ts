import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createPublicPixPayment } from "@/modules/events/services/event-public-checkout.service";
import { publicPixPaymentSchema } from "@/modules/events/validations/event.schemas";

export async function POST(request: NextRequest, context: { params: Promise<{ publicCode: string; slug: string }> }) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ message: "Origem não permitida." }, { status: 403 });
  const { publicCode, slug } = await context.params;
  try {
    const parsed = publicPixPaymentSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ message: "Revise o e-mail e o CPF.", fieldErrors: parsed.error.flatten().fieldErrors }, { status: 400 });
    const requestedKey = request.headers.get("idempotency-key");
    const idempotencyKey = requestedKey && /^[a-zA-Z0-9:_-]{16,120}$/.test(requestedKey) ? requestedKey : randomUUID();
    const data = await createPublicPixPayment({ publicCode, slug, ...parsed.data, idempotencyKey });
    return NextResponse.json({ message: "Pix gerado com segurança.", data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível gerar o Pix.";
    return NextResponse.json({ message }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
}
