import { resolveAccessContext } from "@/modules/auth/services/access-context.service";
import { getBirthdayNotification } from "@/modules/members/services/member-birthdays.service";
import { canViewBirthdays } from "@/modules/members/utils/birthday-access";

const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: Request) {
  try {
    const access = await resolveAccessContext();
    if (access.status !== "ready" || !canViewBirthdays(access.context)) {
      return new Response(null, { status: access.status === "anonymous" ? 401 : 403, headers });
    }
    const expectedAccess = request.headers.get("X-Eklesias-Access");
    if (expectedAccess && expectedAccess !== access.context.access.id) {
      return new Response(null, { status: 403, headers });
    }
    const includeItems = new URL(request.url).searchParams.get("view") === "list";
    return Response.json(await getBirthdayNotification(access.context, includeItems), { headers });
  } catch {
    return new Response(null, { status: 503, headers });
  }
}
