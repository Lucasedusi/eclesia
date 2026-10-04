import type {z} from "zod";
import type {contributorSchema,contributionSchema,financeCommandSchema} from "../validations/finance-command.schemas";
export type ContributorRef=z.infer<typeof contributorSchema>;
export type ContributionInput=z.infer<typeof contributionSchema>;
export type FinanceCommand=z.infer<typeof financeCommandSchema>;
export type FinanceMutationResult={operationId:string;transactionIds:string[];attendanceId:string|null;transferId:string|null;receiptId:string|null;revision:number;replayed:boolean};
export type ReceiptDTO={direction:"INCOME"|"EXPENSE";id:string;number:string;revision:number;status:string;congregationName:string;personName:string|null;date:string;paymentMethodName:string;totalCents:number;items:{transactionId:string;categoryName:string;departmentName:string;classificationName:string|null;amountCents:number}[]};
