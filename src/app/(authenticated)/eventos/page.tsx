import { Suspense } from "react";
import { PERMISSIONS } from "@/modules/auth/constants/permissions";
import { requireAccessContext } from "@/modules/auth/services/access-context.service";
import { EventCatalog } from "@/modules/events/components/event-catalog";
import { listEvents } from "@/modules/events/services/event.service";
import { eventListSchema } from "@/modules/events/validations/event.schemas";
import LoadingEvents from "./loading";

async function Content({ query }: { query: Record<string,string|string[]|undefined> }) {
  const context = await requireAccessContext(PERMISSIONS.eventsView);
  const first = (value: string|string[]|undefined) => Array.isArray(value) ? value[0] ?? "" : value ?? "";
  const parsed = eventListSchema.parse({ search: first(query.search), status: first(query.status).toUpperCase(), type: first(query.type).toUpperCase(), page: first(query.page) || 1, pageSize: 20 });
  return <EventCatalog data={await listEvents(parsed)} canManage={context.permissions.includes(PERMISSIONS.eventsManage)} canPublish={context.permissions.includes(PERMISSIONS.eventsPublish)}/>;
}

export default async function EventsPage({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const query = await searchParams;
  return <Suspense fallback={<LoadingEvents/>}><Content query={query}/></Suspense>;
}
