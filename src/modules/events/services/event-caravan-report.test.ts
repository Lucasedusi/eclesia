import {describe,expect,it} from "vitest";
import type {EventCaravanReportConfig,EventCaravanReportSource} from "../types/event.types";
import {organizeEventCaravans} from "./event-caravan-report";

const config:EventCaravanReportConfig={filters:{city:"",state:"",source:"",paymentStatus:"",registeredFrom:"",registeredTo:""},columns:{index:true,originChurch:true,responsible:false},organization:"HIGHEST_REGISTRATIONS",showAppliedFilters:true,showIssuedAt:true};
const rows:EventCaravanReportSource[]=[
  {id:"1",city:"Anápolis",state:"GO",originChurch:"Central",pastorName:"Pr. José",responsibleName:"Maria",totalRegistrations:20,source:"INTERNAL",paymentStatus:"PARTIAL",registeredAt:"2026-08-30T12:00:00Z"},
  {id:"2",city:"Goiânia",state:"GO",originChurch:"Norte",pastorName:"Pr. João",responsibleName:"Ana",totalRegistrations:40,source:"PUBLIC",paymentStatus:"PAID",registeredAt:"2026-08-31T12:00:00Z"},
];

describe("organizeEventCaravans",()=>{
  it("ordena por maior número de inscrições e numera as linhas",()=>{const result=organizeEventCaravans(rows,config);expect(result.map((row)=>row.id)).toEqual(["2","1"]);expect(result[0]).toMatchObject({index:1,cityAndState:"GOIÂNIA/GO"});});
  it("aplica filtros de origem e período",()=>{const result=organizeEventCaravans(rows,{...config,filters:{...config.filters,source:"PUBLIC",registeredFrom:"2026-08-31"}});expect(result).toHaveLength(1);expect(result[0].id).toBe("2");});
});
