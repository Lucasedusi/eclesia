import { z } from "zod";
import { centsSchema, localDateSchema } from "./finance-catalog.schemas";
import {MAX_AMOUNT_CENTS} from "../utils/finance-money";
const text=z.string().trim().max(1000).optional();
export const contributorSchema=z.discriminatedUnion("kind",[
 z.object({kind:z.literal("MEMBER"),memberId:z.uuid()}).strict(),
 z.object({kind:z.literal("UNREGISTERED"),name:z.string().trim().min(2).max(160)}).strict(),
 z.object({kind:z.literal("COLLECTIVE")}).strict(),
]);
export const contributionSchema=z.object({categoryId:z.uuid(),departmentId:z.uuid(),amountCents:centsSchema,titheClassificationId:z.uuid().nullable().optional(),description:text,notes:text,documentNumber:z.string().trim().max(80).optional()}).strict();
const base={operationKey:z.uuid(),congregationId:z.uuid()};
const payment={date:localDateSchema,cashboxId:z.uuid(),paymentMethodId:z.uuid(),contributor:contributorSchema,beneficiaryName:z.string().trim().max(160).optional(),paymentReference:z.string().trim().max(160).optional(),documentIds:z.array(z.uuid()).max(10).default([])};
const record=z.object({...base,...payment,kind:z.literal("RECORD"),mode:z.enum(["SINGLE","ATTENDANCE"]),direction:z.enum(["INCOME","EXPENSE"]),items:z.array(contributionSchema).min(1).max(50),issueReceipt:z.boolean().default(false)}).strict().refine(v=>v.mode!=="SINGLE"||v.items.length===1,"Lançamento avulso aceita apenas um item.").refine(v=>v.mode!=="ATTENDANCE"||v.direction==="INCOME","Atendimento aceita somente entradas.");
const correction={...base,id:z.uuid(),expectedRevision:z.number().int().positive(),reason:z.string().trim().min(5).max(1000)};
const transfer={date:localDateSchema,sourceCashboxId:z.uuid(),targetCashboxId:z.uuid(),amountCents:centsSchema,description:text};
export const financeCommandSchema=z.discriminatedUnion("kind",[
 record,
 z.object({...correction,kind:z.literal("CORRECT_TRANSACTION"),replacement:z.object({...payment,direction:z.enum(["INCOME","EXPENSE"]),item:contributionSchema}).strict()}).strict(),
 z.object({...correction,kind:z.literal("CANCEL_TRANSACTION")}).strict(),
 z.object({...correction,kind:z.literal("CANCEL_ATTENDANCE")}).strict(),
 z.object({...base,...transfer,kind:z.literal("TRANSFER")}).strict().refine(v=>v.sourceCashboxId!==v.targetCashboxId,"Escolha caixas diferentes."),
 z.object({...correction,kind:z.literal("CORRECT_TRANSFER"),replacement:z.object(transfer).strict().refine(v=>v.sourceCashboxId!==v.targetCashboxId,"Escolha caixas diferentes.")}).strict(),
 z.object({...correction,kind:z.literal("CANCEL_TRANSFER")}).strict(),
 z.object({...base,kind:z.literal("ADJUST_BALANCE"),date:localDateSchema,cashboxId:z.uuid(),amountCents:z.number().int().min(-MAX_AMOUNT_CENTS).max(MAX_AMOUNT_CENTS).refine(v=>v!==0),reason:z.string().trim().min(5).max(1000)}).strict(),
]);
