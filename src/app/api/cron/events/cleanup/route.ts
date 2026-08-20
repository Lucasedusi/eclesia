import { NextResponse } from "next/server";
import { cleanupStaleEventUploads } from "@/modules/events/services/event.service";
import { cleanupExpiredPublicEventCheckouts } from "@/modules/events/services/event-public-checkout.service";

export async function POST(request:Request){const secret=process.env.CRON_SECRET;if(!secret)return NextResponse.json({error:"Cron não configurado."},{status:503});if(request.headers.get("authorization")!==`Bearer ${secret}`)return NextResponse.json({error:"Não autorizado."},{status:401});try{const [uploads,checkouts]=await Promise.all([cleanupStaleEventUploads(),cleanupExpiredPublicEventCheckouts()]);return NextResponse.json({uploads,checkouts});}catch(error){console.error("[events] scheduled cleanup failed",{message:error instanceof Error?error.message:"UNKNOWN_ERROR"});return NextResponse.json({error:"Falha na manutenção agendada."},{status:500});}}
