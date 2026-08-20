import { Suspense } from "react";
import { EventForm } from "@/modules/events/components/event-form";
import { getEventFormOptions } from "@/modules/events/services/event.service";
import LoadingEvents from "../loading";

async function Content(){return <EventForm options={await getEventFormOptions()}/>;}
export default function NewEventPage(){return <Suspense fallback={<LoadingEvents/>}><Content/></Suspense>;}
