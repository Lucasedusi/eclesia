import {z} from "zod";
export const FINANCE_DOCUMENT_BUCKET="financial-documents";
export const FINANCE_DOCUMENT_MAX_SIZE=10*1024*1024;
export const financeUploadSchema=z.object({name:z.string().trim().min(1).max(200),type:z.enum(["application/pdf","image/jpeg","image/png"]),size:z.number().int().positive().max(FINANCE_DOCUMENT_MAX_SIZE)}).strict();
export function validateFinanceUpload(input:unknown) {
 const value=financeUploadSchema.parse(input);const name=value.name.replaceAll("\\","/").split("/").pop()?.replace(/[\x00-\x1f\x7f]/g,"").trim()??"";
 const extension=name.split(".").pop()?.toLowerCase();
 if(!name||!(value.type==="application/pdf"?extension==="pdf":value.type==="image/jpeg"?["jpg","jpeg"].includes(extension??""):extension==="png")) throw new Error("INVALID_INPUT");
 return {...value,name,extension:extension!};
}
export function verifyFinanceFile(bytes:Uint8Array,mimeType:string) {
 const signature=mimeType==="application/pdf"?[37,80,68,70,45]:mimeType==="image/jpeg"?[255,216,255]:mimeType==="image/png"?[137,80,78,71,13,10,26,10]:[];
 if(!signature.length||bytes.length>FINANCE_DOCUMENT_MAX_SIZE||!signature.every((v,i)=>bytes[i]===v)) throw new Error("INVALID_INPUT");
}
