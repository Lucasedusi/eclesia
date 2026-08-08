"use client";

import { useEffect, useTransition } from "react";
import { RefreshCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import * as S from "@/modules/organization/components/organization.styles";

export default function EcclesiasticalStructureError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    console.error("[organization-page] Rendering failed", { message: error.message, digest: error.digest });
  }, [error]);

  return (
    <S.ErrorState role="alert">
      <span><TriangleAlert /></span>
      <h2>Não foi possível carregar a estrutura</h2>
      <p>Ocorreu uma falha temporária ao consultar os dados. Tente novamente; se o problema persistir, confirme se a migração do módulo foi aplicada.</p>
      <Button loading={pending} onClick={() => startTransition(reset)}>
        {!pending && <RefreshCw size={15} />} {pending ? "Recarregando..." : "Tentar novamente"}
      </Button>
    </S.ErrorState>
  );
}
