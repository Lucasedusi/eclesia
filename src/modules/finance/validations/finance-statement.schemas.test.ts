import {it,expect} from "vitest";
import {statementRulesSchema} from "./finance-statement.schemas";
const base={congregationId:"30000000-0000-4000-8000-000000000001",effectiveMonth:"2026-10"};
it("rejects dependency cycles and multiple gross prebends",()=>{
 const gross={name:"Prebenda",destination:"LOCAL_PASTOR",role:"GROSS_PREBEND",calculation:"ELIGIBLE_INCOME_PERCENT",percentage:"35"};
 expect(statementRulesSchema.safeParse({...base,items:[gross]}).success).toBe(true);
 expect(statementRulesSchema.safeParse({...base,items:[gross,gross]}).success).toBe(false);
 expect(statementRulesSchema.safeParse({...base,items:[{...gross,calculation:"GROSS_PREBEND_PERCENT"}]}).success).toBe(false);
 expect(statementRulesSchema.safeParse({...base,items:[{name:"Desconto",destination:"CATHEDRAL",role:"PREBEND_DEDUCTION",calculation:"GROSS_PREBEND_PERCENT",percentage:"10"}]}).success).toBe(false);
});
