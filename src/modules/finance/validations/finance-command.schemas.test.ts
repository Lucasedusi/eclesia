import {it,expect} from "vitest";
import {financeCommandSchema} from "./finance-command.schemas";
const id="30000000-0000-4000-8000-000000000001";
const record={kind:"RECORD",operationKey:id,congregationId:id,mode:"SINGLE",direction:"INCOME",date:"2026-10-01",cashboxId:id,paymentMethodId:id,contributor:{kind:"COLLECTIVE"},items:[{categoryId:id,departmentId:id,amountCents:100}]};
it("single means one line and attendance only receives income",()=>{
 expect(financeCommandSchema.safeParse(record).success).toBe(true);
 expect(financeCommandSchema.safeParse({...record,items:[...record.items,...record.items]}).success).toBe(false);
 expect(financeCommandSchema.safeParse({...record,mode:"ATTENDANCE",direction:"EXPENSE"}).success).toBe(false);
});
it("requires revision and reason for destructive transitions",()=>{
 expect(financeCommandSchema.safeParse({kind:"CANCEL_TRANSACTION",operationKey:id,congregationId:id,id}).success).toBe(false);
});
