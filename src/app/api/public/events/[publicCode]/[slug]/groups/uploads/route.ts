import {createHash} from "node:crypto";
import {NextResponse,type NextRequest} from "next/server";
import {consumePublicRegistrationRateLimit,getPublicEvent,preparePublicCaravanUpload} from "@/modules/events/services/event.service";

const MAX_BODY_SIZE=16*1024;
export async function POST(request:NextRequest,{params}:{params:Promise<{publicCode:string;slug:string}>}){
  const origin=request.headers.get("origin");if(origin&&origin!==request.nextUrl.origin)return NextResponse.json({message:"Origem não permitida."},{status:403});
  const {publicCode,slug}=await params;
  try{const raw=await request.text();if(raw.length>MAX_BODY_SIZE)return NextResponse.json({message:"Solicitação muito grande."},{status:413});const input=JSON.parse(raw) as {sessionKey:string;kind:"list"|"receipt";fileName:string;mimeType:string;fileSize:number;eventId:string};
    const publicEvent=await getPublicEvent(publicCode,slug);if(!publicEvent||publicEvent.event.id!==input.eventId)return NextResponse.json({message:"Evento indisponível."},{status:404});
    const forwarded=request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()??"unknown";const fingerprint=createHash("sha256").update(`${forwarded}|${request.headers.get("user-agent")??"unknown"}|${input.eventId}|caravan-upload`).digest("hex");
    if(!await consumePublicRegistrationRateLimit(input.eventId,fingerprint))return NextResponse.json({message:"Muitas tentativas. Aguarde alguns minutos."},{status:429});
    const data=await preparePublicCaravanUpload(publicCode,slug,input);return NextResponse.json({data},{headers:{"cache-control":"no-store"}});
  }catch(error){return NextResponse.json({message:error instanceof Error?error.message:"Não foi possível preparar o arquivo."},{status:400,headers:{"cache-control":"no-store"}});}
}
