import { Suspense } from "react";
import { notFound } from "next/navigation";
import { PublicRegistration } from "@/modules/events/components/public-registration";
import { getPublicEvent } from "@/modules/events/services/event.service";
import PublicRegistrationLoading from "./loading";

async function Content({ params }: { params: Promise<{ publicCode: string; slug: string }> }) {
  const { publicCode, slug } = await params;
  const data = await getPublicEvent(publicCode, slug);
  if (!data) notFound();
  return <PublicRegistration event={data.event} items={data.items as never[]} congregations={data.congregations} isRegistrationOpen={data.isRegistrationOpen} />;
}

export default function PublicEventPage({ params }: { params: Promise<{ publicCode: string; slug: string }> }) {
  return <Suspense fallback={<PublicRegistrationLoading />}><Content params={params} /></Suspense>;
}
