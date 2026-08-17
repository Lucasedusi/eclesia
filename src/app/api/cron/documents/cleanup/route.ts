import { NextResponse } from "next/server";
import { cleanupStaleAdministrativeUploads } from "@/modules/documents/services/document.service";

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Cron não configurado." }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const result = await cleanupStaleAdministrativeUploads();
    return NextResponse.json(result);
  } catch (error) {
    console.error("[administrative-documents] scheduled cleanup failed", {
      message: error instanceof Error ? error.message : "UNKNOWN_ERROR",
    });
    return NextResponse.json({ error: "Falha na manutenção agendada." }, { status: 500 });
  }
}
