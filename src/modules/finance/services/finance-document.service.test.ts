import {beforeEach,it,expect,vi} from "vitest";
import type {FinanceContext} from "../types/finance.types";
vi.mock("server-only",()=>({}));
const mocks=vi.hoisted(()=>({client:vi.fn(),admin:vi.fn()}));
vi.mock("@/lib/supabase/server",()=>({createClient:mocks.client}));
vi.mock("@/lib/supabase/admin",()=>({createAdminClient:mocks.admin}));
import {finalizeFinanceDocument} from "./finance-document.service";
const id="30000000-0000-4000-8000-000000000001";
const context={churchId:id,congregationId:id,auth:{profile:{id}},capabilities:{create:true,update:false}} as FinanceContext;
beforeEach(()=>vi.resetAllMocks());
it("recovers a verified object when its first upload response was lost",async()=>{
 const row={id,created_by:id,file_name:"test.pdf",mime_type:"application/pdf",file_size:6,pending_path:`${id}/${id}/${id}/pending.pdf`,storage_path:`${id}/${id}/${id}/document.pdf`,status:"PENDING",content_hash:null};
 const bytes=new Uint8Array([37,80,68,70,45,49]);
 const query={select:vi.fn().mockReturnThis(),eq:vi.fn().mockReturnThis(),is:vi.fn().mockReturnThis(),maybeSingle:vi.fn().mockResolvedValue({data:row,error:null})};
 mocks.client.mockResolvedValue({from:()=>query,storage:{from:()=>({download:async()=>({data:new Blob([bytes]),error:null})})}});
 const marked={eq:vi.fn().mockReturnThis(),is:vi.fn().mockReturnThis(),select:vi.fn().mockReturnThis(),maybeSingle:vi.fn().mockResolvedValue({data:{id},error:null})};
 const update=vi.fn().mockReturnValue(marked);
 mocks.admin.mockReturnValue({from:()=>({update}),storage:{from:()=>({upload:async()=>({error:{message:"already exists"}}),download:async()=>({data:new Blob([bytes]),error:null})})}});
 await expect(finalizeFinanceDocument(context,id)).resolves.toEqual({documentId:id});
 expect(update).toHaveBeenCalledWith(expect.objectContaining({status:"READY"}));
});
it("rejects document writes before using privileged storage",async()=>{
 await expect(finalizeFinanceDocument({...context,capabilities:{...context.capabilities,create:false}},id)).rejects.toThrow("FORBIDDEN");
 expect(mocks.admin).not.toHaveBeenCalled();
});
