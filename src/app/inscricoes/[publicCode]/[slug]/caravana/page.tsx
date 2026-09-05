import {Suspense} from "react";
import {notFound} from "next/navigation";
import {PublicCaravanRegistration} from "@/modules/events/components/public-caravan-registration";
import {getPublicEvent} from "@/modules/events/services/event.service";
import PublicRegistrationLoading from "../loading";

async function Content({params}:{params:Promise<{publicCode:string;slug:string}>}){
  const {publicCode,slug}=await params;const data=await getPublicEvent(publicCode,slug);
  if(!data||data.event.registrationMode!=="MIXED"||!data.event.paymentSettings.caravanRegistrationItemId)notFound();
  return <PublicCaravanRegistration event={data.event} items={data.items as never[]} isRegistrationOpen={data.isRegistrationOpen}/>;
}
export default function PublicCaravanPage({params}:{params:Promise<{publicCode:string;slug:string}>}){return <Suspense fallback={<PublicRegistrationLoading/>}><Content params={params}/></Suspense>;}
