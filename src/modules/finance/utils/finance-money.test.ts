import {it,expect} from "vitest";
import {decimalToCents,centsToDecimal,sumCents,percentageCents,parseMoneyInput,toSqlAmount} from "./finance-money";
it("uses exact monetary boundaries and rounds each percentage",()=>{
 expect(decimalToCents("0.29")).toBe(29);expect(decimalToCents("-12.03")).toBe(-1203);
 expect(centsToDecimal(52500)).toBe("525.00");expect(percentageCents(105, "10")).toBe(11);
 expect(()=>decimalToCents("1.001")).toThrow();expect(()=>sumCents(Number.MAX_SAFE_INTEGER,1)).toThrow();
});

it("parses Brazilian input without float multiplication",()=>{
 expect(parseMoneyInput("1.234,56")).toBe(123456);expect(toSqlAmount(123456)).toBe("1234.56");
 expect(()=>parseMoneyInput("12,345")).toThrow();expect(()=>parseMoneyInput("1.23,45")).toThrow();
});
