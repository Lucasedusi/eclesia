"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { assignFinanceOperatorAction } from "@/modules/finance/actions/finance-operator.actions";
import type { UserFinanceAssignment } from "../types/user-finance.types";
import * as S from "./user-management.styles";

export function UserFinanceAssignmentEditor({ assignment, authorizationUnitId, accessChanged }: {
  assignment: UserFinanceAssignment;
  authorizationUnitId: string;
  accessChanged: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  return <S.PermissionBox>
    <h3>Operação financeira</h3>
    <p>Define onde este usuário registra movimentações. O alcance de consulta e as permissões do acesso continuam sendo respeitados.</p>
    {accessChanged && <p>Salve as alterações do acesso antes de definir a congregação de operação.</p>}
    {result && <S.Alert role={result.ok ? "status" : "alert"} $success={result.ok}>{result.message}</S.Alert>}
    <form onSubmit={async event => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      setBusy(true);
      setResult(null);
      try {
        const response = await assignFinanceOperatorAction({
          congregationId: authorizationUnitId,
          accessId: assignment.accessId,
          operatingUnit: form.get("operatingUnit") || null,
        });
        setResult({ ok: response.ok, message: response.ok ? "Congregação de operação atualizada." : response.message });
        if (response.ok) router.refresh();
      } catch {
        setResult({ ok: false, message: "Não foi possível atualizar a congregação de operação. Tente novamente." });
      } finally { setBusy(false); }
    }}>
      <S.OperationalControls>
        <S.Field><span>Congregação de operação</span>
          <S.Select name="operatingUnit" key={assignment.unitId ?? "none"} defaultValue={assignment.unitId ?? ""} disabled={busy || accessChanged}>
            <option value="">Sem congregação de operação</option>
            {assignment.unitId && !assignment.units.some(unit => unit.id === assignment.unitId) && <option value={assignment.unitId} disabled>Congregação indisponível — selecione outra</option>}
            {assignment.units.map(unit => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
          </S.Select>
        </S.Field>
        <S.Button type="submit" disabled={busy || accessChanged}>
          {busy ? <S.Spinner aria-hidden="true" /> : <Save size={15} aria-hidden="true" />}
          Salvar operação financeira
        </S.Button>
      </S.OperationalControls>
    </form>
  </S.PermissionBox>;
}
