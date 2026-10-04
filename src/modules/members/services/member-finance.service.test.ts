import {it,expect,vi} from "vitest";
import type {AuthContext} from "@/modules/auth/types/auth.types";
vi.mock("server-only",()=>({}));const mocks=vi.hoisted(()=>({client:vi.fn(),units:vi.fn()}));
vi.mock("@/lib/supabase/server",()=>({createClient:mocks.client}));vi.mock("@/modules/finance/services/finance-access.service",()=>({listFinanceUnits:mocks.units}));
import {getMemberFinance} from "./member.service";
const context={church:{id:"field"},permissions:["finance.view"]} as AuthContext;
it("does not grant financial history through identity lookup permission",async()=>{
 await expect(getMemberFinance({...context,permissions:["finance.contributors.lookup"]},"member")).rejects.toThrow("MEMBER_FINANCE_PERMISSION_DENIED");expect(mocks.client).not.toHaveBeenCalled();
});
it("filters financial history to authorized units and deterministic pages",async()=>{
 const q={select:vi.fn().mockReturnThis(),eq:vi.fn().mockReturnThis(),in:vi.fn().mockReturnThis(),is:vi.fn().mockReturnThis(),order:vi.fn().mockReturnThis(),range:vi.fn().mockResolvedValue({data:[],count:0,error:null})};mocks.units.mockResolvedValue([{id:"unit"}]);mocks.client.mockResolvedValue({from:()=>q});
 await getMemberFinance(context,"member",2);expect(q.in).toHaveBeenCalledWith("congregation_id",["unit"]);expect(q.eq).toHaveBeenCalledWith("church_id","field");expect(q.range).toHaveBeenCalledWith(20,39);expect(q.order).toHaveBeenCalledWith("id",{ascending:false});
});
