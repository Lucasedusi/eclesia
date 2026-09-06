import { Suspense } from "react";
import { notFound } from "next/navigation";
import PublicRegistrationLoading from "../loading";
import { PublicRegistrationTracking } from "@/modules/events/components/public-registration-tracking";
import { getPublicEvent } from "@/modules/events/services/event.service";

async function Content({ params }: { params: Promise<{ publicCode: string; slug: string }> }) {
  const { publicCode, slug } = await params;
  const data = await getPublicEvent(publicCode, slug);
  if (!data) notFound();
  return <PublicRegistrationTracking event={data.event} />;
}

export default function PublicTrackingPage({ params }: { params: Promise<{ publicCode: string; slug: string }> }) {
  return <Suspense fallback={<PublicRegistrationLoading />}><Content params={params} /></Suspense>;
}
