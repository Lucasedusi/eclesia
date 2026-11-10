import {expect,it,vi} from "vitest";
import type {AuthContext} from "@/modules/auth/types/auth.types";
vi.mock("server-only",()=>({}));const mocks=vi.hoisted(()=>({load:vi.fn()}));
vi.mock("./member-financial-data.service",()=>({loadMemberFinancialData:mocks.load}));
import {getMemberFinance} from "./member.service";
it("paginates the view while keeping whole-period totals and bounds",async()=>{
 const items=Array.from({length:25},(_,i)=>({id:String(i)})),summary={incomeCents:2500,expenseCents:0,cancelledCents:0,pendingCents:0};
 mocks.load.mockResolvedValue({items,summary,period:"Todo o período"});
 const result=await getMemberFinance({} as AuthContext,"m",2,{});expect(result.items).toHaveLength(5);expect(result.total).toBe(25);expect(result.summary).toEqual(summary);expect(result.pageCount).toBe(2);
 expect((await getMemberFinance({} as AuthContext,"m",99,{})).page).toBe(2);
});
