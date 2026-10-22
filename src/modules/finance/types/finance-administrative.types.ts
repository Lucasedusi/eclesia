import type { z } from "zod";
import type {
  rankingOptionsSchema,
  deliveryOptionsSchema,
  deliveryProjectionSchema,
  deliveryRowSchema,
  recordDeliverySchema,
  deliveryDeadlineSchema,
  deliveryRuleSchema,
} from "../validations/finance-administrative.schemas";
import type { FinanceReportDocument } from "./finance-report.types";
import type { RankingAmounts } from "../utils/finance-administrative";
export type RankingOptions = z.infer<typeof rankingOptionsSchema>;
export type DeliveryOptions = z.infer<typeof deliveryOptionsSchema>;
export type DeliveryProjection = z.infer<typeof deliveryProjectionSchema>;
export type DeliveryRow = z.infer<typeof deliveryRowSchema>;
export type DeliveryRule = z.infer<typeof deliveryRuleSchema>;
export type RecordDeliveryInput = z.infer<typeof recordDeliverySchema>;
export type DeliveryDeadlineInput = z.infer<typeof deliveryDeadlineSchema>;
type Identity = Pick<
  FinanceReportDocument,
  "church" | "congregationName" | "congregationAddress" | "emissionId"
>;
export type RankingRow = RankingAmounts & {
  id: string;
  name: string;
  status: string;
  isHeadquarters: boolean;
  staleMonths: string[];
};
export type RankingDocument = RankingOptions &
  Identity & {
    generatedAt: string;
    rows: RankingRow[];
    totals: RankingAmounts;
  };
export type DeliveryDocument = DeliveryOptions &
  Identity & {
    generatedAt: string;
    dueDate: string;
    today: string;
    rows: DeliveryRow[];
  };
