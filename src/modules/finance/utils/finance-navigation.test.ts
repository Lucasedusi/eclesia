import { expect,it } from "vitest";
import { financeLocation } from "./finance-navigation";
it("carries only unit and month between financial screens",()=>{
 expect(financeLocation("/financeiro/caixas","unit","2026-10")).toBe("/financeiro/caixas?unidade=unit&mes=2026-10");
 expect(financeLocation("/membros","unit","2026-10")).toBe("/membros");
});
