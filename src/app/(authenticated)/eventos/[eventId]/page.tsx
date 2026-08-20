import { Suspense } from "react";
import { EventWorkspace } from "@/modules/events/components/event-workspace";
import { getEventWorkspace } from "@/modules/events/services/event.service";
import LoadingEvents from "../loading";

async function Content({ eventId }: { eventId: string }) { return <EventWorkspace initial={await getEventWorkspace(eventId)}/>; }
export default async function EventPage({ params }: { params: Promise<{ eventId: string }> }) { const { eventId } = await params; return <Suspense fallback={<LoadingEvents/>}><Content eventId={eventId}/></Suspense>; }
