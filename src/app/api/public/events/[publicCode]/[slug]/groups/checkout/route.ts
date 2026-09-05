import {createHash} from "node:crypto";
import {NextResponse,type NextRequest} from "next/server";
import {consumePublicRegistrationRateLimit,upsertPublicCaravanCheckout} from "@/modules/events/services/event.service";
import {publicCaravanDraftSchema} from "@/modules/events/validations/event.schemas";

const MAX_BODY_SIZE=128*1024;

export async function POST(request:NextRequest,{params}:{params:Promise<{publicCode:string;slug:string}>}){
  const origin=request.headers.get("origin");
  if(origin&&origin!==request.nextUrl.origin)return NextResponse.json({message:"Origem não permitida."},{status:403});
  const {publicCode,slug}=await params;
  try{
    const raw=await request.text();
    if(raw.length>MAX_BODY_SIZE)return NextResponse.json({message:"Solicitação muito grande."},{status:413});
    const parsed=publicCaravanDraftSchema.safeParse(JSON.parse(raw));
    if(!parsed.success)return NextResponse.json({message:parsed.error.issues[0]?.message??"Revise os dados da caravana.",fieldErrors:parsed.error.flatten().fieldErrors},{status:400});
    const forwarded=request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()??"unknown";
    const fingerprint=createHash("sha256").update(`${forwarded}|${request.headers.get("user-agent")??"unknown"}|${parsed.data.eventId}|caravan-draft`).digest("hex");
    if(!await consumePublicRegistrationRateLimit(parsed.data.eventId,fingerprint))return NextResponse.json({message:"Muitas tentativas. Aguarde alguns minutos."},{status:429,headers:{"retry-after":"600"}});
    const data=await upsertPublicCaravanCheckout(publicCode,slug,parsed.data);
    return NextResponse.json({data},{headers:{"cache-control":"no-store"}});
  }catch(error){
    return NextResponse.json({message:error instanceof Error?error.message:"Não foi possível preparar a inscrição."},{status:400,headers:{"cache-control":"no-store"}});
  }
}
