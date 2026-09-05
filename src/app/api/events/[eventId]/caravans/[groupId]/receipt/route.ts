import {NextResponse} from "next/server";
import {getInternalCaravanReceipt} from "@/modules/events/services/event-caravan-receipt.service";
import {createCaravanReceiptPdf} from "@/modules/events/services/event-caravan-receipt-pdf.service";

export async function GET(_:Request,{params}:{params:Promise<{eventId:string;groupId:string}>}){try{const {eventId,groupId}=await params;const data=await getInternalCaravanReceipt(eventId,groupId);const pdf=await createCaravanReceiptPdf(data);return new NextResponse(new Uint8Array(pdf),{headers:{"content-type":"application/pdf","content-disposition":`attachment; filename="comprovante-${data.groupNumber}.pdf"`,"cache-control":"private, no-store"}});}catch{return NextResponse.json({message:"Comprovante indisponível."},{status:404});}}
