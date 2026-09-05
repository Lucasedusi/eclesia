import {createHash,randomUUID} from "node:crypto";
import {NextResponse,type NextRequest} from "next/server";
import {completePublicCaravan,consumePublicRegistrationRateLimit,getPublicEvent} from "@/modules/events/services/event.service";
import {publicCaravanSchema} from "@/modules/events/validations/event.schemas";

const MAX_BODY_SIZE=256*1024;
export async function POST(request:NextRequest,{params}:{params:Promise<{publicCode:string;slug:string}>}){
  const origin=request.headers.get("origin");if(origin&&origin!==request.nextUrl.origin)return NextResponse.json({message:"Origem não permitida."},{status:403});
  const {publicCode,slug}=await params;
  try{
    const raw=await request.text();if(raw.length>MAX_BODY_SIZE)return NextResponse.json({message:"Solicitação muito grande."},{status:413});
    const payload=JSON.parse(raw) as Record<string,unknown>;if(typeof payload.website==="string"&&payload.website.trim())return NextResponse.json({message:"Inscrição recebida."},{status:201});
    const parsed=publicCaravanSchema.safeParse(payload);if(!parsed.success)return NextResponse.json({message:parsed.error.issues[0]?.message??"Revise os dados da caravana.",fieldErrors:parsed.error.flatten().fieldErrors},{status:400});
    const publicEvent=await getPublicEvent(publicCode,slug);if(!publicEvent||publicEvent.event.id!==parsed.data.eventId||publicEvent.event.registrationMode!=="MIXED")return NextResponse.json({message:"Evento indisponível."},{status:404});
    const forwarded=request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()??"unknown";const fingerprint=createHash("sha256").update(`${forwarded}|${request.headers.get("user-agent")??"unknown"}|${parsed.data.eventId}|caravan`).digest("hex");
    if(!await consumePublicRegistrationRateLimit(parsed.data.eventId,fingerprint))return NextResponse.json({message:"Muitas tentativas. Aguarde alguns minutos."},{status:429,headers:{"retry-after":"900"}});
    const requested=request.headers.get("idempotency-key");const key=requested&&/^[A-Za-z0-9:_-]{16,120}$/.test(requested)?requested:randomUUID();
    const data=await completePublicCaravan(publicCode,slug,parsed.data,key);return NextResponse.json({message:"Caravana inscrita com sucesso.",data},{status:201,headers:{"cache-control":"no-store"}});
  }catch(error){return NextResponse.json({message:error instanceof Error?error.message:"Não foi possível concluir a inscrição."},{status:400,headers:{"cache-control":"no-store"}});}
}
