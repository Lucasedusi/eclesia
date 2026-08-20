import { Suspense } from "react";
import { PERMISSIONS } from "@/modules/auth/constants/permissions";
import { requireAccessContext } from "@/modules/auth/services/access-context.service";
import { EventCheckin } from "@/modules/events/components/event-checkin";
import { getEventWorkspace } from "@/modules/events/services/event.service";
import LoadingEvent from "../loading";

async function Content({eventId}:{eventId:string}){await requireAccessContext(PERMISSIONS.eventCheckin);return <EventCheckin data={await getEventWorkspace(eventId)}/>;}
export default async function CheckinPage({params}:{params:Promise<{eventId:string}>}){const{eventId}=await params;return <Suspense fallback={<LoadingEvent/>}><Content eventId={eventId}/></Suspense>;}
