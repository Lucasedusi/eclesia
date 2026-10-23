# Importação de extrato bancário — entrega local

Implementação de 23/10/2026 na branch `codex/finance-bank-statement-import`, a partir de `b83b43c`. Especificação aprovada: `docs/superpowers/specs/2026-10-23-finance-bank-statement-import-design.md`.

## Como usar

1. No computador, abra **Financeiro → Lançamentos → Importar extrato**.
2. Confira a congregação e escolha a conta bancária ativa correspondente ao arquivo. Envie o XLSX do Sicoob.
3. Confira os totais, as referências de saldo e as pendências de leitura. A preparação não movimenta dinheiro.
4. Abra um item, confira sua origem e procure registros compatíveis antes de criar um lançamento.
5. Complete a classificação, a forma de pagamento e a pessoa quando exigida. **Salvar rascunho** permite retomar depois; **Finalizar** registra o movimento; **Finalizar e próximo** abre outra pendência.

Data, direção, conta e total vêm do extrato armazenado. Para uma entrada, podem existir várias contribuições da mesma pessoa, com soma igual ao total bancário. Uma saída usa uma categoria nesta versão. O complemento bancário não é copiado automaticamente para a descrição financeira.

**Já lançado:** vincule o lançamento ou o atendimento inteiro compatível. **Transferência interna:** escolha explicitamente essa opção e a outra conta/caixa da mesma congregação. A outra ponta pode ser vinculada quando seu extrato for importado. **Ignorar:** informe um motivo; a linha permanece disponível para restauração.

Reenviar os mesmos bytes para a mesma conta reabre o lote. Linhas idênticas em arquivos diferentes exigem reconhecer o mesmo movimento ou justificar que são distintos. A comparação não usa apenas documento/data/valor e não elimina ocorrências automaticamente.

Cancelamentos e correções posteriores aparecem na conferência. Um registro criado pelo importador só pode ser reaberto após cancelamento integral. Um vínculo com registro que já existia pode ser desfeito com motivo, preservando o lançamento financeiro. Pendências posteriores também aparecem no resumo dos lotes.

## Limites e conservação de dados

- XLSX do Sicoob, uma aba, até 5 MB e 5.000 movimentos. Fórmulas, macros, conteúdo externo e estruturas incompatíveis são rejeitados.
- Linhas inválidas são preservadas para conferência, sem permitir lançamento. Referências de saldo ficam fora da fila de movimentos.
- A conferência de saldos aceita uma única referência inicial no primeiro dia ou no dia imediatamente anterior e uma referência final no último dia. Outros intervalos ambíguos aparecem como indisponíveis. Divergências exigem motivo para prosseguir.
- Conferência pelo computador; em telas pequenas há orientação para usar um computador. Os demais fluxos financeiros mobile continuam disponíveis.
- Rascunhos e campos necessários do extrato ficam no banco, sob o escopo financeiro. O XLSX original não é armazenado. Não há persistência offline dos dados bancários.
- PDF/OCR, classificação automática, lançamentos em massa e rateio entre pessoas ficam fora desta versão.

## Persistência e autorização

Há tabelas próprias de lotes, itens, vínculos, eventos e operações. A confirmação usa a mesma transação e a mesma ordem de travas do núcleo financeiro. Chave de operação, revisão do item e exclusividade dos vínculos protegem retentativas e concorrência.

As rotinas verificam igreja, congregação, conta e permissões; as relações incluem a igreja. RLS permite leitura somente em unidades com consulta e criação autorizadas. As escritas diretas são revogadas. Transferências e identificação de membros mantêm as permissões próprias.

A origem `IMPORT` é definida antes da inserção do histórico imutável. O comando financeiro público continua usando origem `MANUAL`; o núcleo que recebe a origem é privado, sem execução concedida ao cliente.

