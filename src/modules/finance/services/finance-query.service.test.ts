import {it,expect,vi} from "vitest";
import type {FinanceContext} from "../types/finance.types";
vi.mock("server-only",()=>({}));const mocks=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock("@/lib/supabase/server",()=>({createClient:async()=>({rpc:mocks.rpc})}));
import {getFinanceOverview,listFinanceTransactions} from "./finance-query.service";
const context={churchId:"20000000-0000-4000-8000-000000000001",congregationId:"30000000-0000-4000-8000-000000000001",capabilities:{view:true}} as FinanceContext;
it("passes server scope and validated month without accepting another church",async()=>{
 mocks.rpc.mockResolvedValue({data:{closingCents:2401000},error:null});expect((await getFinanceOverview(context,{month:"2026-10"})).closingCents).toBe(2401000);
 expect(mocks.rpc).toHaveBeenLastCalledWith("get_finance_overview",{p_church_id:context.churchId,p_unit:context.congregationId,p_month:"2026-10"});
 await expect(getFinanceOverview(context,{month:"2026-13"})).rejects.toThrow();
});
it("rejects missing read capability before touching the database",async()=>{
 mocks.rpc.mockClear();await expect(listFinanceTransactions({...context,capabilities:{...context.capabilities,view:false}},{month:"2026-10"})).rejects.toThrow("FORBIDDEN");expect(mocks.rpc).not.toHaveBeenCalled();
});
