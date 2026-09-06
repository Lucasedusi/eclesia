import { NextResponse, type NextRequest } from "next/server";
import { getPublicTrackingStatus } from "@/modules/events/services/event-public-checkout.service";
import { publicTrackingSchema } from "@/modules/events/validations/event.schemas";

export async function POST(request: NextRequest, context: { params: Promise<{ publicCode: string; slug: string }> }) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ message: "Origem não permitida." }, { status: 403 });
  const { publicCode, slug } = await context.params;
  try {
    const parsed = publicTrackingSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ message: "Link de acompanhamento inválido." }, { status: 400, headers: { "cache-control": "no-store" } });
    const data = await getPublicTrackingStatus(publicCode, slug, parsed.data.token, parsed.data.refreshProvider);
    return NextResponse.json({ data }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Não foi possível acompanhar esta inscrição." }, { status: 400, headers: { "cache-control": "private, no-store" } });
  }
}
