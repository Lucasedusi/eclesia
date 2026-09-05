import { Suspense } from "react";
import { PERMISSIONS } from "@/modules/auth/constants/permissions";
import { requireAccessContext } from "@/modules/auth/services/access-context.service";
import { EventCheckin } from "@/modules/events/components/event-checkin";
import { getEventWorkspace } from "@/modules/events/services/event.service";
import LoadingEvent from "../loading";

type CheckinParams = Promise<{ eventId: string }>;

async function Content({ params }: { params: CheckinParams }) {
  const { eventId } = await params;
  await requireAccessContext(PERMISSIONS.eventCheckin);
  return <EventCheckin data={await getEventWorkspace(eventId)} />;
}

export default function CheckinPage({ params }: { params: CheckinParams }) {
  return <Suspense fallback={<LoadingEvent />}><Content params={params} /></Suspense>;
}
