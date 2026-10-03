import {it,expect} from "vitest";
import {validateFinanceUpload,verifyFinanceFile} from "./finance-documents";
it("accepts only bounded PDF JPEG PNG with matching signatures",()=>{
 expect(validateFinanceUpload({name:"recibo.pdf",type:"application/pdf",size:8}).extension).toBe("pdf");
 expect(()=>validateFinanceUpload({name:"big.pdf",type:"application/pdf",size:10*1024*1024+1})).toThrow();
 expect(()=>verifyFinanceFile(new Uint8Array([60,104,116,109,108]),"application/pdf")).toThrow();
 expect(()=>verifyFinanceFile(new Uint8Array([37,80,68,70,45,49]),"application/pdf")).not.toThrow();
 expect(()=>verifyFinanceFile(new Uint8Array([255,216,255,224]),"image/jpeg")).not.toThrow();
 expect(()=>verifyFinanceFile(new Uint8Array([137,80,78,71,13,10,26,10]),"image/png")).not.toThrow();
 expect(()=>validateFinanceUpload({name:"image.svg",type:"image/svg+xml",size:30})).toThrow();
});
