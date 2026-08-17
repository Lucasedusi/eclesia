import { NextResponse } from "next/server";

const ALLOWED_METRICS = new Set(["LCP", "INP", "CLS", "TTFB", "FCP", "FID"]);
const ALLOWED_RATINGS = new Set(["good", "needs-improvement", "poor"]);

export async function POST(request: Request) {
  const raw = await request.text();
  if (raw.length > 4_096) {
    return NextResponse.json({ error: "Payload inválido." }, { status: 413 });
  }

  let value: Record<string, unknown>;
  try {
    value = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  if (
    !ALLOWED_METRICS.has(String(value.name)) ||
    !ALLOWED_RATINGS.has(String(value.rating)) ||
    typeof value.value !== "number" ||
    !Number.isFinite(value.value) ||
    typeof value.route !== "string" ||
    !value.route.startsWith("/") ||
    value.route.length > 180
  ) {
    return NextResponse.json({ error: "Métrica inválida." }, { status: 400 });
  }

  console.info("[web-vitals]", {
    id: typeof value.id === "string" ? value.id.slice(0, 120) : undefined,
    name: value.name,
    value: Number(value.value.toFixed(3)),
    delta: typeof value.delta === "number" ? Number(value.delta.toFixed(3)) : undefined,
    rating: value.rating,
    navigationType: typeof value.navigationType === "string" ? value.navigationType : undefined,
    route: value.route,
    entryKind: value.entryKind,
  });

  return new NextResponse(null, { status: 204 });
}
