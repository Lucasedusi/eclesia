import { PageSkeleton } from "@/components/ui/page-skeleton";

export default function AuthenticatedRouteLoading() {
  return <PageSkeleton variant="dashboard" label="Carregando painel" />;
}
