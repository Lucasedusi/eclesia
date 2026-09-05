import { describe, expect, it } from "vitest";
import type { EventFinancialReportConfig } from "../types/event.types";
import { aggregateEventFinancialReport } from "./event-financial-report";

const config: EventFinancialReportConfig = {
  scope: "GENERAL",
  filters: { regionId:"",congregationId:"",roleId:"",gender:"",registrationStatus:"",paymentMethod:"",paymentStatus:"",itemId:"",registeredFrom:"",registeredTo:"" },
  expenseFilters: { name:"",from:"",to:"" },
  sections: { showSummary:true,showPaymentMethods:true,showItems:true,showExpenses:true,showAppliedFilters:true,showIssuedAt:true },
  columns: { summaryExpectedAmount:false,summaryPendingAmount:false,summaryPaidRegistrationCount:true,paymentConfirmedCount:true,paymentPercentage:false,itemParticipantCount:true,itemExpectedAmount:true,expenseIndex:true,expenseReceipt:true },
  organization: "HIGHEST_VALUE",
  expenseOrganization: "DATE_DESC",
};

const registrations = [
  { id:"r1",groupId:null,paymentStatus:"PAID",totalAmount:100,paidAmount:100,remainingAmount:0 },
  { id:"r2",groupId:null,paymentStatus:"PARTIAL",totalAmount:150,paidAmount:50,remainingAmount:100 },
];

const payments = [
  { id:"p1",registrationId:"r1",groupId:null,method:"PIX",status:"CONFIRMED",amount:100,paidAt:"2026-08-20T12:00:00Z" },
  { id:"p2",registrationId:"r2",groupId:null,method:"CASH",status:"CONFIRMED",amount:50,paidAt:"2026-08-21T12:00:00Z" },
  { id:"p3",registrationId:"r2",groupId:null,method:"PIX",status:"FAILED",amount:100,paidAt:null },
];

const items = [
  { id:"i1",registrationId:"r1",groupId:null,itemId:"shirt",itemName:"Camiseta",quantity:1,expectedAmount:50 },
  { id:"i2",registrationId:"r2",groupId:null,itemId:"shirt",itemName:"Camiseta",quantity:2,expectedAmount:100 },
  { id:"i3",registrationId:"r2",groupId:null,itemId:"meal",itemName:"Almoço",quantity:1,expectedAmount:30 },
];
const expenses = [
  { id:"e1",name:"Aluguel",expenseDate:"2026-08-22",amount:70,hasReceipt:true },
  { id:"e2",name:"Água",expenseDate:"2026-08-23",amount:20,hasReceipt:false },
];

describe("aggregateEventFinancialReport", () => {
  it("considera somente pagamentos confirmados no valor recebido", () => {
    const result = aggregateEventFinancialReport({ config, registrations, payments, items, expenses });
    expect(result.totalReceived).toBe(150);
    expect(result.expectedAmount).toBe(250);
    expect(result.pendingAmount).toBe(100);
    expect(result.paidRegistrationCount).toBe(1);
    expect(result.paymentMethods.map((row) => row.id)).toEqual(["PIX", "CASH"]);
    expect(result.paymentMethods[0].percentage).toBeCloseTo(66.666, 2);
    expect(result.totalExpenses).toBe(90);
    expect(result.balance).toBe(60);
  });

  it("consolida participantes, unidades e valor previsto por item", () => {
    const result = aggregateEventFinancialReport({ config, registrations, payments, items, expenses });
    expect(result.items[0]).toMatchObject({ id:"shirt",participantCount:2,units:3,expectedAmount:150 });
    expect(result.totalItemUnits).toBe(4);
  });

  it("inclui caravanas sem duplicar inscrições individuais",()=>{
    const result=aggregateEventFinancialReport({config,registrations:[...registrations,{id:"caravan:g1",groupId:"g1",paymentStatus:"PARTIAL",totalAmount:5000,paidAmount:2500,remainingAmount:2500}],payments:[...payments,{id:"p4",registrationId:null,groupId:"g1",method:"PIX",status:"CONFIRMED",amount:2500,paidAt:"2026-08-22T12:00:00Z"}],items:[...items,{id:"i4",registrationId:null,groupId:"g1",itemId:"registration",itemName:"Inscrição",quantity:100,expectedAmount:5000}],expenses});
    expect(result.totalReceived).toBe(2650);expect(result.expectedAmount).toBe(5250);expect(result.pendingAmount).toBe(2600);expect(result.items.find((item)=>item.id==="registration")).toMatchObject({participantCount:100,units:100,expectedAmount:5000});
  });

  it("filtra a forma efetivamente confirmada e ordena por quantidade", () => {
    const result = aggregateEventFinancialReport({
      config: { ...config, filters: { ...config.filters, paymentMethod:"CASH" }, organization:"HIGHEST_QUANTITY" },
      registrations,
      payments,
      items,
      expenses,
    });
    expect(result.totalReceived).toBe(50);
    expect(result.paymentMethods).toHaveLength(1);
    expect(result.paymentMethods[0].id).toBe("CASH");
  });

  it("organiza alfabeticamente quando solicitado", () => {
    const result = aggregateEventFinancialReport({ ...{ config: { ...config, organization:"ALPHABETICAL" as const }, registrations, payments, items, expenses } });
    expect(result.items.map((row) => row.name)).toEqual(["Almoço", "Camiseta"]);
  });

  it("ordena despesas e numera a listagem", () => {
    const result = aggregateEventFinancialReport({ config, registrations, payments, items, expenses });
    expect(result.expenses.map((row) => [row.index, row.name])).toEqual([[1,"Água"],[2,"Aluguel"]]);
  });

  it("isola entradas e despesas conforme a abrangência", () => {
    const expensesOnly = aggregateEventFinancialReport({ config: { ...config, scope:"EXPENSES_ONLY", sections:{ ...config.sections, showPaymentMethods:false, showItems:false } }, registrations, payments, items, expenses });
    expect(expensesOnly).toMatchObject({ totalReceived:0,totalExpenses:90,balance:-90,expectedAmount:0 });
    const entriesOnly = aggregateEventFinancialReport({ config: { ...config, scope:"ENTRIES_ONLY", sections:{ ...config.sections, showExpenses:false } }, registrations, payments, items, expenses });
    expect(entriesOnly).toMatchObject({ totalReceived:150,totalExpenses:0,balance:150,expectedAmount:250 });
  });
});
