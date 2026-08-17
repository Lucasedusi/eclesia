import { PERMISSIONS } from "@/modules/auth/constants/permissions";
import { requireAccessContext } from "@/modules/auth/services/access-context.service";
import { getMemberImportReportData } from "@/modules/members/import/services/member-import.service";
import { generateMemberImportReport } from "@/modules/members/import/services/member-import-workbook.service";

function safeFilename(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase();
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ batchId: string }> },
) {
  const context = await requireAccessContext(PERMISSIONS.membersImport);
  const { batchId } = await params;
  const report = await getMemberImportReportData(context, batchId);
  if (!report) return Response.json({ message: "Lote não encontrado." }, { status: 404 });
  const buffer = await generateMemberImportReport(report.batch, report.items);
  const filename = `relatorio-importacao-${safeFilename(report.batch.congregationName)}-${batchId.slice(0, 8)}.xlsx`;
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
