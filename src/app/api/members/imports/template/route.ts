import { PERMISSIONS } from "@/modules/auth/constants/permissions";
import { requireAccessContext } from "@/modules/auth/services/access-context.service";
import { generateMemberImportTemplate } from "@/modules/members/import/services/member-import-workbook.service";

export async function GET() {
  await requireAccessContext(PERMISSIONS.membersImport);
  const buffer = await generateMemberImportTemplate();
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="modelo-importacao-membros.xlsx"',
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
