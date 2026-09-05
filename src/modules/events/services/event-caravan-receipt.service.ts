import "server-only";

import {createHash,randomBytes} from "node:crypto";
import {createAdminClient} from "@/lib/supabase/admin";
import {PERMISSIONS} from "@/modules/auth/constants/permissions";
import {requireAccessContext} from "@/modules/auth/services/access-context.service";

export type CaravanReceiptData={groupNumber:string;eventName:string;hostChurchName:string;hostChurchCity:string;hostChurchState:string;seniorPastorName:string;seniorPastorSpouseName:string;originChurchName:string;originCity:string;originState:string;responsibleName:string;responsiblePhone:string;pastorName:string;totalRegistrations:number;maleCount:number;femaleCount:number;items:{name:string;quantity:number;unitPrice:number;totalPrice:number}[];totalAmount:number;paidAmount:number;remainingAmount:number;paymentStatus:string;createdAt:string;updatedAt:string;verificationToken:string};
type Row=Record<string,unknown>;

async function load(groupId:string,eventId:string,verificationToken:string):Promise<CaravanReceiptData>{
  const admin=createAdminClient();const [groupResult,eventResult,itemResult]=await Promise.all([
    admin.from("event_groups").select("*").eq("id",groupId).eq("event_id",eventId).is("deleted_at",null).maybeSingle(),
    admin.from("events").select("id,name,church_id").eq("id",eventId).is("deleted_at",null).maybeSingle(),
    admin.from("event_registration_items").select("item_name,quantity,unit_price,total_price").eq("event_group_id",groupId).is("deleted_at",null).order("created_at"),
  ]);if(groupResult.error||!groupResult.data||eventResult.error||!eventResult.data)throw new Error("EVENT_CARAVAN_RECEIPT_NOT_FOUND");const group=groupResult.data as Row;
  const churchResult=await admin.from("churches").select("name,city,state,senior_pastor_name,senior_pastor_spouse_name").eq("id",eventResult.data.church_id).maybeSingle();if(churchResult.error||!churchResult.data)throw new Error("EVENT_CARAVAN_RECEIPT_NOT_FOUND");const church=churchResult.data as Row;
  return{groupNumber:String(group.group_number),eventName:String(eventResult.data.name),hostChurchName:String(church.name??""),hostChurchCity:String(church.city??""),hostChurchState:String(church.state??""),seniorPastorName:String(church.senior_pastor_name??""),seniorPastorSpouseName:String(church.senior_pastor_spouse_name??""),originChurchName:String(group.origin_church_name),originCity:String(group.origin_city),originState:String(group.origin_state),responsibleName:String(group.responsible_name),responsiblePhone:String(group.responsible_phone),pastorName:String(group.pastor_name),totalRegistrations:Number(group.total_registrations),maleCount:Number(group.male_count),femaleCount:Number(group.female_count),items:((itemResult.data??[]) as Row[]).map((item)=>({name:String(item.item_name),quantity:Number(item.quantity),unitPrice:Number(item.unit_price),totalPrice:Number(item.total_price)})),totalAmount:Number(group.total_amount),paidAmount:Number(group.paid_amount),remainingAmount:Math.max(Number(group.total_amount)-Number(group.paid_amount),0),paymentStatus:String(group.payment_status),createdAt:String(group.created_at),updatedAt:String(group.updated_at),verificationToken};
}

async function issue(groupId:string,eventId:string){const token=randomBytes(16).toString("hex");const admin=createAdminClient();const updated=await admin.from("event_groups").update({verification_token_hash:createHash("sha256").update(token).digest("hex"),verification_token_last4:token.slice(-4)}).eq("id",groupId).eq("event_id",eventId).is("deleted_at",null).select("id").maybeSingle();if(updated.error||!updated.data)throw new Error("EVENT_CARAVAN_RECEIPT_NOT_FOUND");return token;}

export async function getInternalCaravanReceipt(eventId:string,groupId:string){const context=await requireAccessContext(PERMISSIONS.eventGroupsView);const admin=createAdminClient();const allowed=await admin.from("event_groups").select("id").eq("id",groupId).eq("event_id",eventId).eq("church_id",context.church.id).is("deleted_at",null).maybeSingle();if(allowed.error||!allowed.data)throw new Error("EVENT_CARAVAN_RECEIPT_NOT_FOUND");return load(groupId,eventId,await issue(groupId,eventId));}

export async function getPublicCaravanReceipt(publicCode:string,slug:string,accessToken:string){if(!/^[A-Za-z0-9_-]{40,120}$/.test(accessToken))throw new Error("EVENT_CARAVAN_RECEIPT_NOT_FOUND");const admin=createAdminClient();const checkout=await admin.from("event_public_checkouts").select("event_id,group_id,status").eq("access_token_hash",createHash("sha256").update(accessToken).digest("hex")).eq("status","COMPLETED").maybeSingle();if(checkout.error||!checkout.data?.group_id)throw new Error("EVENT_CARAVAN_RECEIPT_NOT_FOUND");const event=await admin.from("events").select("id").eq("id",checkout.data.event_id).eq("public_code",publicCode).eq("slug",slug).eq("visibility","PUBLIC").is("deleted_at",null).maybeSingle();if(event.error||!event.data)throw new Error("EVENT_CARAVAN_RECEIPT_NOT_FOUND");return load(String(checkout.data.group_id),String(checkout.data.event_id),await issue(String(checkout.data.group_id),String(checkout.data.event_id)));}

export async function verifyCaravanToken(token:string){if(!/^[a-f0-9]{32}$/i.test(token))return null;const admin=createAdminClient();const {data,error}=await admin.rpc("verify_event_caravan",{p_token:token});if(error||!data)return null;return data as Record<string,unknown>;}