Sete migrações novas foram aplicadas exclusivamente no Supabase local. As migrações anteriores permaneceram intactas. Os ajustes descobertos nos testes foram registrados em migrações adicionais, preservando o histórico. Os tipos foram regenerados pelo CLI local.

## Verificação em 23/10/2026

| Verificação | Resultado |
| --- | --- |
| Lint, sem warnings | Aprovado |
| Typecheck | Aprovado |
| Vitest completo | 583 testes, 111 arquivos aprovados |
| Build com configuração local | Aprovado |
| Navegador: importação | 3 cenários aprovados: rascunho/retomada/próximo, ignorar/restaurar, reenvio, perda da resposta após gravação, linha inválida, vínculo manual, transferência e sobreposição |
| Navegador: regressão financeira | 11 cenários aprovados: formulário manual, atendimento, descrição coletiva, mobile, comprovantes e demonstrativos |
| SQL transacional | Preparação sem ledger, revisões, retentativas, vínculos, saldo divergente, manipulação da origem, cancelamento/reabertura, grants e isolamento aprovados |
| Concorrência real | Dois operadores: uma confirmação e um conflito; retentativa devolve o mesmo resultado; uma entrada no ledger |
| Volume | 5.000 linhas preservadas, páginas de 50 itens; preparação e primeira consulta entre aproximadamente 3 e 6 segundos no ambiente local |
| Amostra fornecida pelo usuário, somente em memória | 33 movimentos: 22 créditos, 11 débitos, três saldos, nenhuma linha inválida e reconciliação correspondente |

As capturas de desktop e mobile usam dados fictícios e foram inspecionadas. A planilha real não foi copiada para o repositório nem usada para criar lançamentos no banco.

### Auditoria geral do banco local

Os [Advisors do Supabase](https://supabase.com/docs/guides/observability/advisors) foram executados com `--local`, para segurança e desempenho. Não houve achado ERROR nem WARN nas estruturas novas. Os índices de referência apontados inicialmente foram adicionados e a autorização de leitura foi ajustada para não ser recalculada por linha.

Permanecem informações esperadas sobre índices ainda sem uso no ambiente de teste e sobre `finance_bank_import_operations`: essa tabela tem RLS, nenhuma policy e nenhum grant de leitura/escrita para o cliente, intencionalmente.

No restante do banco local, os Advisors apontam 16 warnings preexistentes: 11 de `auth_rls_initplan` e cinco de `multiple_permissive_policies`. O lint SQL geral também aponta dois erros preexistentes, fora deste recurso:

- `public.claim_stale_administrative_document_cleanups`: referência ambígua a `storage_path`.
- `private.count_congregation_dependencies`: construção incorreta do nome de uma relação em SQL dinâmico.

Essas funções não foram alteradas. Portanto, a verificação do recurso passou, mas o relatório global do banco ainda contém essas pendências.

## Reproduzir localmente

Use o Supabase local em execução e Node conforme `.node-version`. O harness recusa uma URL de API que não seja local e usa usuários fictícios; as sessões ficam no diretório ignorado `tmp/`.

```sh
SUPABASE_TELEMETRY_DISABLED=1 node scripts/finance-local.mjs setup
SUPABASE_TELEMETRY_DISABLED=1 node scripts/finance-local.mjs dev
# Em outro terminal:
SUPABASE_TELEMETRY_DISABLED=1 node scripts/finance-local.mjs e2e e2e/finance-bank-import.spec.ts --workers=1
node scripts/verify-finance-bank-import-concurrency.mjs
```

O roteiro SQL está em `supabase/tests/finance_bank_import_verification.sql`; ele inclui `finance_fixture.sql` da mesma pasta e termina com rollback. A aplicação de migrações deve usar explicitamente `--local` durante esta avaliação.

Os logs completos desta execução estão no diretório ignorado `tmp/`, com prefixo `finance-bank-import-`. Nenhum merge, push, PR ou alteração no banco online foi realizado. Publicação e migração remota continuam dependentes de autorização do usuário.
