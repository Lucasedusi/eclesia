import { FinanceSkeleton } from "@/modules/finance/components/finance-skeleton";
import { Suspense } from "react";
import {
  resolveFinancePage,
  type FinanceSearchParams,
} from "@/modules/finance/services/finance-page.service";
import {
  listStatementRules,
  listStatements,
  getStatementVersion,
} from "@/modules/finance/services/finance-statement.service";
import { FinanceStatements } from "@/modules/finance/components/finance-statements";
async function Content({
  searchParams,
}: {
  searchParams: FinanceSearchParams;
}) {
  const { context, month } = await resolveFinancePage(searchParams);
  const [rules, versions] = await Promise.all([
    listStatementRules(context),
    listStatements(context, { month }),
  ]);
  const current = versions[0]
    ? await getStatementVersion(context, versions[0].id)
    : null;
  return (
    <FinanceStatements
      key={`${context.congregationId}-${month}`}
      unit={context.congregationId}
      month={month}
      current={current}
      versions={versions}
      configured={rules.some((r) => r.effectiveMonth <= month)}
      canGenerate={context.capabilities.generateStatement}
      canConfigure={context.capabilities.manageSettings}
    />
  );
}
export default function Page(props: { searchParams: FinanceSearchParams }) {
  return (
    <Suspense fallback={<FinanceSkeleton />}>
      <Content {...props} />
    </Suspense>
  );
}
