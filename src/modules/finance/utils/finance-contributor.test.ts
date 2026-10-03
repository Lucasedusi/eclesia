import {it,expect} from "vitest";
import {contributorSearchSchema,extractFinanceCredential} from "./finance-contributor";
it("validates exact CPF and limits name searches",()=>{
 expect(contributorSearchSchema.safeParse({kind:"NAME",value:"Jo"}).success).toBe(false);
 expect(contributorSearchSchema.safeParse({kind:"CPF",value:"00000000000"}).success).toBe(false);
 expect(contributorSearchSchema.safeParse({kind:"CPF",value:"529.982.247-25"}).success).toBe(true);
});
it("reads a credential as data and rejects arbitrary navigation",()=>{
 const token="a".repeat(43);expect(extractFinanceCredential(`https://igreja.example/verificar/membro/${token}`)).toBe(token);
 expect(()=>extractFinanceCredential("javascript:alert(1)")).toThrow();
 expect(()=>extractFinanceCredential(`https://external.example/path/${token}`)).toThrow();
});
