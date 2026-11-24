"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { Account } from "./plan";
import styles from "./workspace.module.css";

export function AccountsTable({
  rows,
  current,
  review = false,
}: {
  rows: Account[];
  current: Account[];
  review?: boolean;
}) {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const filtered = rows.filter((row) =>
    [row.name, row.code, row.classification]
      .join(" ")
      .toLocaleLowerCase("pt-BR")
      .includes(search.trim().toLocaleLowerCase("pt-BR")),
  );
  const index = Math.min(
    page,
    Math.max(0, Math.ceil(filtered.length / 25) - 1),
  );
  const previous = new Map(current.map((row) => [row.code, row]));
  return (
    <div className="stack">
      <label>
        Buscar no plano
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          placeholder="Nome, classificação ou chamada"
        />
      </label>
      <div className={styles.scroll}>
        <table>
          <thead>
            <tr>
              <th>Chamada</th>
              <th>Classificação</th>
              <th>Nome da conta</th>
              {review && <th>Alteração</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.slice(index * 25, (index + 1) * 25).map((row) => (
              <tr key={row.code}>
                <td>{row.code}</td>
                <td>{row.classification}</td>
                <td>{row.name}</td>
                {review && (
                  <td>
                    {previous.has(row.code) ? (
                      <>
                        Atualizar
                        <br />
                        <small>
                          Anterior: {previous.get(row.code)?.classification} ·{" "}
                          {previous.get(row.code)?.name}
                        </small>
                      </>
                    ) : (
                      "Adicionar"
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="row">
        <span>{filtered.length} contas</span>
        {filtered.length > 25 && (
          <>
            <Button
              variant="secondary"
              disabled={!index}
              onClick={() => setPage(index - 1)}
            >
              Anterior
            </Button>
            <span>
              {index + 1} de {Math.ceil(filtered.length / 25)}
            </span>
            <Button
              variant="secondary"
              disabled={(index + 1) * 25 >= filtered.length}
              onClick={() => setPage(index + 1)}
            >
              Próxima
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
