import { Suspense } from "react";
import { EventForm } from "@/modules/events/components/event-form";
import { getEvent, getEventFormOptions } from "@/modules/events/services/event.service";
import LoadingEvents from "../../loading";

async function Content({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const [event, options] = await Promise.all([getEvent(eventId), getEventFormOptions()]);
  return <EventForm initial={event} options={options} />;
}

export default function EditEventPage({ params }: { params: Promise<{ eventId: string }> }) {
  return (
    <Suspense fallback={<LoadingEvents />}>
      <Content params={params} />
    </Suspense>
  );
}
