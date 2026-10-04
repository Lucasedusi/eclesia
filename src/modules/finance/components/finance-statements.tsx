"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Printer, FilePlus2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  StatementVersionDTO,
  StatementListItem,
} from "../types/finance-statement.types";
import { generateStatementAction } from "../actions/finance-statement.actions";
import { financeLocation } from "../utils/finance-navigation";
import { FinanceStatementDetail } from "./finance-statement-detail";
export function FinanceStatements({
  unit,
  month,
  versions,
  current,
  configured,
  canGenerate,
  canConfigure,
}: {
  unit: string;
  month: string;
  versions: StatementListItem[];
  current: StatementVersionDTO | null;
  configured: boolean;
  canGenerate: boolean;
  canConfigure: boolean;
}) {
  const key = useRef<string | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [generated, setGenerated] = useState<StatementVersionDTO | null>(null),
    router = useRouter(),
    statement =
      generated && (!current || generated.revision > current.revision)
        ? generated
        : current;
  return (
    <div className="stack">
      <div className="row spread no-print">
        <div>
          <p className="eyebrow">Conferência e transparência</p>
          <h1>Demonstrativos</h1>
          <p className="muted">
            Confira a distribuição mensal e consulte todas as versões.
          </p>
        </div>
        <div className="row">
          {statement && (
            <Button variant="outline" onClick={() => window.print()}>
              <Printer size={16} />
              Imprimir demonstrativo
            </Button>
          )}
          {canGenerate && (
            <Button
              loading={busy}
              disabled={!configured}
              onClick={async () => {
                key.current ??= crypto.randomUUID();
                setBusy(true);
                setError("");
                try {
                  const result = await generateStatementAction({
                    congregationId: unit,
                    month,
                    operationKey: key.current,
                  });
                  if (!result.ok) {
                    setError(result.message);
                    return;
                  }
                  key.current = null;
                  setGenerated(result.data);
                  router.refresh();
                } catch {
                  setError(
                    "Não foi possível confirmar a geração. Tente novamente para consultar esta tentativa.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              <FilePlus2 size={16} />
              {versions.length ? "Gerar nova versão" : "Gerar demonstrativo"}
            </Button>
          )}
        </div>
      </div>
      {error && <div role="alert">{error}</div>}
      {!configured && (
        <div className="notice">
          As regras de distribuição ainda não foram configuradas para este mês.
          {canConfigure && (
            <>
              {" "}
              <Link
                href={financeLocation("/financeiro/configuracoes", unit, month)}
              >
                Abrir configurações
              </Link>
            </>
          )}
        </div>
      )}
      {statement ? (
        <FinanceStatementDetail statement={statement} />
      ) : (
        <div className="card empty">
          {configured
            ? "Nenhuma versão gerada neste período. Gere o demonstrativo para conferir os valores."
            : "Configure as regras para gerar o primeiro demonstrativo."}
        </div>
      )}
      {versions.length > 0 && (
        <section className="card stack no-print">
          <h2>Versões preservadas</h2>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Versão</th>
                  <th>Geração</th>
                  <th>Responsável</th>
                  <th>Situação</th>
                  <th>Consulta</th>
                </tr>
              </thead>
              <tbody>
                {versions.map((v) => (
                  <tr key={v.id}>
                    <td>{v.revision}</td>
                    <td>
                      {new Date(v.createdAt).toLocaleString("pt-BR", {
                        timeZone: "America/Sao_Paulo",
                      })}
                    </td>
                    <td>{v.createdByName}</td>
                    <td>
                      {v.superseded
                        ? "Substituída"
                        : v.stale
                          ? "Desatualizada"
                          : "Atual"}
                    </td>
                    <td>
                      <Link
                        href={financeLocation(
                          `/financeiro/demonstrativos/${v.id}`,
                          unit,
                          month,
                        )}
                      >
                        Ver demonstrativo
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
export function FinanceStatementPrint() {
  return (
    <Button
      variant="outline"
      className="no-print"
      onClick={() => window.print()}
    >
      <Printer size={16} />
      Imprimir esta versão
    </Button>
  );
}
