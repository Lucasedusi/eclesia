import { describe,it,expect } from "vitest";
import { financeCatalogSchema } from "./finance-catalog.schemas";
const unit="30000000-0000-4000-8000-000000000001";
describe("financial catalog input",()=>{
 it("requires monthly participation policy for departments",()=>{
  expect(financeCatalogSchema.safeParse({entity:"DEPARTMENT",name:"Missões",congregationId:unit,status:"ACTIVE"}).success).toBe(false);
  expect(financeCatalogSchema.safeParse({entity:"DEPARTMENT",name:"Missões",congregationId:unit,status:"ACTIVE",effectiveMonth:"2026-10",participatesInBase:false}).success).toBe(true);
 });
 it("rejects fractional cents and empty payment methods on cashboxes",()=>{
  expect(financeCatalogSchema.safeParse({entity:"CASHBOX",name:"Caixa",congregationId:unit,kind:"CASH",openingCents:1.2,openingDate:"2026-10-01",paymentMethodIds:[]}).success).toBe(false);
 });
 it("rejects expense tithe categories",()=> expect(financeCatalogSchema.safeParse({entity:"CATEGORY",name:"Dízimo",congregationId:unit,direction:"EXPENSE",isTithe:true}).success).toBe(false));
});
