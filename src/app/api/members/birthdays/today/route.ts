import { resolveAccessContext } from "@/modules/auth/services/access-context.service";
import { countBirthdaysToday } from "@/modules/members/services/member-birthdays.service";
import { canViewBirthdays } from "@/modules/members/utils/birthday-access";

const headers = { "Cache-Control": "private, no-store" };

export async function GET() {
  try {
    const access = await resolveAccessContext();
    if (access.status !== "ready" || !canViewBirthdays(access.context)) {
      return new Response(null, { status: access.status === "anonymous" ? 401 : 403, headers });
    }
    const count = await countBirthdaysToday(access.context);
    return Response.json({ count }, { headers });
  } catch {
    return new Response(null, { status: 503, headers });
  }
}
