import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import {
  EventReportError,
  generateEventFinancialReport,
  generateEventCaravanReport,
  generateEventGeneralReport,
  generateEventParticipantReport,
  generateEventReport,
  getEventGeneralReportPreview,
  getEventFinancialReportPreview,
  getEventParticipantReportPreview,
  getEventCaravanReportPreview,
  isEventReportType,
} from "@/modules/events/services/event-report.service";
import {
  eventFinancialReportRequestSchema,
  eventGeneralReportRequestSchema,
  eventIdSchema,
  eventParticipantReportRequestSchema,
  eventCaravanReportRequestSchema,
} from "@/modules/events/validations/event.schemas";

type ReportRouteContext = {
  params: Promise<{ eventId: string; report: string }>;
};

function errorResponse(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json({ message: error.issues[0]?.message ?? "Configuração de relatório inválida." }, { status: 400 });
  }
  if (error instanceof EventReportError) {
    return NextResponse.json({ message: error.message }, { status: 422 });
  }
  return NextResponse.json({ message: "Não foi possível processar o relatório." }, { status: 403 });
}

export async function GET(request: NextRequest, { params }: ReportRouteContext) {
  const { eventId, report } = await params;
  if (!isEventReportType(report)) return NextResponse.json({ message: "Relatório inválido." }, { status: 404 });
  const format = request.nextUrl.searchParams.get("format") === "csv" ? "csv" : "xlsx";
  try {
    eventIdSchema.parse(eventId);
    const output = await generateEventReport(eventId, report, format, request.nextUrl.searchParams.get("status") ?? undefined);
    return new NextResponse(new Uint8Array(output.body), {
      headers: {
        "content-type": output.contentType,
        "content-disposition": `attachment; filename="${output.fileName}"`,
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest, { params }: ReportRouteContext) {
  const { eventId, report } = await params;
  if (report !== "general" && report !== "participants" && report !== "financial" && report !== "caravans") return NextResponse.json({ message: "Relatório inválido." }, { status: 404 });
  try {
    eventIdSchema.parse(eventId);
    const requestBody: unknown = await request.json();
    if(report==="caravans"){
      const payload=eventCaravanReportRequestSchema.parse(requestBody);
      if(payload.mode==="preview"){const data=await getEventCaravanReportPreview(eventId,payload.config);return NextResponse.json({data},{headers:{"cache-control":"private, no-store"}});}
      const output=await generateEventCaravanReport(eventId,payload.config);return new NextResponse(new Uint8Array(output.body),{headers:{"content-type":output.contentType,"content-disposition":`${payload.disposition}; filename="${output.fileName}"`,"cache-control":"private, no-store","x-content-type-options":"nosniff"}});
    }
    if (report === "financial") {
      const payload = eventFinancialReportRequestSchema.parse(requestBody);
      if (payload.mode === "preview") {
        const data = await getEventFinancialReportPreview(eventId, payload.config);
        return NextResponse.json({ data }, { headers: { "cache-control": "private, no-store" } });
      }
      const output = await generateEventFinancialReport(eventId, payload.config);
      return new NextResponse(new Uint8Array(output.body), {
        headers: {
          "content-type": output.contentType,
          "content-disposition": `${payload.disposition}; filename="${output.fileName}"`,
          "cache-control": "private, no-store",
          "x-content-type-options": "nosniff",
        },
      });
    }
    if (report === "participants") {
      const payload = eventParticipantReportRequestSchema.parse(requestBody);
      if (payload.mode === "preview") {
        const data = await getEventParticipantReportPreview(eventId, payload.config);
        return NextResponse.json({ data }, { headers: { "cache-control": "private, no-store" } });
      }
      const output = await generateEventParticipantReport(eventId, payload.config);
      return new NextResponse(new Uint8Array(output.body), {
        headers: {
          "content-type": output.contentType,
          "content-disposition": `${payload.disposition}; filename="${output.fileName}"`,
          "cache-control": "private, no-store",
          "x-content-type-options": "nosniff",
        },
      });
    }

    const payload = eventGeneralReportRequestSchema.parse(requestBody);
    if (payload.mode === "preview") {
      const data = await getEventGeneralReportPreview(eventId, payload.config);
      return NextResponse.json({ data }, { headers: { "cache-control": "private, no-store" } });
    }
    const output = await generateEventGeneralReport(eventId, payload.config);
    return new NextResponse(new Uint8Array(output.body), {
      headers: {
        "content-type": output.contentType,
        "content-disposition": `${payload.disposition}; filename="${output.fileName}"`,
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
