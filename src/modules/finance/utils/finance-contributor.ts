import {z} from "zod";
import {isValidCpf} from "@/utils/input-masks";
export const contributorSearchSchema=z.discriminatedUnion("kind",[
 z.object({kind:z.literal("NAME"),value:z.string().trim().min(3).max(160)}).strict(),
 z.object({kind:z.literal("MEMBER_CODE"),value:z.string().trim().min(3).max(80)}).strict(),
 z.object({kind:z.literal("CPF"),value:z.string().trim().refine(isValidCpf,"Informe um CPF válido.").transform(v=>v.replace(/\D/g,""))}).strict(),
 z.object({kind:z.literal("CREDENTIAL"),value:z.string().trim().min(43).max(2048)}).strict(),
]);
export function extractFinanceCredential(value:string) {
 const text=value.trim();if(/^[A-Za-z0-9_-]{43}$/.test(text)) return text;
 let url:URL;try {url=new URL(text);}catch{throw new Error("INVALID_INPUT");}
 if(!["https:","http:"].includes(url.protocol)||url.search||url.hash) throw new Error("INVALID_INPUT");
 const match=/^\/verificar\/membro\/([A-Za-z0-9_-]{43})\/?$/.exec(url.pathname);
 if(!match) throw new Error("INVALID_INPUT");return match[1];
}
